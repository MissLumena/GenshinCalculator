"""Настройки приложения из переменных окружения."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore',
    )

    app_host: str = '0.0.0.0'
    app_port: int = 8000
    app_debug: bool = True
    app_name: str = 'Genshin DPS Calculator API'
    api_prefix: str = '/api'

    cors_origins: str = 'http://localhost:5173'

    jwt_secret: str = 'dev-secret'
    jwt_algorithm: str = 'HS256'
    jwt_expire_minutes: int = 60 * 24 * 7

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(',') if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
