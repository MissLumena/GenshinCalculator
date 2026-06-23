"""Точка входа FastAPI."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.notion_client import NotionApiError, NotionClient
from app.routers import (
    auth,
    auth_geo,
    auth_mailru,
    builds,
    calculate,
    catalog,
    characters,
    media,
    notion,
    session,
    teams,
)
from app.sentry import init_sentry

logger = logging.getLogger('genshin_api')
settings = get_settings()
init_sentry(settings)
static_dir = Path(__file__).resolve().parent.parent / 'static'


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logging.basicConfig(level=logging.INFO)
    if settings.notion_startup_check and settings.notion_secret and settings.notion_database_id:
        client = NotionClient(settings)
        try:
            client.verify_database()
            logger.info('Notion database connection verified')
        except NotionApiError as exc:
            logger.error('Notion startup check failed: %s', exc.message)
    yield


app = FastAPI(
    title=settings.app_name,
    description='API калькулятора DPS Genshin Impact. In-memory storage (dev).',
    version='0.1.0',
    docs_url='/docs',
    redoc_url='/redoc',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type', 'Accept'],
)

api = settings.api_prefix
app.include_router(auth.router, prefix=api)
app.include_router(auth_geo.router, prefix=api)
app.include_router(auth_mailru.router, prefix=api)
app.include_router(catalog.router, prefix=api)
app.include_router(characters.router, prefix=api)
app.include_router(teams.router, prefix=api)
app.include_router(builds.router, prefix=api)
app.include_router(calculate.router, prefix=api)
app.include_router(notion.router, prefix=api)
app.include_router(session.router, prefix=api)
app.include_router(media.router, prefix=api)

if static_dir.is_dir():
    app.mount('/tester', StaticFiles(directory=static_dir, html=True), name='tester')


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/')
def root() -> dict[str, str]:
    return {
        'message': settings.app_name,
        'docs': '/docs',
        'tester': '/tester/',
        'api': settings.api_prefix,
    }
