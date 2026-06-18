from app.notion_service import map_notion_page


def test_build_notion_properties_includes_title() -> None:
    from app.notion_service import PROP_TITLE, build_notion_properties
    from app.schemas import NotionSaveResultRequest

    props = build_notion_properties(
        NotionSaveResultRequest(
            team_label='Команда A',
            total_dps=1000,
            members=['X'],
            levels_label='90',
        ),
        user_label='Игрок',
        user_id='uid-1',
    )
    assert PROP_TITLE in props
    assert props[PROP_TITLE]['title'][0]['text']['content'] == 'Команда A'


def test_map_notion_page_reads_title_properties() -> None:
    page = {
        'id': 'page-1',
        'properties': {
            'Пользователь': {
                'type': 'title',
                'title': [{'plain_text': 'Игрок'}],
            },
            'user_id': {
                'type': 'rich_text',
                'rich_text': [{'plain_text': 'user-1'}],
            },
            'Команда': {
                'type': 'rich_text',
                'rich_text': [{'plain_text': 'Ху Тао, Беннет'}],
            },
            'Сумарный DPS': {
                'type': 'number',
                'number': 15000,
            },
            'Дата': {
                'type': 'date',
                'date': {'start': '2026-06-14'},
            },
            'Уровни': {
                'type': 'rich_text',
                'rich_text': [{'plain_text': '90, 90'}],
            },
            'Персонаж 1': {
                'type': 'rich_text',
                'rich_text': [{'plain_text': 'Ху Тао C1 | АТК 2400'}],
            },
        },
    }

    item = map_notion_page(page)
    assert item.user_label == 'Игрок'
    assert item.total_dps == 15000
    assert item.members == ['Ху Тао C1 | АТК 2400']
