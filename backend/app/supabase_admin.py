"""Supabase Admin API: пользователи и magic link для OAuth Mail.ru."""

from __future__ import annotations

import logging

import httpx

from app.config import Settings

logger = logging.getLogger('genshin_api')


def _normalize_supabase_url(url: str) -> str:
    return url.strip().rstrip('/').replace('/rest/v1', '')


def _admin_headers(service_role_key: str) -> dict[str, str]:
    return {
        'apikey': service_role_key,
        'Authorization': f'Bearer {service_role_key}',
        'Content-Type': 'application/json',
    }


def is_supabase_admin_configured(settings: Settings) -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key)


def create_magic_link_token_hash(
    settings: Settings,
    *,
    email: str,
    display_name: str,
    redirect_to: str,
) -> str:
    if not is_supabase_admin_configured(settings):
        raise RuntimeError('Supabase Admin API не настроен (SUPABASE_SERVICE_ROLE_KEY)')

    base = _normalize_supabase_url(settings.supabase_url)
    headers = _admin_headers(settings.supabase_service_role_key)

    create_payload = {
        'email': email,
        'email_confirm': True,
        'user_metadata': {'display_name': display_name},
        'app_metadata': {'provider': 'mailru'},
    }

    try:
        create_response = httpx.post(
            f'{base}/auth/v1/admin/users',
            json=create_payload,
            headers=headers,
            timeout=15.0,
        )
    except httpx.HTTPError as exc:
        logger.warning('Supabase admin create user failed: %s', exc)
        raise RuntimeError('Supabase Auth временно недоступен') from exc

    if create_response.status_code not in (200, 201):
        if create_response.status_code != 422:
            logger.warning(
                'Supabase admin create user error: %s %s',
                create_response.status_code,
                create_response.text[:300],
            )
            raise RuntimeError('Не удалось создать пользователя в Supabase')

    link_payload = {
        'type': 'magiclink',
        'email': email,
        'options': {'redirect_to': redirect_to},
    }

    try:
        link_response = httpx.post(
            f'{base}/auth/v1/admin/generate_link',
            json=link_payload,
            headers=headers,
            timeout=15.0,
        )
        link_response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning('Supabase admin generate_link failed: %s', exc)
        raise RuntimeError('Не удалось выдать сессию Supabase') from exc

    body = link_response.json()
    properties = body.get('properties') or {}
    token_hash = properties.get('hashed_token')
    if not token_hash or not isinstance(token_hash, str):
        raise RuntimeError('Supabase не вернул token_hash для входа')

    return token_hash
