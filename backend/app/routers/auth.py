"""Маршруты аутентификации."""

import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.auth import get_current_user_id
from app.auth_service import get_profile, login_user, register_user
from app.config import Settings, get_settings
from app.schemas import LoginRequest, ProfileResponse, RegisterRequest, TokenResponse
from app.storage import UserRecord

router = APIRouter(prefix='/auth', tags=['Auth'])

_AUTH_RATE_WINDOW_SECONDS = 60
_AUTH_RATE_MAX_ATTEMPTS = 10
_auth_rate_store: dict[str, list[float]] = {}


def _assert_auth_rate_limit(client_ip: str) -> None:
    now = time.time()
    window_start = now - _AUTH_RATE_WINDOW_SECONDS
    hits = [hit for hit in _auth_rate_store.get(client_ip, []) if hit > window_start]
    if len(hits) >= _AUTH_RATE_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail='Слишком много попыток. Подождите минуту.',
        )
    hits.append(now)
    _auth_rate_store[client_ip] = hits


@router.post('/register', response_model=TokenResponse)
def register(
    data: RegisterRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    client_ip = request.client.host if request.client else 'unknown'
    _assert_auth_rate_limit(client_ip)
    return register_user(data, settings)


@router.post('/login', response_model=TokenResponse)
def login(
    data: LoginRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    client_ip = request.client.host if request.client else 'unknown'
    _assert_auth_rate_limit(client_ip)
    return login_user(data, settings)


@router.get('/me', response_model=ProfileResponse)
def me(user_id: UUID = Depends(get_current_user_id)) -> ProfileResponse:
    user: UserRecord = get_profile(user_id)
    return ProfileResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
    )
