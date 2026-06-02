"""Маршруты аутентификации."""

from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth import get_current_user_id
from app.auth_service import get_profile, login_user, register_user
from app.config import Settings, get_settings
from app.schemas import LoginRequest, ProfileResponse, RegisterRequest, TokenResponse
from app.storage import UserRecord

router = APIRouter(prefix='/auth', tags=['Auth'])


@router.post('/register', response_model=TokenResponse)
def register(data: RegisterRequest, settings: Settings = Depends(get_settings)) -> TokenResponse:
    return register_user(data, settings)


@router.post('/login', response_model=TokenResponse)
def login(data: LoginRequest, settings: Settings = Depends(get_settings)) -> TokenResponse:
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
