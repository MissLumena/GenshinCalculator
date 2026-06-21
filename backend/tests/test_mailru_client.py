"""Тесты клиента Mail.ru OAuth."""

from __future__ import annotations

import base64
import hashlib
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.mailru_oauth import (
    MailRuOAuthConfig,
    build_authorize_url,
    exchange_code_for_token,
    fetch_user_info,
    generate_pkce_pair,
)


def test_generate_pkce_pair_challenge_matches_verifier() -> None:
    pair = generate_pkce_pair()
    digest = hashlib.sha256(pair.code_verifier.encode('ascii')).digest()
    expected = base64.urlsafe_b64encode(digest).rstrip(b'=').decode('ascii')
    assert pair.code_challenge == expected
    assert len(pair.code_verifier) >= 43


def test_build_authorize_url_contains_pkce_and_openid_scope() -> None:
    config = MailRuOAuthConfig(
        client_id='abc',
        client_secret='secret',
        redirect_uri='http://localhost:5173/api/auth/mailru/callback',
    )
    url = build_authorize_url(
        config,
        state='state-token',
        code_challenge='challenge-value',
    )
    assert 'oauth.mail.ru/login' in url
    assert 'client_id=abc' in url
    assert 'response_type=code' in url
    assert 'scope=openid+email' in url
    assert 'code_challenge=challenge-value' in url
    assert 'code_challenge_method=S256' in url
    assert 'state=state-token' in url


@patch('app.mailru_oauth.httpx.post')
def test_exchange_code_for_token_uses_basic_auth_and_pkce(post_mock: MagicMock) -> None:
    response = MagicMock(spec=httpx.Response)
    response.status_code = 200
    response.json.return_value = {'access_token': 'token-123'}
    post_mock.return_value = response

    config = MailRuOAuthConfig(
        client_id='abc',
        client_secret='secret',
        redirect_uri='http://localhost:5173/api/auth/mailru/callback',
    )
    token = exchange_code_for_token(config, 'code-1', code_verifier='verifier-1234567890123456789012345678901234567890')
    assert token == 'token-123'
    _, kwargs = post_mock.call_args
    assert kwargs['auth'] == ('abc', 'secret')
    assert kwargs['data']['code_verifier'] == 'verifier-1234567890123456789012345678901234567890'


@patch('app.mailru_oauth.httpx.post')
def test_fetch_user_info_uses_bearer_post(post_mock: MagicMock) -> None:
    response = MagicMock(spec=httpx.Response)
    response.status_code = 200
    response.json.return_value = {
        'email': 'user@mail.ru',
        'name': 'Test User',
    }
    post_mock.return_value = response

    info = fetch_user_info('token-123')
    assert info.email == 'user@mail.ru'
    assert info.display_name == 'Test User'
    _, kwargs = post_mock.call_args
    assert kwargs['headers']['Authorization'] == 'Bearer token-123'


@patch('app.mailru_oauth.httpx.post')
def test_fetch_user_info_missing_email_raises(post_mock: MagicMock) -> None:
    response = MagicMock(spec=httpx.Response)
    response.status_code = 200
    response.json.return_value = {'given_name': 'Test'}
    post_mock.return_value = response

    with pytest.raises(ValueError, match='email'):
        fetch_user_info('token-123')
