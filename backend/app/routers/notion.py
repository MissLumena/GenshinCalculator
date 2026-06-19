"""REST API для сохранения результатов DPS в Notion."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.config import Settings, get_settings
from app.notion_client import NotionApiError, NotionClient
from app.notion_service import NotionService
from app.notion_webhook import (
    ProcessedEventStore,
    WebhookVerificationError,
    processed_events,
    verify_notion_signature,
)
from app.schemas import (
    MessageResponse,
    NotionResultsResponse,
    NotionSaveResultRequest,
    NotionSaveResultResponse,
    NotionWebhookResponse,
)
from app.supabase_auth import AuthUser, AuthenticatedUser

logger = logging.getLogger('genshin_api')

router = APIRouter(prefix='/notion', tags=['Notion'])


def get_notion_client(settings: Settings = Depends(get_settings)) -> NotionClient:
    return NotionClient(settings)


def get_notion_service(client: NotionClient = Depends(get_notion_client)) -> NotionService:
    return NotionService(client)


def _notion_list_error_message(error: NotionApiError) -> str:
    if error.status_code == 401:
        return 'Notion: неверный NOTION_SECRET'
    if error.status_code == 404:
        return 'Notion: база не найдена. Проверьте NOTION_DATABASE_ID и подключение интеграции'
    if error.status_code == 429:
        return 'Notion: превышен лимит запросов, попробуйте позже'
    return 'Notion временно недоступен'


def _map_notion_error(error: NotionApiError) -> HTTPException:
    if error.status_code == 401:
        detail = 'Не удалось сохранить результат, повторите попытку позже'
    elif error.status_code == 429:
        detail = 'Результат сохраняется, подождите'
    elif error.status_code == 403:
        detail = error.message
    elif error.status_code == 404:
        detail = 'Запись не найдена'
    else:
        detail = error.message
    return HTTPException(status_code=error.status_code, detail=detail)


def _user_label(user: AuthUser, _payload: NotionSaveResultRequest) -> str:
    if user.email:
        return user.email
    return user.id


@router.post('/save-result', response_model=NotionSaveResultResponse, status_code=status.HTTP_201_CREATED)
def save_result(
    payload: NotionSaveResultRequest,
    user: AuthenticatedUser,
    service: NotionService = Depends(get_notion_service),
) -> NotionSaveResultResponse:
    try:
        item = service.save_result(
            payload,
            user_label=_user_label(user, payload),
            user_id=user.id,
        )
    except NotionApiError as exc:
        raise _map_notion_error(exc) from exc
    return NotionSaveResultResponse(item=item)


@router.get('/results', response_model=NotionResultsResponse)
def list_results(
    _user: AuthenticatedUser,
    service: NotionService = Depends(get_notion_service),
    settings: Settings = Depends(get_settings),
) -> NotionResultsResponse:
    try:
        items = service.list_results()
    except NotionApiError as exc:
        logger.warning('Notion list unavailable: %s', exc.message)
        return NotionResultsResponse(
            items=[],
            unavailable=True,
            message=_notion_list_error_message(exc),
        )
    except Exception:
        logger.exception('Notion list failed unexpectedly')
        return NotionResultsResponse(
            items=[],
            unavailable=True,
            message='Notion временно недоступен',
        )

    if not settings.notion_secret or not settings.notion_database_id:
        missing = []
        if not settings.notion_secret:
            missing.append('NOTION_SECRET')
        if not settings.notion_database_id:
            missing.append('NOTION_DATABASE_ID')
        return NotionResultsResponse(
            items=[],
            unavailable=True,
            message=(
                f'Notion не настроен. Укажите {" и ".join(missing)} в backend/.env '
                'и перезапустите API (npm run dev:api)'
            ),
        )

    return NotionResultsResponse(items=items)


@router.delete('/result/{page_id}', response_model=MessageResponse)
def delete_result(
    page_id: str,
    user: AuthenticatedUser,
    service: NotionService = Depends(get_notion_service),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    try:
        service.delete_result(
            page_id,
            requester_email=user.email,
            settings=settings,
        )
    except NotionApiError as exc:
        raise _map_notion_error(exc) from exc
    return MessageResponse(detail='deleted')


@router.post('/webhook', response_model=NotionWebhookResponse)
async def notion_webhook(
    request: Request,
    settings: Settings = Depends(get_settings),
    event_store: ProcessedEventStore = Depends(lambda: processed_events),
) -> NotionWebhookResponse:
    raw_body = await request.body()
    signature = request.headers.get('X-Notion-Signature')

    try:
        verify_notion_signature(raw_body, signature, settings)
    except WebhookVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    try:
        payload = json.loads(raw_body.decode('utf-8'))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid JSON') from exc

    event_id = (
        payload.get('id')
        or request.headers.get('X-Notion-Delivery-Id')
        or request.headers.get('X-Request-Id')
    )
    if not event_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Missing event id')

    if event_store.seen(str(event_id)):
        logger.info('notion_webhook duplicate event_id=%s', event_id)
        return NotionWebhookResponse(status='ignored', duplicate=True)

    logger.info(
        'notion_webhook accepted event_id=%s type=%s',
        event_id,
        payload.get('type'),
    )
    return NotionWebhookResponse(status='accepted', duplicate=False)
