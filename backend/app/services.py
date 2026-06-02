"""Бизнес-логика и правила доступа (аналог RLS)."""

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status

from app.catalog import find_game_character
from app.schemas import (
    BuildCreate,
    TeamCreate,
    TeamMemberInput,
    TeamUpdate,
    UserCharacterCreate,
    UserCharacterUpdate,
)
from app.storage import (
    BuildRecord,
    TeamMemberRecord,
    TeamRecord,
    UserCharacterRecord,
    store,
    utc_now,
)


class NotFoundError(HTTPException):
    def __init__(self, detail: str = 'Not found') -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class ForbiddenError(HTTPException):
    def __init__(self, detail: str = 'Access denied') -> None:
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _artifacts_to_dict(artifacts: Any) -> dict[str, Any]:
    if artifacts is None:
        return {}
    if hasattr(artifacts, 'model_dump'):
        return artifacts.model_dump(exclude_none=True)
    return artifacts


def _character_to_snapshot(char: UserCharacterRecord) -> dict[str, Any]:
    return {
        'game_character_id': char.game_character_id,
        'nickname': char.nickname,
        'level': char.level,
        'atk_base': char.atk_base,
        'atk_bonus': char.atk_bonus,
        'hp': char.hp,
        'defense': char.defense,
        'em': char.em,
        'energy_recharge': char.energy_recharge,
        'crit_rate': char.crit_rate,
        'crit_dmg': char.crit_dmg,
        'constellation': char.constellation,
        'artifacts': char.artifacts,
    }


def _ensure_character_owner(character_id: UUID, user_id: UUID) -> UserCharacterRecord:
    char = store.characters.get(character_id)
    if char is None:
        raise NotFoundError('Character not found')
    if char.user_id != user_id:
        raise ForbiddenError('You can only access your own characters')
    return char


def _ensure_team_owner(team_id: UUID, user_id: UUID) -> TeamRecord:
    team = store.teams.get(team_id)
    if team is None:
        raise NotFoundError('Team not found')
    if team.user_id != user_id:
        raise ForbiddenError('You can only access your own teams')
    return team


def _ensure_build_owner(build_id: UUID, user_id: UUID) -> BuildRecord:
    build = store.builds.get(build_id)
    if build is None:
        raise NotFoundError('Build not found')
    if build.user_id != user_id:
        raise ForbiddenError('You can only access your own builds')
    return build


def _validate_members(user_id: UUID, members: list[TeamMemberInput]) -> None:
    for member in members:
        _ensure_character_owner(member.user_character_id, user_id)


def _build_member_records(team_id: UUID, members: list[TeamMemberInput]) -> list[TeamMemberRecord]:
    return [
        TeamMemberRecord(
            id=store.new_id(),
            team_id=team_id,
            user_character_id=m.user_character_id,
            slot_index=m.slot_index,
            rotation_order=m.rotation_order,
        )
        for m in members
    ]


# --- Characters ---


def list_characters(user_id: UUID) -> list[UserCharacterRecord]:
    return [c for c in store.characters.values() if c.user_id == user_id]


def create_character(user_id: UUID, data: UserCharacterCreate) -> UserCharacterRecord:
    if find_game_character(data.game_character_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unknown game character')

    record = UserCharacterRecord(
        id=store.new_id(),
        user_id=user_id,
        game_character_id=data.game_character_id,
        nickname=data.nickname,
        level=data.level,
        atk_base=data.atk_base,
        atk_bonus=data.atk_bonus,
        hp=data.hp,
        defense=data.defense,
        em=data.em,
        energy_recharge=data.energy_recharge,
        crit_rate=data.crit_rate,
        crit_dmg=data.crit_dmg,
        constellation=data.constellation,
        artifacts=_artifacts_to_dict(data.artifacts),
    )
    store.characters[record.id] = record
    return record


def get_character(user_id: UUID, character_id: UUID) -> UserCharacterRecord:
    return _ensure_character_owner(character_id, user_id)


def update_character(
    user_id: UUID,
    character_id: UUID,
    data: UserCharacterUpdate,
) -> UserCharacterRecord:
    char = _ensure_character_owner(character_id, user_id)
    updates = data.model_dump(exclude_unset=True)
    if 'artifacts' in updates and updates['artifacts'] is not None:
        updates['artifacts'] = _artifacts_to_dict(updates['artifacts'])
    for key, value in updates.items():
        setattr(char, key, value)
    char.updated_at = utc_now()
    return char


def delete_character(user_id: UUID, character_id: UUID) -> None:
    char = _ensure_character_owner(character_id, user_id)
    for team in store.teams.values():
        if any(m.user_character_id == character_id for m in team.members):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail='Character is used in a team. Remove from teams first.',
            )
    del store.characters[char.id]


