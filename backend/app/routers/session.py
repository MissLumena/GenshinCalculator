"""Текущая Supabase-сессия и права пользователя."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.notion_permissions import can_delete_notion_result
from app.schemas import SessionPermissionsResponse
from app.supabase_auth import AuthenticatedUser

router = APIRouter(tags=['Session'])


@router.get('/me', response_model=SessionPermissionsResponse)
def read_session_permissions(
    user: AuthenticatedUser,
    settings: Settings = Depends(get_settings),
) -> SessionPermissionsResponse:
    can_delete = can_delete_notion_result(user.email, settings)
    return SessionPermissionsResponse(
        user_id=user.id,
        email=user.email,
        role=user.role,
        is_privileged=can_delete,
        can_delete_any_notion_result=can_delete,
    )
