"""Структурированное логирование HTTP-запросов без чувствительных данных."""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Iterator

logger = logging.getLogger('genshin_api')


@contextmanager
def log_external_request(service: str, endpoint: str) -> Iterator[dict[str, object]]:
    """Логирует метаданные внешнего запроса: сервис, endpoint, статус, время."""
    started = time.perf_counter()
    meta: dict[str, object] = {
        'service': service,
        'endpoint': endpoint,
        'status': None,
        'duration_ms': None,
    }
    try:
        yield meta
    finally:
        meta['duration_ms'] = round((time.perf_counter() - started) * 1000, 2)
        logger.info(
            'external_request service=%s endpoint=%s status=%s duration_ms=%s',
            meta['service'],
            meta['endpoint'],
            meta['status'],
            meta['duration_ms'],
        )