# --- Teams ---


def list_teams(user_id: UUID) -> list[TeamRecord]:
    return [t for t in store.teams.values() if t.user_id == user_id]


def create_team(user_id: UUID, data: TeamCreate) -> TeamRecord:
    if data.members:
        _validate_members(user_id, data.members)

    team_id = store.new_id()
    record = TeamRecord(
        id=team_id,
        user_id=user_id,
        name=data.name,
        rotation_seconds=data.rotation_seconds,
        members=_build_member_records(team_id, data.members),
    )
    store.teams[record.id] = record
    return record


def get_team(user_id: UUID, team_id: UUID) -> TeamRecord:
    return _ensure_team_owner(team_id, user_id)


def update_team(user_id: UUID, team_id: UUID, data: TeamUpdate) -> TeamRecord:
    team = _ensure_team_owner(team_id, user_id)
    if data.name is not None:
        team.name = data.name
    if data.rotation_seconds is not None:
        team.rotation_seconds = data.rotation_seconds
    if data.members is not None:
        _validate_members(user_id, data.members)
        team.members = _build_member_records(team_id, data.members)
    team.updated_at = utc_now()
    return team


def delete_team(user_id: UUID, team_id: UUID) -> None:
    team = _ensure_team_owner(team_id, user_id)
    del store.teams[team.id]


# --- Builds ---


def list_builds(user_id: UUID) -> list[BuildRecord]:
    return [b for b in store.builds.values() if b.user_id == user_id]


def create_build(user_id: UUID, data: BuildCreate) -> BuildRecord:
    snapshot = data.snapshot
    game_character_id: str | None = None
    source_id = data.source_user_character_id

    if source_id is not None:
        char = _ensure_character_owner(source_id, user_id)
        snapshot = _character_to_snapshot(char)
        game_character_id = char.game_character_id
    elif snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Provide source_user_character_id or snapshot',
        )
    else:
        game_character_id = snapshot.get('game_character_id')

    record = BuildRecord(
        id=store.new_id(),
        user_id=user_id,
        name=data.name,
        game_character_id=game_character_id,
        source_user_character_id=source_id,
        snapshot=snapshot,
        team_snapshot=data.team_snapshot,
        calculated_dps=data.calculated_dps,
    )
    store.builds[record.id] = record
    return record


def get_build(user_id: UUID, build_id: UUID) -> BuildRecord:
    return _ensure_build_owner(build_id, user_id)


def delete_build(user_id: UUID, build_id: UUID) -> None:
    build = _ensure_build_owner(build_id, user_id)
    del store.builds[build.id]


# --- DPS (mock, как на фронте) ---


def calculate_dps(
    atk_base: float,
    atk_bonus: float,
    crit_rate: float,
    crit_dmg: float,
    constellation: int,
) -> dict[str, Any]:
    atk = atk_base + atk_bonus
    crit_mult = 1 + (crit_rate / 100) * (crit_dmg / 100)
    const_bonus = 1 + constellation * 0.05
    base = atk * crit_mult * const_bonus
    crit_factor = 1 + crit_dmg / 100

    return {
        'total_dps': round(base * 2.5),
        'skills': {
            'auto': {'normal': round(base * 0.8), 'crit': round(base * 0.8 * crit_factor)},
            'skill': {'normal': round(base * 1.5), 'crit': round(base * 1.5 * crit_factor)},
            'burst': {'normal': round(base * 3.2), 'crit': round(base * 3.2 * crit_factor)},
        },
    }
