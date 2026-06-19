"""Бизнес-логика сохранения и чтения результатов в Notion."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any

from app.config import Settings
from app.notion_client import NotionApiError, NotionClient
from app.notion_permissions import can_delete_notion_result
from app.schemas import NotionResultItem, NotionSaveResultRequest

logger = logging.getLogger('genshin_api')

PROP_USER = 'Пользователь'
PROP_TITLE = 'Name'
PROP_USER_ID = 'user_id'
PROP_TEAM = 'Команда'
PROP_TOTAL_DPS = 'Сумарный DPS'
PROP_DATE = 'Дата'
PROP_LEVELS = 'Уровни'
PROP_CHARS = ('Персонаж 1', 'Персонаж 2', 'Персонаж 3', 'Персонаж 4')


def _rich_text(value: str) -> dict[str, Any]:
    content = (value or '')[:2000]
    return {'rich_text': [{'type': 'text', 'text': {'content': content}}]}


def _title(value: str) -> dict[str, Any]:
    content = (value or 'Без названия')[:2000]
    return {'title': [{'type': 'text', 'text': {'content': content}}]}


def _number(value: float) -> dict[str, Any]:
    return {'number': float(value)}


def _date_value(value: date) -> dict[str, Any]:
    return {'date': {'start': value.isoformat()}}


def _read_text_prop(prop: dict[str, Any] | None) -> str:
    if not prop:
        return ''
    prop_type = prop.get('type')
    if prop_type == 'title':
        chunks = prop.get('title') or []
    elif prop_type == 'rich_text':
        chunks = prop.get('rich_text') or []
    else:
        chunks = prop.get('rich_text') or prop.get('title') or []
    return ''.join(chunk.get('plain_text', '') for chunk in chunks).strip()


def _read_number(prop: dict[str, Any] | None) -> float:
    if not prop:
        return 0.0
    value = prop.get('number')
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _read_date(prop: dict[str, Any] | None) -> str | None:
    if not prop:
        return None
    date_obj = prop.get('date') or {}
    return date_obj.get('start')


def _parse_levels_label(raw: str) -> tuple[str, list[str]]:
    text = (raw or '').strip()
    if '|' not in text:
        return text, []
    levels_part, ids_part = text.split('|', 1)
    character_ids = [item.strip() for item in ids_part.split(',') if item.strip()]
    return levels_part.strip(), character_ids[:4]


def build_notion_properties(
    payload: NotionSaveResultRequest,
    *,
    user_label: str,
    user_id: str,
    calculated_on: date | None = None,
) -> dict[str, Any]:
    calculated_on = calculated_on or datetime.now(timezone.utc).date()

    properties: dict[str, Any] = {
        PROP_TITLE: _title(payload.team_label or user_label),
        PROP_USER: _rich_text(user_label),
        PROP_USER_ID: _rich_text(user_id),
        PROP_TEAM: _rich_text(payload.team_label),
        PROP_TOTAL_DPS: _number(payload.total_dps),
        PROP_DATE: _date_value(calculated_on),
        PROP_LEVELS: _rich_text(payload.levels_label),
    }

    for index, prop_name in enumerate(PROP_CHARS):
        value = payload.members[index] if index < len(payload.members) else ''
        properties[prop_name] = _rich_text(value)

    return properties


def map_notion_page(page: dict[str, Any]) -> NotionResultItem:
    props = page.get('properties') or {}
    members = [_read_text_prop(props.get(name)) for name in PROP_CHARS]
    levels_label, character_ids = _parse_levels_label(_read_text_prop(props.get(PROP_LEVELS)))

    return NotionResultItem(
        page_id=page.get('id', ''),
        user_label=_read_text_prop(props.get(PROP_USER)),
        user_id=_read_text_prop(props.get(PROP_USER_ID)),
        team_label=_read_text_prop(props.get(PROP_TEAM)),
        total_dps=_read_number(props.get(PROP_TOTAL_DPS)),
        calculated_at=_read_date(props.get(PROP_DATE)),
        levels_label=levels_label,
        members=[member for member in members if member],
        character_ids=character_ids,
        notion_url=page.get('url'),
    )


class NotionService:
    def __init__(self, client: NotionClient) -> None:
        self._client = client

    def save_result(
        self,
        payload: NotionSaveResultRequest,
        *,
        user_label: str,
        user_id: str,
    ) -> NotionResultItem:
        if not isinstance(payload.total_dps, (int, float)):
            raise NotionApiError(400, 'Суммарный DPS должен быть числом')

        properties = build_notion_properties(payload, user_label=user_label, user_id=user_id)
        page = self._client.create_page(properties)
        return map_notion_page(page)

    def list_results(self) -> list[NotionResultItem]:
        pages = self._client.query_database()
        items: list[NotionResultItem] = []
        for page in pages:
            try:
                items.append(map_notion_page(page))
            except Exception:
                logger.exception('Skip invalid Notion page id=%s', page.get('id'))
        items.sort(key=lambda item: item.calculated_at or '', reverse=True)
        return items

    def delete_result(
        self,
        page_id: str,
        *,
        requester_email: str | None,
        settings: Settings,
    ) -> None:
        if not can_delete_notion_result(requester_email, settings):
            raise NotionApiError(403, 'Недостаточно прав для удаления')

        pages = self._client.query_database()
        target = next((page for page in pages if page.get('id') == page_id), None)
        if not target:
            raise NotionApiError(404, 'Запись не найдена')

        self._client.archive_page(page_id)
