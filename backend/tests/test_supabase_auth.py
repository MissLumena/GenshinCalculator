"""Тесты проверки Supabase JWT."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi import HTTPException
from jose import jwt

from app.config import Settings
from app.supabase_auth import decode_supabase_token


def _settings(**overrides) -> Settings:
    base = {
        'supabase_jwt_secret': 'test-jwt-secret',
        'supabase_url': 'https://example.supabase.co',
        'supabase_anon_key': 'anon-key',
    }
    base.update(overrides)
    return Settings(**base)


def _hs256_token(secret: str, *, sub: str = 'user-1', email: str = 'tester@example.com') -> str:
    payload = {
        'sub': sub,
        'email': email,
        'aud': 'authenticated',
        'exp': datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, secret, algorithm='HS256')


def test_decode_hs256_token_with_secret() -> None:
    token = _hs256_token('test-jwt-secret')
    user = decode_supabase_token(token, _settings())

    assert user.id == 'user-1'
    assert user.email == 'tester@example.com'
    assert user.role == 'user'


def test_decode_falls_back_to_supabase_auth_api(monkeypatch: pytest.MonkeyPatch) -> None:
    token = _hs256_token('different-secret')
    settings = _settings(supabase_jwt_secret='test-jwt-secret')

    def fake_get(url: str, **kwargs):
        assert url.endswith('/auth/v1/user')
        assert kwargs['headers']['Authorization'] == f'Bearer {token}'
        request = httpx.Request('GET', url)
        return httpx.Response(
            200,
            json={
                'id': 'user-42',
                'email': 'api@example.com',
                'app_metadata': {'role': 'admin'},
            },
            request=request,
        )

    monkeypatch.setattr('app.supabase_auth.httpx.get', fake_get)

    user = decode_supabase_token(token, settings)
    assert user.id == 'user-42'
    assert user.email == 'api@example.com'
    assert user.role == 'admin'


def test_decode_rejects_invalid_token_without_fallback() -> None:
    settings = _settings(supabase_anon_key='')
    token = _hs256_token('different-secret')

    with pytest.raises(HTTPException) as exc:
        decode_supabase_token(token, settings)

    assert exc.value.status_code == 401
    assert exc.value.detail == 'Invalid or expired token'


def test_decode_maps_supabase_forbidden_to_unauthorized(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _settings(supabase_jwt_secret='')

    def fake_get(url: str, **kwargs):
        request = httpx.Request('GET', url)
        return httpx.Response(403, json={'error_code': 'bad_jwt'}, request=request)

    monkeypatch.setattr('app.supabase_auth.httpx.get', fake_get)

    with pytest.raises(HTTPException) as exc:
        decode_supabase_token(_hs256_token('different-secret'), settings)

    assert exc.value.status_code == 401


def test_decode_requires_configuration() -> None:
    settings = _settings(
        supabase_jwt_secret='',
        supabase_url='',
        supabase_anon_key='',
    )

    with pytest.raises(HTTPException) as exc:
        decode_supabase_token('token', settings)

    assert exc.value.status_code == 503


def test_decode_promotes_configured_superuser_email() -> None:
    token = _hs256_token('test-jwt-secret', email='owner@example.com')
    settings = _settings(superuser_emails='owner@example.com, admin@example.com')

    user = decode_supabase_token(token, settings)

    assert user.role == 'superuser'
    assert user.is_admin is True
