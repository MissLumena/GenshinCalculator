"""Публичные данные о доступности OAuth по региону."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.config import Settings, get_settings
from app.geo import is_oauth_allowed_for_country, resolve_request_country
from app.schemas import AuthCountryResponse

router = APIRouter(prefix='/auth', tags=['Auth'])


@router.get('/country', response_model=AuthCountryResponse)
async def read_auth_country(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> AuthCountryResponse:
    country_code = await resolve_request_country(
        request,
        override=settings.geo_country_override or None,
    )
    oauth_allowed = is_oauth_allowed_for_country(country_code)

    return AuthCountryResponse(
        country_code=country_code,
        oauth_allowed=oauth_allowed,
    )
