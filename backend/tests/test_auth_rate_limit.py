from fastapi.testclient import TestClient

from app.main import app
from app.routers import auth as auth_router

client = TestClient(app)


def test_login_rate_limit_returns_429(monkeypatch):
    auth_router._auth_rate_store.clear()

    payload = {'email': 'user@example.com', 'password': 'secret123'}

    for _ in range(10):
        client.post('/api/auth/login', json=payload)

    response = client.post('/api/auth/login', json=payload)

    assert response.status_code == 429
    assert response.json()['detail'] == 'Слишком много попыток. Подождите минуту.'
