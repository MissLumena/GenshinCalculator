"""Точка входа FastAPI."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import auth, builds, calculate, catalog, characters, teams

settings = get_settings()
static_dir = Path(__file__).resolve().parent.parent / 'static'

app = FastAPI(
    title=settings.app_name,
    description='API калькулятора DPS Genshin Impact. In-memory storage (dev).',
    version='0.1.0',
    docs_url='/docs',
    redoc_url='/redoc',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

api = settings.api_prefix
app.include_router(auth.router, prefix=api)
app.include_router(catalog.router, prefix=api)
app.include_router(characters.router, prefix=api)
app.include_router(teams.router, prefix=api)
app.include_router(builds.router, prefix=api)
app.include_router(calculate.router, prefix=api)

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
