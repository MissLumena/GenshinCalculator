"""Тесты /api/me — права текущей сессии."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from jose import jwt

from app.config import Settings
from app.main import app
from app.supabase_auth import AuthUser, get_authenticated_user

client = TestClient(app)


def _hs256_token(
    secret: str,
    *,
    sub: str = 'user-1',
    email: str = 'tester@example.com',
    role: str | None = None,
) -> str:
    payload = {
        'sub': sub,
        'email': email,
        'aud': 'authenticated',
        'exp': datetime.now(timezone.utc) + timedelta(hours=1),
    }
    if role:
        payload['app_metadata'] = {'role': role}
    return jwt.encode(payload, secret, algorithm='HS256')


def test_me_requires_auth() -> None:
    response = client.get('/api/me')
    assert response.status_code == 401


def test_me_returns_delete_only_for_configured_email(monkeypatch) -> None:
    from app.config import get_settings

    monkeypatch.setenv('SUPERUSER_EMAILS', 'kondratovic91@mail.ru')
    get_settings.cache_clear()

    app.dependency_overrides[get_authenticated_user] = lambda: AuthUser(
        id='super-1',
        email='kondratovic91@mail.ru',
        role='user',
    )
    try:
        response = client.get('/api/me', headers={'Authorization': 'Bearer test-token'})
    finally:
        app.dependency_overrides.pop(get_authenticated_user, None)
        get_settings.cache_clear()

    assert response.status_code == 200
    body = response.json()
    assert body['can_delete_any_notion_result'] is True


def test_me_denies_delete_for_other_emails(monkeypatch) -> None:
    from app.config import get_settings

    monkeypatch.setenv('SUPERUSER_EMAILS', 'kondratovic91@mail.ru')
    get_settings.cache_clear()

    app.dependency_overrides[get_authenticated_user] = lambda: AuthUser(
        id='super-1',
        email='other@example.com',
        role='superuser',
    )
    try:
        response = client.get('/api/me', headers={'Authorization': 'Bearer test-token'})
    finally:
        app.dependency_overrides.pop(get_authenticated_user, None)
        get_settings.cache_clear()

    assert response.status_code == 200
    assert response.json()['can_delete_any_notion_result'] is False


def test_superuser_email_from_settings() -> None:
    from app.supabase_auth import decode_supabase_token

    settings = Settings(
        supabase_jwt_secret='test-jwt-secret',
        superuser_emails='owner@example.com',
    )
    token = _hs256_token('test-jwt-secret', email='owner@example.com')
    user = decode_supabase_token(token, settings)

    assert user.role == 'superuser'
    assert user.is_admin is True
