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

    sentry_dsn: str = ''
    sentry_environment: str = ''
    sentry_traces_sample_rate: float = 0.1

    jwt_secret: str
    jwt_algorithm: str = 'HS256'
    jwt_expire_minutes: int = 60 * 24 * 7

    supabase_jwt_secret: str = ''
    supabase_jwt_audience: bool = False
    supabase_url: str = ''
    supabase_anon_key: str = ''
    supabase_service_role_key: str = ''

    mailru_client_id: str = ''
    mailru_client_secret: str = ''
    # Должен совпадать с redirect URI в oauth.mail.ru / VK ID (localhost ≠ 127.0.0.1)
    mailru_redirect_uri: str = ''

    # VK ID (id.vk.com) — рекомендуемый вход через Mail.ru: provider=mail_ru
    # Если задан VK_ID_CLIENT_ID, используется VK ID вместо oauth.mail.ru
    vk_id_client_id: str = ''
    vk_id_service_token: str = ''

    notion_secret: str = ''
    notion_database_id: str = ''
    notion_version: str = '2022-06-28'
    notion_timeout_seconds: float = 15.0
    notion_webhook_secret: str = ''
    notion_startup_check: bool = True

    # Email через запятую — автоматически superuser (если role не задан в Supabase)
    superuser_emails: str = ''

    # Принудительная страна для dev (ISO 3166-1, напр. RU или DE)
    geo_country_override: str = ''

    @property
    def superuser_email_set(self) -> set[str]:
        return {
            email.strip().lower()
            for email in self.superuser_emails.split(',')
            if email.strip()
        }

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

    @property
    def mail_oauth_engine(self) -> str:
        if self.vk_id_client_id.strip():
            return 'vkid'
        return 'mailru'

    @property
    def mail_oauth_configured(self) -> bool:
        if self.mail_oauth_engine == 'vkid':
            return bool(self.vk_id_client_id.strip() and self.vk_id_service_token.strip())
        return bool(self.mailru_client_id.strip() and self.mailru_client_secret.strip())

    @property
    def resolved_mailru_redirect_uri(self) -> str:
        if self.mailru_redirect_uri.strip():
            return self.mailru_redirect_uri.strip().rstrip('/')

        for origin in self.cors_origin_list:
            if 'localhost' in origin.lower():
                return f'{origin.rstrip("/")}/api/auth/mailru/callback'

        if self.cors_origin_list:
            return f'{self.cors_origin_list[0].rstrip("/")}/api/auth/mailru/callback'

        return 'http://localhost:5173/api/auth/mailru/callback'


@lru_cache
def get_settings() -> Settings:
    return Settings()
