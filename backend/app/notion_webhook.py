"""Webhook Notion: проверка подписи и идемпотентность."""

from __future__ import annotations

import hashlib
import hmac
import logging
import threading
import time
from collections import OrderedDict

from app.config import Settings

logger = logging.getLogger('genshin_api')

MAX_EVENT_CACHE = 1000
EVENT_TTL_SECONDS = 24 * 60 * 60


class WebhookVerificationError(Exception):
    pass


class ProcessedEventStore:
    """In-memory idempotency store for webhook delivery ids."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._events: OrderedDict[str, float] = OrderedDict()

    def _cleanup(self, now: float) -> None:
        expired = [event_id for event_id, ts in self._events.items() if now - ts > EVENT_TTL_SECONDS]
        for event_id in expired:
            self._events.pop(event_id, None)

    def seen(self, event_id: str) -> bool:
        now = time.time()
        with self._lock:
            self._cleanup(now)
            if event_id in self._events:
                return True
            self._events[event_id] = now
            while len(self._events) > MAX_EVENT_CACHE:
                self._events.popitem(last=False)
            return False


processed_events = ProcessedEventStore()


def verify_notion_signature(raw_body: bytes, signature_header: str | None, settings: Settings) -> None:
    secret = settings.notion_webhook_secret
    if not secret:
        raise WebhookVerificationError('NOTION_WEBHOOK_SECRET is not configured')

    if not signature_header:
        raise WebhookVerificationError('Missing signature header')

    expected = hmac.new(
        secret.encode('utf-8'),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    provided = signature_header.removeprefix('sha256=').strip()
    if not hmac.compare_digest(expected, provided):
        raise WebhookVerificationError('Invalid webhook signature')
