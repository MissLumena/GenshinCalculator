"""Права на удаление записей Notion — только email из SUPERUSER_EMAILS."""

from __future__ import annotations

from app.config import Settings


def can_delete_notion_result(email: str | None, settings: Settings) -> bool:
    normalized = (email or '').strip().lower()
    if not normalized:
        return False
    return normalized in settings.superuser_email_set
