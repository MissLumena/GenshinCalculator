"""CRUD команд пользователя."""

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth import get_current_user_id
from app.schemas import MessageResponse, TeamCreate, TeamMemberResponse, TeamResponse, TeamUpdate
from app.services import (
    create_team,
    delete_team,
    get_team,
    list_teams,
    update_team,
)
from app.storage import TeamRecord

router = APIRouter(prefix='/teams', tags=['Teams'])


def _to_response(record: TeamRecord) -> TeamResponse:
    return TeamResponse(
        id=record.id,
        user_id=record.user_id,
        name=record.name,
        rotation_seconds=record.rotation_seconds,
        members=[
            TeamMemberResponse(
                id=m.id,
                user_character_id=m.user_character_id,
                slot_index=m.slot_index,
                rotation_order=m.rotation_order,
            )
            for m in record.members
        ],
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.get('', response_model=list[TeamResponse])
def get_teams(user_id: UUID = Depends(get_current_user_id)) -> list[TeamResponse]:
    return [_to_response(t) for t in list_teams(user_id)]


@router.post('', response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def post_team(
    data: TeamCreate,
    user_id: UUID = Depends(get_current_user_id),
) -> TeamResponse:
    return _to_response(create_team(user_id, data))


@router.get('/{team_id}', response_model=TeamResponse)
def get_team(
    team_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
) -> TeamResponse:
    return _to_response(get_team(user_id, team_id))


@router.put('/{team_id}', response_model=TeamResponse)
def put_team(
    team_id: UUID,
    data: TeamUpdate,
    user_id: UUID = Depends(get_current_user_id),
) -> TeamResponse:
    return _to_response(update_team(user_id, team_id, data))


@router.delete('/{team_id}', response_model=MessageResponse)
def remove_team(
    team_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
) -> MessageResponse:
    delete_team(user_id, team_id)
    return MessageResponse(detail='Team deleted')
