"""HTTP-клиент Notion API с rate-limit и обработкой ошибок."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import httpx

from app.config import Settings
from app.logging_utils import log_external_request

logger = logging.getLogger('genshin_api')

NOTION_API_BASE = 'https://api.notion.com/v1'
MIN_REQUEST_INTERVAL_SEC = 0.34  # ~3 req/s


class NotionApiError(Exception):
    def __init__(self, status_code: int, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.retryable = retryable


class NotionClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = threading.Lock()
        self._last_request_at = 0.0

    @property
    def is_configured(self) -> bool:
        return bool(self._settings.notion_secret and self._settings.notion_database_id)

    def _headers(self) -> dict[str, str]:
        return {
            'Authorization': f'Bearer {self._settings.notion_secret}',
            'Notion-Version': self._settings.notion_version,
            'Content-Type': 'application/json',
        }

    def _throttle(self) -> None:
        with self._lock:
            elapsed = time.monotonic() - self._last_request_at
            if elapsed < MIN_REQUEST_INTERVAL_SEC:
                time.sleep(MIN_REQUEST_INTERVAL_SEC - elapsed)
            self._last_request_at = time.monotonic()

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not self._settings.notion_secret:
            raise NotionApiError(503, 'Notion integration is not configured')

        url = f'{NOTION_API_BASE}{path}'
        self._throttle()

        with log_external_request('notion', f'{method} {path}') as meta:
            try:
                response = httpx.request(
                    method,
                    url,
                    headers=self._headers(),
                    timeout=self._settings.notion_timeout_seconds,
                    **kwargs,
                )
            except httpx.HTTPError as exc:
                meta['status'] = 'network_error'
                logger.exception('Notion network error endpoint=%s', path)
                raise NotionApiError(503, 'Notion недоступен', retryable=True) from exc

            meta['status'] = response.status_code

            if response.status_code == 429:
                raise NotionApiError(
                    429,
                    'Превышен лимит запросов Notion',
                    retryable=True,
                )

            if response.status_code == 401:
                logger.error('Notion 401: invalid NOTION_SECRET')
                raise NotionApiError(401, 'Не удалось сохранить результат, повторите попытку позже')

            if response.status_code == 404:
                logger.error('Notion 404: check NOTION_DATABASE_ID and integration connection')
                raise NotionApiError(404, 'База Notion не найдена или интеграция не подключена')

            if response.status_code == 400:
                detail = 'Некорректные данные для Notion'
                try:
                    payload = response.json()
                    notion_message = payload.get('message')
                    if isinstance(notion_message, str) and notion_message.strip():
                        detail = notion_message.strip()
                except ValueError:
                    pass
                logger.error('Notion 400 on %s: %s', path, detail)
                raise NotionApiError(400, detail)

            if response.status_code >= 400:
                detail = 'Ошибка Notion API'
                try:
                    payload = response.json()
                    notion_message = payload.get('message')
                    if isinstance(notion_message, str) and notion_message.strip():
                        detail = notion_message.strip()
                except ValueError:
                    pass
                logger.error(
                    'Notion %s on %s: %s',
                    response.status_code,
                    path,
                    detail,
                )
                raise NotionApiError(
                    response.status_code,
                    detail,
                )

            if not response.content:
                return {}
            return response.json()

    def verify_database(self) -> None:
        db_id = self._settings.notion_database_id
        if not db_id:
            raise NotionApiError(503, 'NOTION_DATABASE_ID is not configured')
        self._request('GET', f'/databases/{db_id}')

    def create_page(self, properties: dict[str, Any]) -> dict[str, Any]:
        db_id = self._settings.notion_database_id
        if not db_id:
            raise NotionApiError(503, 'NOTION_DATABASE_ID is not configured')
        return self._request(
            'POST',
            '/pages',
            json={'parent': {'database_id': db_id}, 'properties': properties},
        )

    def query_database(self) -> list[dict[str, Any]]:
        db_id = self._settings.notion_database_id
        if not db_id:
            return []

        results: list[dict[str, Any]] = []
        payload: dict[str, Any] = {}
        while True:
            data = self._request('POST', f'/databases/{db_id}/query', json=payload)
            results.extend(data.get('results', []))
            if not data.get('has_more'):
                break
            payload = {'start_cursor': data.get('next_cursor')}
        return results

    def archive_page(self, page_id: str) -> None:
        self._request('PATCH', f'/pages/{page_id}', json={'archived': True})
