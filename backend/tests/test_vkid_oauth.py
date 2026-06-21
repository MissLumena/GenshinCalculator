"""Тесты клиента VK ID OAuth (Mail.ru через provider=mail_ru)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.vkid_oauth import (
    VkIdOAuthConfig,
    build_mail_authorize_url,
    exchange_code_for_token,
    fetch_user_info,
)


def test_build_mail_authorize_url_contains_vkid_and_provider() -> None:
    config = VkIdOAuthConfig(
        client_id='vk-app-id',
        service_token='service-token',
        redirect_uri='https://example.com/api/auth/mailru/callback',
    )
    url = build_mail_authorize_url(
        config,
        state='state-token',
        code_challenge='challenge-value',
    )
    assert 'id.vk.ru/authorize' in url
    assert 'client_id=vk-app-id' in url
    assert 'provider=mail_ru' in url
    assert 'scope=email' in url
    assert 'code_challenge=challenge-value' in url
    assert 'state=state-token' in url


@patch('app.vkid_oauth.httpx.post')
def test_exchange_code_for_token_sends_device_id(post_mock: MagicMock) -> None:
    response = MagicMock(spec=httpx.Response)
    response.status_code = 200
    response.json.return_value = {'access_token': 'token-123'}
    post_mock.return_value = response

    config = VkIdOAuthConfig(
        client_id='vk-app-id',
        service_token='service-token',
        redirect_uri='https://example.com/api/auth/mailru/callback',
    )
    token = exchange_code_for_token(
        config,
        'code-1',
        code_verifier='verifier-1234567890123456789012345678901234567890',
        device_id='device-abc',
        state='state-token',
    )
    assert token == 'token-123'
    _, kwargs = post_mock.call_args
    assert kwargs['data']['device_id'] == 'device-abc'
    assert kwargs['data']['service_token'] == 'service-token'


@patch('app.vkid_oauth.httpx.post')
def test_fetch_user_info_reads_nested_user_email(post_mock: MagicMock) -> None:
    response = MagicMock(spec=httpx.Response)
    response.status_code = 200
    response.json.return_value = {
        'user': {
            'email': 'user@mail.ru',
            'first_name': 'Test',
            'last_name': 'User',
        },
    }
    post_mock.return_value = response

    config = VkIdOAuthConfig(
        client_id='vk-app-id',
        service_token='service-token',
        redirect_uri='https://example.com/api/auth/mailru/callback',
    )
    info = fetch_user_info(config, 'token-123')
    assert info.email == 'user@mail.ru'
    assert info.display_name == 'Test User'


@patch('app.vkid_oauth.httpx.post')
def test_fetch_user_info_missing_email_raises(post_mock: MagicMock) -> None:
    response = MagicMock(spec=httpx.Response)
    response.status_code = 200
    response.json.return_value = {'user': {'first_name': 'Test'}}
    post_mock.return_value = response

    config = VkIdOAuthConfig(
        client_id='vk-app-id',
        service_token='service-token',
        redirect_uri='https://example.com/api/auth/mailru/callback',
    )
    with pytest.raises(ValueError, match='email'):
        fetch_user_info(config, 'token-123')
