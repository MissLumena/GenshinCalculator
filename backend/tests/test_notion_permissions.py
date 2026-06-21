"""Тесты прав на удаление Notion."""

from app.config import Settings
from app.notion_permissions import can_delete_notion_result


def test_only_configured_email_can_delete() -> None:
    settings = Settings(superuser_emails='kondratovic91@mail.ru')

    assert can_delete_notion_result('kondratovic91@mail.ru', settings) is True
    assert can_delete_notion_result('KONDRATOVIC91@MAIL.RU', settings) is True
    assert can_delete_notion_result('owner@example.com', settings) is False
    assert can_delete_notion_result(None, settings) is False
