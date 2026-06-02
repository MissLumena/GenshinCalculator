"""Тесты API."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.storage import store

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_store() -> None:
    store.users.clear()
    store.users_by_email.clear()
    store.characters.clear()
    store.teams.clear()
    store.builds.clear()


def _register(email: str = 'test@example.com', password: str = 'secret12') -> str:
    response = client.post(
        '/api/auth/register',
        json={'email': email, 'password': password, 'display_name': 'Tester'},
    )
    assert response.status_code == 200
    return response.json()['access_token']


def test_health() -> None:
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_catalog_public() -> None:
    response = client.get('/api/catalog/characters')
    assert response.status_code == 200
    assert len(response.json()) >= 1


def test_anonymous_cannot_list_characters() -> None:
    response = client.get('/api/characters')
    assert response.status_code == 401


def test_calculate_dps_anonymous() -> None:
    response = client.post(
        '/api/calculate/dps',
        json={'atk_base': 300, 'atk_bonus': 100, 'crit_rate': 50, 'crit_dmg': 120},
    )
    assert response.status_code == 200
    assert response.json()['total_dps'] > 0


def test_character_crud_and_isolation() -> None:
    token_a = _register('user_a@example.com')
    token_b = _register('user_b@example.com')
    headers_a = {'Authorization': f'Bearer {token_a}'}
    headers_b = {'Authorization': f'Bearer {token_b}'}

    create = client.post(
        '/api/characters',
        headers=headers_a,
        json={'game_character_id': 'hu-tao', 'level': 90, 'crit_rate': 60},
    )
    assert create.status_code == 201
    char_id = create.json()['id']

    foreign = client.get(f'/api/characters/{char_id}', headers=headers_b)
    assert foreign.status_code == 403

    own = client.get(f'/api/characters/{char_id}', headers=headers_a)
    assert own.status_code == 200
    assert own.json()['game_character_id'] == 'hu-tao'


def test_team_and_build() -> None:
    token = _register('team@example.com')
    headers = {'Authorization': f'Bearer {token}'}

    char = client.post(
        '/api/characters',
        headers=headers,
        json={'game_character_id': 'ganyu', 'level': 80},
    )
    char_id = char.json()['id']

    team = client.post(
        '/api/teams',
        headers=headers,
        json={
            'name': 'Freeze',
            'rotation_seconds': 20,
            'members': [
                {'user_character_id': char_id, 'slot_index': 0, 'rotation_order': 1},
            ],
        },
    )
    assert team.status_code == 201

    build = client.post(
        '/api/builds',
        headers=headers,
        json={'name': 'Build A', 'source_user_character_id': char_id},
    )
    assert build.status_code == 201
    assert build.json()['snapshot']['game_character_id'] == 'ganyu'
