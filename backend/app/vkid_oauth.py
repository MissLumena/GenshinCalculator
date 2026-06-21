"""Клиент VK ID OAuth с входом через Mail.ru (provider=mail_ru)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.mailru_oauth import MailRuUserInfo

logger = logging.getLogger('genshin_api')

VKID_AUTHORIZE_URL = 'https://id.vk.ru/authorize'
VKID_TOKEN_URL = 'https://id.vk.ru/oauth2/auth'
VKID_USERINFO_URL = 'https://id.vk.ru/oauth2/user_info'
VKID_MAIL_SCOPE = 'email'
VKID_MAIL_PROVIDER = 'mail_ru'


@dataclass(frozen=True)
class VkIdOAuthConfig:
    client_id: str
    service_token: str
    redirect_uri: str


def build_mail_authorize_url(
    config: VkIdOAuthConfig,
    *,
    state: str,
    code_challenge: str,
) -> str:
    params = {
        'response_type': 'code',
        'client_id': config.client_id,
        'redirect_uri': config.redirect_uri,
        'state': state,
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256',
        'scope': VKID_MAIL_SCOPE,
        'provider': VKID_MAIL_PROVIDER,
    }
    return f'{VKID_AUTHORIZE_URL}?{urlencode(params)}'


def exchange_code_for_token(
    config: VkIdOAuthConfig,
    code: str,
    *,
    code_verifier: str,
    device_id: str,
    state: str,
) -> str:
    payload = {
        'grant_type': 'authorization_code',
        'code': code,
        'code_verifier': code_verifier,
        'redirect_uri': config.redirect_uri,
        'client_id': config.client_id,
        'device_id': device_id,
        'state': state,
    }
    if config.service_token:
        payload['service_token'] = config.service_token

    try:
        response = httpx.post(
            VKID_TOKEN_URL,
            data=payload,
            headers={
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout=15.0,
        )
    except httpx.HTTPError as exc:
        logger.warning('VK ID token exchange failed: %s', exc)
        raise ValueError('Не удалось обменять код авторизации VK ID') from exc

    body = _parse_json_response(response)
    if response.status_code >= 400 or body.get('error'):
        message = _format_oauth_error(body, fallback='Ошибка обмена кода VK ID')
        logger.warning('VK ID token error: %s', message)
        raise ValueError(message)

    access_token = body.get('access_token')
    if not access_token or not isinstance(access_token, str):
        raise ValueError('VK ID не вернул access_token')

    return access_token


def fetch_user_info(config: VkIdOAuthConfig, access_token: str) -> MailRuUserInfo:
    payload = {
        'client_id': config.client_id,
        'access_token': access_token,
    }
    try:
        response = httpx.post(
            VKID_USERINFO_URL,
            data=payload,
            headers={
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout=15.0,
        )
    except httpx.HTTPError as exc:
        logger.warning('VK ID userinfo failed: %s', exc)
        raise ValueError('Не удалось получить профиль VK ID') from exc

    body = _parse_json_response(response)
    if response.status_code >= 400 or body.get('error'):
        message = _format_oauth_error(body, fallback='Ошибка профиля VK ID')
        logger.warning('VK ID userinfo error: %s', message)
        raise ValueError(message)

    user = body.get('user')
    if not isinstance(user, dict):
        raise ValueError('VK ID вернул некорректный профиль')

    email = str(user.get('email') or '').strip().lower()
    if not email:
        raise ValueError('VK ID не предоставил email. Разрешите доступ к почте.')

    first_name = str(user.get('first_name') or '').strip()
    last_name = str(user.get('last_name') or '').strip()
    display_name = ' '.join(part for part in (first_name, last_name) if part).strip()
    if not display_name:
        display_name = email.split('@')[0]

    return MailRuUserInfo(email=email, display_name=display_name[:100])


def _parse_json_response(response: httpx.Response) -> dict:
    try:
        body = response.json()
    except ValueError:
        return {'error': 'invalid_response', 'error_description': response.text[:200]}
    return body if isinstance(body, dict) else {}


def _format_oauth_error(body: dict, *, fallback: str) -> str:
    description = body.get('error_description') or body.get('error') or fallback
    return str(description)
