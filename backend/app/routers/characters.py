"""CRUD настроенных персонажей пользователя."""

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth import get_current_user_id
from app.schemas import (
    MessageResponse,
    UserCharacterCreate,
    UserCharacterResponse,
    UserCharacterUpdate,
)
from app.services import (
    create_character,
    delete_character,
    get_character as get_character_record,
    list_characters,
    update_character,
)
from app.storage import UserCharacterRecord

router = APIRouter(prefix='/characters', tags=['Characters'])


def _to_response(record: UserCharacterRecord) -> UserCharacterResponse:
    return UserCharacterResponse(
        id=record.id,
        user_id=record.user_id,
        game_character_id=record.game_character_id,
        nickname=record.nickname,
        level=record.level,
        atk_base=record.atk_base,
        atk_bonus=record.atk_bonus,
        hp=record.hp,
        defense=record.defense,
        em=record.em,
        energy_recharge=record.energy_recharge,
        crit_rate=record.crit_rate,
        crit_dmg=record.crit_dmg,
        constellation=record.constellation,
        artifacts=record.artifacts,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.get('', response_model=list[UserCharacterResponse])
def get_characters(user_id: UUID = Depends(get_current_user_id)) -> list[UserCharacterResponse]:
    return [_to_response(c) for c in list_characters(user_id)]


@router.post('', response_model=UserCharacterResponse, status_code=status.HTTP_201_CREATED)
def post_character(
    data: UserCharacterCreate,
    user_id: UUID = Depends(get_current_user_id),
) -> UserCharacterResponse:
    return _to_response(create_character(user_id, data))


@router.get('/{character_id}', response_model=UserCharacterResponse)
def get_character(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
) -> UserCharacterResponse:
    return _to_response(get_character_record(user_id, character_id))


@router.put('/{character_id}', response_model=UserCharacterResponse)
def put_character(
    character_id: UUID,
    data: UserCharacterUpdate,
    user_id: UUID = Depends(get_current_user_id),
) -> UserCharacterResponse:
    return _to_response(update_character(user_id, character_id, data))


@router.delete('/{character_id}', response_model=MessageResponse)
def remove_character(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
) -> MessageResponse:
    delete_character(user_id, character_id)
    return MessageResponse(detail='Character deleted')
