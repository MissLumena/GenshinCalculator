"""Тесты Notion API."""

from __future__ import annotations

import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.notion_service import NotionService
from app.routers import notion as notion_router
from app.schemas import NotionResultItem, NotionSaveResultRequest
from app.supabase_auth import AuthUser, get_authenticated_user

client = TestClient(app)


class FakeNotionService:
    def __init__(self) -> None:
        self.saved: list[NotionSaveResultRequest] = []
        self.items: list[NotionResultItem] = [
            NotionResultItem(
                page_id='page-1',
                user_label='Tester',
                user_id='user-1',
                team_label='Венти, Ху Тао',
                total_dps=12000,
                calculated_at='2026-06-14',
                levels_label='90, 90',
                members=['Венти C0 | АТК 2400', 'Ху Тао C1 | АТК 2600'],
            ),
        ]

    def save_result(self, payload, *, user_label, user_id):
        self.saved.append(payload)
        return NotionResultItem(
            page_id='page-new',
            user_label=user_label,
            user_id=user_id,
            team_label=payload.team_label,
            total_dps=payload.total_dps,
            calculated_at='2026-06-14',
            levels_label=payload.levels_label,
            members=payload.members,
        )

    def list_results(self):
        return self.items

    def delete_result(self, page_id, *, requester_id, requester_role):
        self.items = [item for item in self.items if item.page_id != page_id]


@pytest.fixture
def fake_service() -> FakeNotionService:
    return FakeNotionService()


@pytest.fixture(autouse=True)
def override_auth_and_service(fake_service: FakeNotionService):
    app.dependency_overrides[get_authenticated_user] = lambda: AuthUser(
        id='user-1',
        email='tester@example.com',
        role='user',
    )
    app.dependency_overrides[notion_router.get_notion_service] = lambda: fake_service
    yield
    app.dependency_overrides.clear()


def test_save_result_requires_auth(fake_service: FakeNotionService) -> None:
    app.dependency_overrides.pop(get_authenticated_user, None)
    response = client.post(
        '/api/notion/save-result',
        json={
            'team_label': 'Вентi',
            'total_dps': 5000,
            'members': ['Венти C0 | АТК 2400'],
            'levels_label': '90',
        },
    )
    assert response.status_code == 401
    assert len(fake_service.saved) == 0


def test_save_result_success(fake_service: FakeNotionService) -> None:
    response = client.post(
        '/api/notion/save-result',
        json={
            'team_label': 'Венти, Беннет',
            'total_dps': 8000,
            'members': ['Венти C0 | АТК 2400', 'Беннет C6 | АТК 1800'],
            'levels_label': '90, 90',
            'display_name': 'Tester',
        },
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response.status_code == 201
    body = response.json()
    assert body['item']['page_id'] == 'page-new'
    assert len(fake_service.saved) == 1


def test_list_results_public() -> None:
    response = client.get('/api/notion/results')
    assert response.status_code == 200
    body = response.json()
    items = body['items']
    assert len(items) == 1
    assert items[0]['team_label'] == 'Венти, Ху Тао'


def test_list_results_returns_notice_when_notion_errors(
    fake_service: FakeNotionService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.config import get_settings
    from app.notion_client import NotionApiError

    get_settings.cache_clear()
    settings = get_settings()
    settings.notion_secret = 'secret'
    settings.notion_database_id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

    def raise_notion_error(self):
        raise NotionApiError(500, 'internal server error')

    monkeypatch.setattr(FakeNotionService, 'list_results', raise_notion_error)

    response = client.get('/api/notion/results')
    assert response.status_code == 200
    body = response.json()
    assert body['items'] == []
    assert body['unavailable'] is True
    assert body['message']

    get_settings.cache_clear()


def test_delete_result_by_owner(fake_service: FakeNotionService) -> None:
    response = client.delete(
        '/api/notion/result/page-1',
        headers={'Authorization': 'Bearer test-token'},
    )
    assert response.status_code == 200
    assert len(fake_service.items) == 0


def test_webhook_signature_and_idempotency(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('NOTION_WEBHOOK_SECRET', 'whsec_test')
    from app.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    settings.notion_webhook_secret = 'whsec_test'

    payload = {'id': 'evt-1', 'type': 'page.created'}
    raw = json.dumps(payload).encode('utf-8')
    signature = 'sha256=' + hmac.new(b'whsec_test', raw, hashlib.sha256).hexdigest()

    first = client.post(
        '/api/notion/webhook',
        content=raw,
        headers={
            'Content-Type': 'application/json',
            'X-Notion-Signature': signature,
        },
    )
    assert first.status_code == 200
    assert first.json()['duplicate'] is False

    second = client.post(
        '/api/notion/webhook',
        content=raw,
        headers={
            'Content-Type': 'application/json',
            'X-Notion-Signature': signature,
        },
    )
    assert second.status_code == 200
    assert second.json()['duplicate'] is True

    get_settings.cache_clear()
