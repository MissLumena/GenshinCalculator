"""Проверка Supabase JWT и ролей пользователя."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import Settings, get_settings

security = HTTPBearer(auto_error=False)

ALLOWED_ROLES = frozenset({'user', 'admin', 'superuser'})


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None
    role: str

    @property
    def is_admin(self) -> bool:
        return self.role in {'admin', 'superuser'}


def _resolve_role(payload: dict) -> str:
    app_meta = payload.get('app_metadata') or {}
    user_meta = payload.get('user_metadata') or {}
    role = app_meta.get('role') or user_meta.get('role') or 'user'
    role = str(role).lower()
    if role not in ALLOWED_ROLES:
        return 'user'
    return role


def decode_supabase_token(token: str, settings: Settings) -> AuthUser:
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Supabase JWT secret is not configured',
        )

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=['HS256'],
            audience='authenticated',
            options={'verify_aud': bool(settings.supabase_jwt_audience)},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid or expired token',
            headers={'WWW-Authenticate': 'Bearer'},
        ) from exc

    user_id = payload.get('sub')
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid token payload',
        )

    return AuthUser(
        id=str(user_id),
        email=payload.get('email'),
        role=_resolve_role(payload),
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
