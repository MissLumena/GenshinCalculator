"""Настройки приложения из переменных окружения."""

import re
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_PROJECT_ROOT = _BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            _BACKEND_DIR / '.env',
            _PROJECT_ROOT / '.env',
        ),
        env_file_encoding='utf-8',
        extra='ignore',
    )
    app_host: str = '0.0.0.0'
    app_port: int = 8010
    app_debug: bool = True
    app_name: str = 'Genshin DPS Calculator API'
    api_prefix: str = '/api'

    cors_origins: str = 'http://localhost:5173'

    jwt_secret: str = 'dev-secret'
    jwt_algorithm: str = 'HS256'
    jwt_expire_minutes: int = 60 * 24 * 7

    supabase_jwt_secret: str = ''
    supabase_jwt_audience: bool = False

    notion_secret: str = ''
    notion_database_id: str = ''
    notion_version: str = '2022-06-28'
    notion_timeout_seconds: float = 15.0
    notion_webhook_secret: str = ''
    notion_startup_check: bool = True

    @field_validator('notion_database_id', mode='before')
    @classmethod
    def normalize_notion_database_id(cls, value: object) -> str:
        if value is None:
            return ''
        raw = str(value).strip()
        if not raw:
            return ''
        match = re.search(r'([a-fA-F0-9]{32})', raw)
        compact = match.group(1) if match else re.sub(r'[^a-fA-F0-9]', '', raw)
        if len(compact) != 32:
            return raw
        return (
            f'{compact[0:8]}-{compact[8:12]}-{compact[12:16]}-'
            f'{compact[16:20]}-{compact[20:32]}'
        ).lower()

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(',') if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
