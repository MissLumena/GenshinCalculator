"""Прокси медиа-ресурсов (обход CORS в браузере)."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

router = APIRouter(prefix='/media', tags=['Media'])

FANDOM_API = 'https://genshin-impact.fandom.com/api.php'
WIKIA_BASE = 'https://static.wikia.nocookie.net'
WIKIA_PATH_PREFIX = '/gensin-impact/'
MAX_WIKIA_IMAGE_BYTES = 5 * 1024 * 1024
MAX_FANDOM_JSON_BYTES = 256 * 1024
ALLOWED_IMAGE_MEDIA_TYPES = frozenset({
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
})


def _read_limited(response, max_bytes: int) -> bytes:
    data = response.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail='Remote media too large',
        )
    return data


def _normalize_image_media_type(content_type: str | None) -> str:
    raw = (content_type or '').split(';', 1)[0].strip().lower()
    if raw == 'image/jpg':
        raw = 'image/jpeg'
    if raw not in ALLOWED_IMAGE_MEDIA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Unsupported remote media type',
        )
    return raw


def _normalize_constellation_name(name: str) -> str:
    return name.strip().replace("'", '')


def _resolve_fandom_shape_url(constellation_name: str) -> str | None:
    normalized = _normalize_constellation_name(constellation_name)
    if not normalized or normalized == '???':
        return None

    file_name = f'{normalized} Shape.png'
    title = f'File:{file_name.replace(" ", "_")}'
    params = urllib.parse.urlencode({
        'action': 'query',
        'format': 'json',
        'prop': 'imageinfo',
        'iiprop': 'url',
        'titles': title,
    })
    request = urllib.request.Request(
        f'{FANDOM_API}?{params}',
        headers={'User-Agent': 'GenshinCalculator/1.0'},
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            data = json.loads(_read_limited(response, MAX_FANDOM_JSON_BYTES).decode('utf-8'))
    except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError):
        return None
    except HTTPException:
        return None

    pages = data.get('query', {}).get('pages', {})
    for page in pages.values():
        imageinfo = page.get('imageinfo') or []
        if imageinfo and imageinfo[0].get('url'):
            return imageinfo[0]['url']
    return None


@router.get('/fandom-constellation-shape')
def fandom_constellation_shape(
    constellation: str = Query(..., min_length=1, max_length=120),
) -> dict[str, str | None]:
    name = constellation.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail='Constellation name required',
        )
    url = _resolve_fandom_shape_url(name)
    if not url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Constellation shape not found',
        )
    return {'url': url}


def _validate_wikia_path(path: str) -> str:
    normalized = path.strip()
    if not normalized.startswith(WIKIA_PATH_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid wikia path',
        )
    if '..' in normalized or '\\' in normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid wikia path',
        )
    return normalized


@router.get('/wikia-image')
def wikia_image(
    path: str = Query(..., min_length=10, max_length=500),
) -> Response:
    safe_path = _validate_wikia_path(path)
    url = f'{WIKIA_BASE}{safe_path}'
    request = urllib.request.Request(
        url,
        headers={'User-Agent': 'GenshinCalculator/1.0'},
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            content = _read_limited(response, MAX_WIKIA_IMAGE_BYTES)
            content_type = _normalize_image_media_type(response.headers.get('Content-Type'))
    except HTTPException:
        raise
    except urllib.error.HTTPError as error:
        raise HTTPException(
            status_code=error.code,
            detail='Wikia image not found',
        ) from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Failed to fetch wikia image',
        ) from error

    return Response(content=content, media_type=content_type)
