"""Снимки билдов для сравнения."""

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth import get_current_user_id
from app.schemas import BuildCreate, BuildResponse, MessageResponse
from app.services import create_build, delete_build, get_build, list_builds
from app.storage import BuildRecord

router = APIRouter(prefix='/builds', tags=['Builds'])


def _to_response(record: BuildRecord) -> BuildResponse:
    return BuildResponse(
        id=record.id,
        user_id=record.user_id,
        name=record.name,
        game_character_id=record.game_character_id,
        source_user_character_id=record.source_user_character_id,
        snapshot=record.snapshot,
        team_snapshot=record.team_snapshot,
        calculated_dps=record.calculated_dps,
        created_at=record.created_at,
    )


@router.get('', response_model=list[BuildResponse])
def get_builds(user_id: UUID = Depends(get_current_user_id)) -> list[BuildResponse]:
    return [_to_response(b) for b in list_builds(user_id)]


@router.post('', response_model=BuildResponse, status_code=status.HTTP_201_CREATED)
def post_build(
    data: BuildCreate,
    user_id: UUID = Depends(get_current_user_id),
) -> BuildResponse:
    return _to_response(create_build(user_id, data))


@router.get('/{build_id}', response_model=BuildResponse)
def get_build(
    build_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
) -> BuildResponse:
    return _to_response(get_build(user_id, build_id))


@router.delete('/{build_id}', response_model=MessageResponse)
def remove_build(
    build_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
) -> MessageResponse:
    delete_build(user_id, build_id)
    return MessageResponse(detail='Build deleted')
