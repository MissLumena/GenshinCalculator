"""Тесты нормализации настроек."""

from app.config import Settings


def test_notion_database_id_from_page_url() -> None:
    url = (
        'https://app.notion.com/p/3832e193bd2380c2981ed7a45c413399'
        '?v=3832e193bd238004a674000cdb14bef1'
    )
    normalized = Settings.normalize_notion_database_id(url)
    assert normalized == '3832e193-bd23-80c2-981e-d7a45c413399'


def test_notion_database_id_from_dashed_uuid() -> None:
    raw = '3832E193-BD23-80C2-981E-D7A45C413399'
    normalized = Settings.normalize_notion_database_id(raw)
    assert normalized == '3832e193-bd23-80c2-981e-d7a45c413399'


def test_notion_database_id_empty() -> None:
    assert Settings.normalize_notion_database_id('') == ''
    assert Settings.normalize_notion_database_id(None) == ''
