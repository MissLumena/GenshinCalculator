"""Определение страны пользователя по IP (для ограничения OAuth)."""

from __future__ import annotations

import ipaddress
import logging
from typing import Any

import httpx
from fastapi import Request

logger = logging.getLogger('genshin_api')

OAUTH_BLOCKED_COUNTRY_CODES = frozenset({'RU'})
OAUTH_PROVIDERS = frozenset({'google', 'apple'})


def normalize_country_code(value: object | None) -> str | None:
    if value is None:
        return None
    code = str(value).strip().upper()
    if len(code) != 2 or not code.isalpha():
        return None
    return code


def is_oauth_allowed_for_country(country_code: str | None) -> bool:
    normalized = normalize_country_code(country_code)
    if not normalized:
        return True
    return normalized not in OAUTH_BLOCKED_COUNTRY_CODES


def resolve_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get('x-forwarded-for') or request.headers.get('X-Forwarded-For')
    if forwarded:
        candidate = forwarded.split(',')[0].strip()
        if candidate:
            return candidate

    real_ip = request.headers.get('x-real-ip') or request.headers.get('X-Real-IP')
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return None


def resolve_country_from_headers(request: Request) -> str | None:
    """Cloudflare и некоторые прокси передают страну напрямую."""
    for header in ('cf-ipcountry', 'CF-IPCountry', 'X-Country-Code'):
        code = normalize_country_code(request.headers.get(header))
        if code:
            return code
    return None


def is_public_ip(ip: str | None) -> bool:
    if not ip:
        return False
    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (
        parsed.is_private
        or parsed.is_loopback
        or parsed.is_link_local
        or parsed.is_reserved
    )


async def lookup_country_code(
    ip: str | None,
    *,
    override: str | None = None,
    timeout_seconds: float = 3.0,
) -> str | None:
    override_code = normalize_country_code(override)
    if override_code:
        return override_code

    if not ip or not is_public_ip(ip):
        return None

    url = f'http://ip-api.com/json/{ip}?fields=status,countryCode'
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.get(url)
            response.raise_for_status()
            payload: dict[str, Any] = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning('Geo lookup failed for %s: %s', ip, exc)
        return None

    if payload.get('status') != 'success':
        return None

    return normalize_country_code(payload.get('countryCode'))


async def resolve_request_country(
    request: Request,
    *,
    override: str | None = None,
) -> str | None:
    header_country = resolve_country_from_headers(request)
    if header_country:
        return header_country

    ip = resolve_client_ip(request)
    return await lookup_country_code(ip, override=override)


def is_blocked_oauth_provider(provider: str | None) -> bool:
    if not provider:
        return False
    return provider.strip().lower() in OAUTH_PROVIDERS
