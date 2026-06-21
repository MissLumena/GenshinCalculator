"""Клиент OAuth 2.0 / OIDC Mail.ru (oauth.mail.ru)."""

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

logger = logging.getLogger('genshin_api')

# o2.mail.ru — актуальные эндпоинты для приложений из https://o2.mail.ru/app/
MAILRU_AUTHORIZE_URL = 'https://o2.mail.ru/login'
MAILRU_TOKEN_URL = 'https://o2.mail.ru/token'
MAILRU_USERINFO_URL = 'https://oauth.mail.ru/api/v1/oidc/userinfo'
MAILRU_SCOPE = 'openid email'


@dataclass(frozen=True)
class MailRuUserInfo:
    email: str
    display_name: str


@dataclass(frozen=True)
class MailRuOAuthConfig:
    client_id: str
    client_secret: str
    redirect_uri: str


@dataclass(frozen=True)
class MailRuPkcePair:
    code_verifier: str
    code_challenge: str


def generate_pkce_pair() -> MailRuPkcePair:
    """PKCE S256 — обязателен для новых приложений oauth.mail.ru."""
    code_verifier = secrets.token_urlsafe(64)[:96]
    digest = hashlib.sha256(code_verifier.encode('ascii')).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode('ascii')
    return MailRuPkcePair(code_verifier=code_verifier, code_challenge=code_challenge)


def build_authorize_url(
    config: MailRuOAuthConfig,
    *,
    state: str,
    code_challenge: str,
) -> str:
    params = {
        'client_id': config.client_id,
        'response_type': 'code',
        'redirect_uri': config.redirect_uri,
        'scope': MAILRU_SCOPE,
        'state': state,
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256',
    }
    return f'{MAILRU_AUTHORIZE_URL}?{urlencode(params)}'


def exchange_code_for_token(
    config: MailRuOAuthConfig,
    code: str,
    *,
    code_verifier: str,
) -> str:
    payload = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': config.redirect_uri,
        'code_verifier': code_verifier,
    }
    try:
        response = httpx.post(
            MAILRU_TOKEN_URL,
            data=payload,
            auth=(config.client_id, config.client_secret),
            headers={
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout=15.0,
        )
    except httpx.HTTPError as exc:
        logger.warning('Mail.ru token exchange failed: %s', exc)
        raise ValueError('Не удалось обменять код авторизации Mail.ru') from exc

    body = _parse_json_response(response)
    if response.status_code >= 400 or body.get('error'):
        message = _format_oauth_error(body, fallback='Ошибка обмена кода Mail.ru')
        logger.warning('Mail.ru token error: %s', message)
        raise ValueError(message)

    access_token = body.get('access_token')
    if not access_token or not isinstance(access_token, str):
        raise ValueError('Mail.ru не вернул access_token')

    return access_token


def fetch_user_info(access_token: str) -> MailRuUserInfo:
    try:
        response = httpx.post(
            MAILRU_USERINFO_URL,
            headers={
                'Accept': 'application/json',
                'Authorization': f'Bearer {access_token}',
            },
            timeout=15.0,
        )
    except httpx.HTTPError as exc:
        logger.warning('Mail.ru userinfo failed: %s', exc)
        raise ValueError('Не удалось получить профиль Mail.ru') from exc

    body = _parse_json_response(response)
    if response.status_code >= 400 or body.get('error'):
        message = _format_oauth_error(body, fallback='Ошибка профиля Mail.ru')
        logger.warning('Mail.ru userinfo error: %s', message)
        raise ValueError(message)

    email = str(body.get('email') or '').strip().lower()
    if not email:
        raise ValueError('Mail.ru не предоставил email. Разрешите доступ к почте.')

    display_name = str(body.get('name') or '').strip()
    if not display_name:
        given_name = str(body.get('given_name') or '').strip()
        family_name = str(body.get('family_name') or '').strip()
        display_name = ' '.join(part for part in (given_name, family_name) if part).strip()
    if not display_name:
        display_name = str(body.get('nickname') or email.split('@')[0]).strip()

    return MailRuUserInfo(email=email, display_name=display_name[:100])


def _parse_json_response(response: httpx.Response) -> dict:
    try:
        body = response.json()
    except ValueError:
        return {'error': 'invalid_response', 'error_description': response.text[:200]}
    return body if isinstance(body, dict) else {}


def _format_oauth_error(body: dict, *, fallback: str) -> str:
    description = body.get('error_description') or body.get('error') or fallback
    error_code = body.get('error_code')
    if error_code is not None:
        return f'{description} (код {error_code})'
    return str(description)
