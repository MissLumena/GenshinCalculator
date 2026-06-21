"""OAuth Mail.ru через backend (без провайдера в Supabase Dashboard)."""

from __future__ import annotations

import logging
import secrets
from urllib.parse import urlencode, urlparse

import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt

from app.config import Settings, get_settings
from app.mailru_oauth import (
    MailRuOAuthConfig,
    build_authorize_url,
    exchange_code_for_token,
    fetch_user_info,
    generate_pkce_pair,
)
from app.supabase_admin import create_magic_link_token_hash, is_supabase_admin_configured

logger = logging.getLogger('genshin_api')

router = APIRouter(prefix='/auth/mailru', tags=['Auth'])


@router.get('/status')
def mailru_oauth_status(settings: Settings = Depends(get_settings)) -> dict[str, bool]:
    """Публичная проверка: настроен ли OAuth Mail.ru на сервере."""
    mailru_ready = bool(settings.mailru_client_id and settings.mailru_client_secret)
    return {
        'configured': mailru_ready and is_supabase_admin_configured(settings),
        'mailru': mailru_ready,
        'supabase_admin': is_supabase_admin_configured(settings),
    }

_STATE_ALGORITHM = 'HS256'
_STATE_TTL_SECONDS = 600


def _is_allowed_frontend_origin(origin: str, settings: Settings) -> bool:
    normalized = origin.rstrip('/')
    return normalized in {item.rstrip('/') for item in settings.cors_origin_list}


def _resolve_frontend_origin(request: Request, settings: Settings) -> str:
    origin = (request.headers.get('origin') or '').strip()
    if origin and _is_allowed_frontend_origin(origin, settings):
        return origin.rstrip('/')

    referer = (request.headers.get('referer') or '').strip()
    if referer:
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            candidate = f'{parsed.scheme}://{parsed.netloc}'
            if _is_allowed_frontend_origin(candidate, settings):
                return candidate.rstrip('/')

    if settings.cors_origin_list:
        return settings.cors_origin_list[0].rstrip('/')

    raise HTTPException(status_code=400, detail='Не удалось определить origin фронтенда')


def _mailru_redirect_uri(settings: Settings) -> str:
    return settings.resolved_mailru_redirect_uri


def _auth_callback_url(frontend_origin: str, *, params: dict[str, str]) -> str:
    query = urlencode(params)
    return f'{frontend_origin}/auth/callback?{query}'


def _encode_state(settings: Settings, *, frontend_origin: str, code_verifier: str) -> str:
    payload = {
        'origin': frontend_origin,
        'nonce': secrets.token_urlsafe(16),
        'cv': code_verifier,
        'exp': int(time.time()) + _STATE_TTL_SECONDS,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_STATE_ALGORITHM)


def _decode_state_payload(settings: Settings, state: str) -> tuple[str, str]:
    try:
        payload = jwt.decode(
            state,
            settings.jwt_secret,
            algorithms=[_STATE_ALGORITHM],
        )
    except JWTError as exc:
        raise HTTPException(status_code=400, detail='Некорректный state OAuth') from exc

    origin = payload.get('origin')
    code_verifier = payload.get('cv')
    if not isinstance(origin, str) or not origin.strip():
        raise HTTPException(status_code=400, detail='Некорректный state OAuth')
    if not isinstance(code_verifier, str) or len(code_verifier) < 43:
        raise HTTPException(status_code=400, detail='Некорректный PKCE state OAuth')

    normalized = origin.rstrip('/')
    if not _is_allowed_frontend_origin(normalized, settings):
        raise HTTPException(status_code=400, detail='Недопустимый origin в state OAuth')

    return normalized, code_verifier


def _decode_state(settings: Settings, state: str) -> str:
    origin, _ = _decode_state_payload(settings, state)
    return origin


def _require_mailru_config(settings: Settings) -> MailRuOAuthConfig:
    if not settings.mailru_client_id or not settings.mailru_client_secret:
        raise HTTPException(
            status_code=503,
            detail='Mail.ru OAuth не настроен. Задайте MAILRU_CLIENT_ID и MAILRU_CLIENT_SECRET.',
        )
    if not is_supabase_admin_configured(settings):
        raise HTTPException(
            status_code=503,
            detail='Задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY для входа через Mail.ru.',
        )
    return MailRuOAuthConfig(
        client_id=settings.mailru_client_id,
        client_secret=settings.mailru_client_secret,
        redirect_uri='',
    )


