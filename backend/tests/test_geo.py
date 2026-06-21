"""Тесты geo / OAuth country policy."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.geo import (
    is_oauth_allowed_for_country,
    lookup_country_code,
    normalize_country_code,
    resolve_country_from_headers,
)
from app.main import app

client = TestClient(app)


def test_normalize_country_code() -> None:
    assert normalize_country_code('ru') == 'RU'
    assert normalize_country_code(' bad ') is None


def test_oauth_allowed_for_russia() -> None:
    assert is_oauth_allowed_for_country('RU') is False
    assert is_oauth_allowed_for_country('DE') is True
    assert is_oauth_allowed_for_country(None) is True


def test_resolve_country_from_cloudflare_header() -> None:
    class FakeRequest:
        headers = {'cf-ipcountry': 'RU'}

    assert resolve_country_from_headers(FakeRequest()) == 'RU'


@pytest.mark.asyncio
async def test_lookup_country_code_uses_override() -> None:
    code = await lookup_country_code('8.8.8.8', override='RU')
    assert code == 'RU'


def test_auth_country_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('GEO_COUNTRY_OVERRIDE', 'RU')
    get_settings.cache_clear()

    response = client.get('/api/auth/country')
    assert response.status_code == 200
    body = response.json()
    assert body['country_code'] == 'RU'
    assert body['oauth_allowed'] is False

    get_settings.cache_clear()
