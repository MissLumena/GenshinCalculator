"""Тесты OAuth Mail.ru."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

client = TestClient(app, follow_redirects=False)


@pytest.fixture(autouse=True)
def clear_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_mailru_start_without_config_returns_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('MAILRU_CLIENT_ID', '')
    monkeypatch.setenv('MAILRU_CLIENT_SECRET', '')
    get_settings.cache_clear()

    response = client.get(
        '/api/auth/mailru/start',
        headers={'Origin': 'http://localhost:5173'},
    )
    assert response.status_code == 503


def test_mailru_start_redirects_to_mailru(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('MAILRU_CLIENT_ID', 'test-client')
    monkeypatch.setenv('MAILRU_CLIENT_SECRET', 'test-secret')
    monkeypatch.setenv('SUPABASE_URL', 'https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    get_settings.cache_clear()

    response = client.get(
        '/api/auth/mailru/start',
        headers={'Origin': 'http://localhost:5173'},
    )
    assert response.status_code == 302
    location = response.headers['location']
    assert location.startswith('https://oauth.mail.ru/login')
    assert 'client_id=test-client' in location
    assert 'redirect_uri=' in location
    assert 'state=' in location


@patch('app.routers.auth_mailru.create_magic_link_token_hash')
@patch('app.routers.auth_mailru.fetch_user_info')
@patch('app.routers.auth_mailru.exchange_code_for_token')
def test_mailru_callback_success_redirects_with_token_hash(
    exchange_mock: MagicMock,
    userinfo_mock: MagicMock,
    token_hash_mock: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv('MAILRU_CLIENT_ID', 'test-client')
    monkeypatch.setenv('MAILRU_CLIENT_SECRET', 'test-secret')
    monkeypatch.setenv('SUPABASE_URL', 'https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    monkeypatch.setenv('JWT_SECRET', 'test-jwt-secret')
    get_settings.cache_clear()

    start = client.get(
        '/api/auth/mailru/start',
        headers={'Origin': 'http://localhost:5173'},
    )
    assert start.status_code == 302
    location = start.headers['location']
    assert 'code_challenge=' in location
    assert 'scope=openid' in location
    state = location.split('state=')[-1].split('&')[0]

    exchange_mock.return_value = 'access-token'
    userinfo_mock.return_value = MagicMock(email='user@mail.ru', display_name='User')
    token_hash_mock.return_value = 'hashed-token'

    response = client.get(
        '/api/auth/mailru/callback',
        params={'code': 'auth-code', 'state': state},
        headers={'Origin': 'http://localhost:5173'},
    )
    assert response.status_code == 302
    callback_location = response.headers['location']
    assert callback_location.startswith('http://localhost:5173/auth/callback?')
    assert 'token_hash=hashed-token' in callback_location
    assert exchange_mock.call_args.kwargs['code_verifier']