@router.get('/start')
async def start_mailru_oauth(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    frontend_origin = _resolve_frontend_origin(request, settings)

    client_ip = request.client.host if request.client else 'unknown'
    now = time.time()
    rate_store = getattr(router, '_oauth_rate_store', None)
    if rate_store is None:
        rate_store = {}
        router._oauth_rate_store = rate_store
    window_start = now - 60
    recent_hits = [hit for hit in rate_store.get(client_ip, []) if hit > window_start]
    if len(recent_hits) >= 15:
        return RedirectResponse(
            url=_auth_callback_url(
                frontend_origin,
                params={'error': 'Слишком много попыток входа. Подождите минуту.'},
            ),
            status_code=302,
        )
    recent_hits.append(now)
    rate_store[client_ip] = recent_hits

    config_base = _require_mailru_config(settings)
    redirect_uri = _mailru_redirect_uri(settings)
    config = MailRuOAuthConfig(
        client_id=config_base.client_id,
        client_secret=config_base.client_secret,
        redirect_uri=redirect_uri,
    )

    pkce = generate_pkce_pair()
    state = _encode_state(
        settings,
        frontend_origin=frontend_origin,
        code_verifier=pkce.code_verifier,
    )
    authorize_url = build_authorize_url(
        config,
        state=state,
        code_challenge=pkce.code_challenge,
    )
    return RedirectResponse(url=authorize_url, status_code=302)


@router.get('/callback')
async def mailru_oauth_callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    fallback_origin = settings.cors_origin_list[0].rstrip('/') if settings.cors_origin_list else '/'
    public_oauth_error = 'Не удалось войти через Mail.ru. Попробуйте снова.'

    client_ip = request.client.host if request.client else 'unknown'
    now = time.time()
    rate_store = getattr(router, '_oauth_rate_store', None)
    if rate_store is None:
        rate_store = {}
        router._oauth_rate_store = rate_store
    window_start = now - 60
    recent_hits = [hit for hit in rate_store.get(client_ip, []) if hit > window_start]
    if len(recent_hits) >= 30:
        return RedirectResponse(
            url=_auth_callback_url(
                fallback_origin,
                params={'error': 'Слишком много попыток входа. Подождите минуту.'},
            ),
            status_code=302,
        )
    recent_hits.append(now)
    rate_store[client_ip] = recent_hits

    if error or error_description:
        return RedirectResponse(
            url=_auth_callback_url(
                fallback_origin,
                params={'error': 'Вход через Mail.ru отменён или не выполнен.'},
            ),
            status_code=302,
        )

    if not code or not state:
        return RedirectResponse(
            url=_auth_callback_url(fallback_origin, params={'error': 'Отсутствует code или state'}),
            status_code=302,
        )

    try:
        frontend_origin, code_verifier = _decode_state_payload(settings, state)
        config_base = _require_mailru_config(settings)
        redirect_uri = _mailru_redirect_uri(settings)
        config = MailRuOAuthConfig(
            client_id=config_base.client_id,
            client_secret=config_base.client_secret,
            redirect_uri=redirect_uri,
        )

        access_token = exchange_code_for_token(config, code, code_verifier=code_verifier)
        user_info = fetch_user_info(access_token)
        auth_redirect = f'{frontend_origin}/auth/callback'
        token_hash = create_magic_link_token_hash(
            settings,
            email=user_info.email,
            display_name=user_info.display_name,
            redirect_to=auth_redirect,
        )

        return RedirectResponse(
            url=_auth_callback_url(
                frontend_origin,
                params={'token_hash': token_hash, 'type': 'email'},
            ),
            status_code=302,
        )
    except HTTPException as exc:
        if exc.status_code == 400 and isinstance(exc.detail, str):
            detail = exc.detail
        elif exc.status_code == 503:
            detail = 'Служба входа временно недоступна. Попробуйте позже.'
        else:
            detail = public_oauth_error
        origin = fallback_origin
        try:
            origin = _decode_state(settings, state)
        except HTTPException:
            pass
        return RedirectResponse(
            url=_auth_callback_url(origin, params={'error': detail}),
            status_code=302,
        )
    except (ValueError, RuntimeError) as exc:
        logger.warning('Mail.ru OAuth callback failed: %s', exc)
        origin = fallback_origin
        try:
            origin = _decode_state(settings, state)
        except HTTPException:
            pass
        return RedirectResponse(
            url=_auth_callback_url(origin, params={'error': public_oauth_error}),
            status_code=302,
        )
