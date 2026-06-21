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
    monkeypatch.setenv('VK_ID_CLIENT_ID', '')
    monkeypatch.setenv('VK_ID_SERVICE_TOKEN', '')
    get_settings.cache_clear()

    response = client.get(
        '/api/auth/mailru/start',
        headers={'Origin': 'http://localhost:5173'},
    )
    assert response.status_code == 503


def test_mailru_start_redirects_to_mailru(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('MAILRU_CLIENT_ID', 'test-client')
    monkeypatch.setenv('MAILRU_CLIENT_SECRET', 'test-secret')
    monkeypatch.setenv('VK_ID_CLIENT_ID', '')
    monkeypatch.setenv('VK_ID_SERVICE_TOKEN', '')
    monkeypatch.setenv('SUPABASE_URL', 'https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    get_settings.cache_clear()

    response = client.get(
        '/api/auth/mailru/start',
        headers={'Origin': 'http://localhost:5173'},
    )
    assert response.status_code == 302
    location = response.headers['location']
    assert location.startswith('https://o2.mail.ru/login')
    assert 'client_id=test-client' in location
    assert 'redirect_uri=' in location
    assert 'state=' in location


@patch('app.routers.auth_mailru.create_magic_link_token_hash')
@patch('app.routers.auth_mailru.fetch_legacy_user_info')
@patch('app.routers.auth_mailru.exchange_legacy_code_for_token')
def test_mailru_callback_success_redirects_with_token_hash(
    exchange_mock: MagicMock,
    userinfo_mock: MagicMock,
    token_hash_mock: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv('MAILRU_CLIENT_ID', 'test-client')
    monkeypatch.setenv('MAILRU_CLIENT_SECRET', 'test-secret')
    monkeypatch.setenv('VK_ID_CLIENT_ID', '')
    monkeypatch.setenv('VK_ID_SERVICE_TOKEN', '')
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


def test_mailru_start_uses_vkid_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('VK_ID_CLIENT_ID', 'vk-client')
    monkeypatch.setenv('VK_ID_SERVICE_TOKEN', 'vk-service-token')
    monkeypatch.setenv('MAILRU_CLIENT_ID', '')
    monkeypatch.setenv('MAILRU_CLIENT_SECRET', '')
    monkeypatch.setenv('SUPABASE_URL', 'https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    get_settings.cache_clear()

    response = client.get(
        '/api/auth/mailru/start',
        headers={'Origin': 'http://localhost:5173'},
    )
    assert response.status_code == 302
    location = response.headers['location']
    assert location.startswith('https://id.vk.ru/authorize')
    assert 'client_id=vk-client' in location
    assert 'provider=mail_ru' in location


@patch('app.routers.auth_mailru.create_magic_link_token_hash')
@patch('app.routers.auth_mailru.fetch_vkid_user_info')
@patch('app.routers.auth_mailru.exchange_vkid_code_for_token')
def test_mailru_callback_vkid_requires_device_id(
    exchange_mock: MagicMock,
    userinfo_mock: MagicMock,
    token_hash_mock: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv('VK_ID_CLIENT_ID', 'vk-client')
    monkeypatch.setenv('VK_ID_SERVICE_TOKEN', 'vk-service-token')
    monkeypatch.setenv('SUPABASE_URL', 'https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    monkeypatch.setenv('JWT_SECRET', 'test-jwt-secret')
    get_settings.cache_clear()

    start = client.get(
        '/api/auth/mailru/start',
        headers={'Origin': 'http://localhost:5173'},
    )
    state = start.headers['location'].split('state=')[-1].split('&')[0]

    response = client.get(
        '/api/auth/mailru/callback',
        params={'code': 'auth-code', 'state': state},
        headers={'Origin': 'http://localhost:5173'},
    )
    assert response.status_code == 302
    assert 'error=' in response.headers['location']
    exchange_mock.assert_not_called()


@patch('app.routers.auth_mailru.create_magic_link_token_hash')
@patch('app.routers.auth_mailru.fetch_vkid_user_info')
@patch('app.routers.auth_mailru.exchange_vkid_code_for_token')
def test_mailru_callback_vkid_success(
    exchange_mock: MagicMock,
    userinfo_mock: MagicMock,
    token_hash_mock: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv('VK_ID_CLIENT_ID', 'vk-client')
    monkeypatch.setenv('VK_ID_SERVICE_TOKEN', 'vk-service-token')
    monkeypatch.setenv('SUPABASE_URL', 'https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    monkeypatch.setenv('JWT_SECRET', 'test-jwt-secret')
    get_settings.cache_clear()

    start = client.get(
        '/api/auth/mailru/start',
        headers={'Origin': 'http://localhost:5173'},
    )
    state = start.headers['location'].split('state=')[-1].split('&')[0]

    exchange_mock.return_value = 'access-token'
    userinfo_mock.return_value = MagicMock(email='user@mail.ru', display_name='User')
    token_hash_mock.return_value = 'hashed-token'

    response = client.get(
        '/api/auth/mailru/callback',
        params={
            'code': 'auth-code',
            'state': state,
            'device_id': 'device-123',
        },
        headers={'Origin': 'http://localhost:5173'},
    )
    assert response.status_code == 302
    assert 'token_hash=hashed-token' in response.headers['location']
    exchange_mock.assert_called_once()
