"""In-memory хранилище (имитация БД до подключения Supabase/PostgreSQL)."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class UserRecord:
    id: UUID
    email: str
    password_hash: str
    display_name: str | None
    created_at: datetime = field(default_factory=utc_now)


@dataclass
class UserCharacterRecord:
    id: UUID
    user_id: UUID
    game_character_id: str
    nickname: str | None
    level: int
    atk_base: float
    atk_bonus: float
    hp: float
    defense: float
    em: float
    energy_recharge: float
    crit_rate: float
    crit_dmg: float
    constellation: int
    artifacts: dict[str, Any]
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass
class TeamMemberRecord:
    id: UUID
    team_id: UUID
    user_character_id: UUID
    slot_index: int
    rotation_order: int


@dataclass
class TeamRecord:
    id: UUID
    user_id: UUID
    name: str
    rotation_seconds: float
    members: list[TeamMemberRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass
class BuildRecord:
    id: UUID
    user_id: UUID
    name: str
    game_character_id: str | None
    source_user_character_id: UUID | None
    snapshot: dict[str, Any]
    team_snapshot: dict[str, Any] | None
    calculated_dps: dict[str, Any] | None
    created_at: datetime = field(default_factory=utc_now)


class MemoryStore:
    """Потокобезопасность не требуется для dev; при масштабировании заменить на БД."""

    def __init__(self) -> None:
        self.users: dict[UUID, UserRecord] = {}
        self.users_by_email: dict[str, UUID] = {}
        self.characters: dict[UUID, UserCharacterRecord] = {}
        self.teams: dict[UUID, TeamRecord] = {}
        self.builds: dict[UUID, BuildRecord] = {}

    def new_id(self) -> UUID:
        return uuid4()


store = MemoryStore()
