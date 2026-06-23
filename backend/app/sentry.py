"""Настройка Sentry для FastAPI."""

from __future__ import annotations

import logging

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

from app.config import Settings


def _clamp_sample_rate(value: float) -> float:
    return min(max(value, 0.0), 1.0)


def init_sentry(settings: Settings) -> bool:
    """Инициализирует Sentry, если задан DSN."""
    dsn = settings.sentry_dsn.strip()
    if not dsn:
        return False

    environment = settings.sentry_environment.strip()
    if not environment:
        environment = 'development' if settings.app_debug else 'production'

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        traces_sample_rate=_clamp_sample_rate(settings.sentry_traces_sample_rate),
        send_default_pii=False,
        integrations=[
            FastApiIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
    )
    return True
