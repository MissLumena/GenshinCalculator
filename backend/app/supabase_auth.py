"""Проверка Supabase JWT и ролей пользователя."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt

from app.config import Settings, get_settings

logger = logging.getLogger('genshin_api')

security = HTTPBearer(auto_error=False)

ALLOWED_ROLES = frozenset({'user', 'admin', 'superuser'})
_ASYMMETRIC_ALGORITHMS = frozenset({'RS256', 'ES256', 'EdDSA'})
_JWKS_CACHE_TTL_SECONDS = 600
_jwks_cache: dict[str, tuple[float, dict]] = {}


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None
    role: str

    @property
    def is_admin(self) -> bool:
        return self.role in {'admin', 'superuser'}


def _normalize_supabase_url(url: str) -> str:
    return url.strip().rstrip('/').replace('/rest/v1', '')


def _resolve_role(
    payload: dict,
    *,
    email: str | None = None,
    settings: Settings | None = None,
) -> str:
    app_meta = payload.get('app_metadata') or {}
    user_meta = payload.get('user_metadata') or {}
    role = app_meta.get('role') or user_meta.get('role') or 'user'
    role = str(role).lower()
    if role not in ALLOWED_ROLES:
        role = 'user'

    resolved_email = (email or payload.get('email') or '').strip().lower()
    if settings and resolved_email and resolved_email in settings.superuser_email_set:
        return 'superuser'

    return role


def _auth_user_from_payload(payload: dict, settings: Settings | None = None) -> AuthUser:
    user_id = payload.get('sub')
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid token payload',
        )

    return AuthUser(
        id=str(user_id),
        email=payload.get('email'),
        role=_resolve_role(payload, email=payload.get('email'), settings=settings),
    )


def _auth_user_from_supabase_user(user: dict, settings: Settings | None = None) -> AuthUser:
    user_id = user.get('id')
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid token payload',
        )

    app_meta = user.get('app_metadata') or {}
    user_meta = user.get('user_metadata') or {}
    email = user.get('email')
    role = _resolve_role(
        {'app_metadata': app_meta, 'user_metadata': user_meta, 'email': email},
        email=email,
        settings=settings,
    )

    return AuthUser(
        id=str(user_id),
        email=email,
        role=role,
    )


def _decode_hs256_token(token: str, settings: Settings) -> dict:
    if not settings.supabase_jwt_secret:
        raise JWTError('SUPABASE_JWT_SECRET is not configured')

    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=['HS256'],
        audience='authenticated',
        options={'verify_aud': bool(settings.supabase_jwt_audience)},
    )


def _fetch_jwks(supabase_url: str) -> dict:
    normalized = _normalize_supabase_url(supabase_url)
    cached = _jwks_cache.get(normalized)
    now = time.time()
    if cached and now - cached[0] < _JWKS_CACHE_TTL_SECONDS:
        return cached[1]

    jwks_url = f'{normalized}/auth/v1/.well-known/jwks.json'
    try:
        response = httpx.get(jwks_url, timeout=10.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise JWTError(f'Unable to fetch Supabase JWKS: {exc}') from exc

    jwks = response.json()
    _jwks_cache[normalized] = (now, jwks)
    return jwks


def _decode_asymmetric_token(token: str, settings: Settings) -> dict:
    if not settings.supabase_url:
        raise JWTError('SUPABASE_URL is not configured for JWKS verification')

    header = jwt.get_unverified_header(token)
    alg = header.get('alg')
    if alg not in _ASYMMETRIC_ALGORITHMS:
        raise JWTError(f'Unsupported JWT algorithm: {alg}')

    jwks = _fetch_jwks(settings.supabase_url)
    keys = jwks.get('keys') or []
    if not keys:
        raise JWTError('Supabase JWKS is empty')

    kid = header.get('kid')
    selected = next((key for key in keys if key.get('kid') == kid), None) if kid else None
    if selected is None:
        selected = keys[0]

    signing_key = jwk.construct(selected)
    return jwt.decode(
        token,
        signing_key,
        algorithms=[alg],
        audience='authenticated',
        options={'verify_aud': bool(settings.supabase_jwt_audience)},
    )


def _decode_jwt_locally(token: str, settings: Settings) -> dict:
    header = jwt.get_unverified_header(token)
    alg = header.get('alg', 'HS256')

    if alg == 'HS256':
        return _decode_hs256_token(token, settings)
    if alg in _ASYMMETRIC_ALGORITHMS:
        return _decode_asymmetric_token(token, settings)

    raise JWTError(f'Unsupported JWT algorithm: {alg}')


def _verify_token_via_supabase_api(token: str, settings: Settings) -> AuthUser:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                'Supabase auth is not configured on the API server. '
                'Set SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env'
            ),
        )

    base = _normalize_supabase_url(settings.supabase_url)
    try:
        response = httpx.get(
            f'{base}/auth/v1/user',
            headers={
                'Authorization': f'Bearer {token}',
                'apikey': settings.supabase_anon_key,
            },
            timeout=10.0,
        )
    except httpx.RequestError as exc:
        logger.warning('Supabase auth API unavailable: %s', exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Supabase Auth временно недоступен',
        ) from exc

    if response.status_code in (
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid or expired token',
            headers={'WWW-Authenticate': 'Bearer'},
        )

    if response.status_code >= status.HTTP_400_BAD_REQUEST:
        logger.warning('Supabase auth API error: %s %s', response.status_code, response.text[:200])
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Supabase Auth временно недоступен',
        )

    return _auth_user_from_supabase_user(response.json(), settings)


def decode_supabase_token(token: str, settings: Settings) -> AuthUser:
    has_local_verifier = bool(settings.supabase_jwt_secret or settings.supabase_url)
    has_api_verifier = bool(settings.supabase_url and settings.supabase_anon_key)

    if not has_local_verifier and not has_api_verifier:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                'Supabase auth is not configured on the API server. '
                'Set SUPABASE_JWT_SECRET or SUPABASE_URL + SUPABASE_ANON_KEY in backend/.env'
            ),
        )

    if has_local_verifier:
        try:
            payload = _decode_jwt_locally(token, settings)
            return _auth_user_from_payload(payload, settings)
        except JWTError as exc:
            logger.info('Local Supabase JWT verification failed: %s', exc)

    if has_api_verifier:
        return _verify_token_via_supabase_api(token, settings)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Invalid or expired token',
        headers={'WWW-Authenticate': 'Bearer'},
    )


def get_optional_auth_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    settings: Settings = Depends(get_settings),
) -> AuthUser | None:
    if credentials is None or credentials.scheme.lower() != 'bearer':
        return None
    return decode_supabase_token(credentials.credentials, settings)


def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    settings: Settings = Depends(get_settings),
) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != 'bearer':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Authentication required',
            headers={'WWW-Authenticate': 'Bearer'},
        )
    return decode_supabase_token(credentials.credentials, settings)


AuthenticatedUser = Annotated[AuthUser, Depends(get_authenticated_user)]
OptionalAuthUser = Annotated[AuthUser | None, Depends(get_optional_auth_user)]
