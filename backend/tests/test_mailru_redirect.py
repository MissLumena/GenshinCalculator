"""Redirect URI для Mail.ru не должен зависеть от Origin браузера."""

from __future__ import annotations

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


def test_mailru_start_uses_localhost_redirect_from_127_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('MAILRU_CLIENT_ID', 'test-client')
    monkeypatch.setenv('MAILRU_CLIENT_SECRET', 'test-secret')
    monkeypatch.setenv('SUPABASE_URL', 'https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    monkeypatch.setenv('MAILRU_REDIRECT_URI', 'http://localhost:5173/api/auth/mailru/callback')
    get_settings.cache_clear()

    response = client.get(
        '/api/auth/mailru/start',
        headers={'Origin': 'http://127.0.0.1:5173'},
    )
    assert response.status_code == 302
    location = response.headers['location']
    assert 'redirect_uri=http%3A%2F%2Flocalhost%3A5173' in location
    assert 'redirect_uri=http%3A%2F%2F127.0.0.1' not in location
