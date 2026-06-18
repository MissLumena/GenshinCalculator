"""Pydantic-схемы API."""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ArtifactSlot(str, Enum):
    FLOWER = 'flower'
    PLUME = 'plume'
    SANDS = 'sands'
    GOBLET = 'goblet'
    CIRCLET = 'circlet'


class SubstatEntry(BaseModel):
    stat: str
    value: float


class ArtifactSlotData(BaseModel):
    set_id: str
    main_stat: str
    substats: list[SubstatEntry] = Field(default_factory=list, max_length=4)


class ArtifactsMap(BaseModel):
    flower: ArtifactSlotData | None = None
    plume: ArtifactSlotData | None = None
    sands: ArtifactSlotData | None = None
    goblet: ArtifactSlotData | None = None
    circlet: ArtifactSlotData | None = None


# --- Auth ---


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    display_name: str | None = Field(default=None, max_length=100)


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'


class ProfileResponse(BaseModel):
    id: UUID
    email: str
    display_name: str | None
    created_at: datetime


# --- Catalog (public) ---


class GameCharacterResponse(BaseModel):
    id: str
    name_en: str
    name_ru: str
    element: str
    weapon: str
    rarity: int
    region: str


class ArtifactSetResponse(BaseModel):
    id: str
    name: str
    bonus_2pc: str
    bonus_4pc: str


# --- User characters ---


class UserCharacterCreate(BaseModel):
    game_character_id: str
    nickname: str | None = None
    level: int = Field(default=90, ge=1, le=90)
    atk_base: float = Field(default=0, ge=0)
    atk_bonus: float = Field(default=0, ge=0)
    hp: float = Field(default=0, ge=0)
    defense: float = Field(default=0, ge=0)
    em: float = Field(default=0, ge=0)
    energy_recharge: float = Field(default=100, ge=0)
    crit_rate: float = Field(default=5, ge=0, le=100)
    crit_dmg: float = Field(default=50, ge=0)
    constellation: int = Field(default=0, ge=0, le=6)
    artifacts: ArtifactsMap = Field(default_factory=ArtifactsMap)


class UserCharacterUpdate(BaseModel):
    nickname: str | None = None
    level: int | None = Field(default=None, ge=1, le=90)
    atk_base: float | None = Field(default=None, ge=0)
    atk_bonus: float | None = Field(default=None, ge=0)
    hp: float | None = Field(default=None, ge=0)
    defense: float | None = Field(default=None, ge=0)
    em: float | None = Field(default=None, ge=0)
    energy_recharge: float | None = Field(default=None, ge=0)
    crit_rate: float | None = Field(default=None, ge=0, le=100)
    crit_dmg: float | None = Field(default=None, ge=0)
    constellation: int | None = Field(default=None, ge=0, le=6)
    artifacts: ArtifactsMap | None = None


class UserCharacterResponse(BaseModel):
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
    created_at: datetime
    updated_at: datetime


# --- Teams ---


class TeamMemberInput(BaseModel):
    user_character_id: UUID
    slot_index: int = Field(ge=0, le=3)
    rotation_order: int = Field(ge=1, le=4)


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    rotation_seconds: float = Field(default=20, ge=1, le=300)
    members: list[TeamMemberInput] = Field(default_factory=list, max_length=4)

    @field_validator('members')
    @classmethod
    def validate_members(cls, members: list[TeamMemberInput]) -> list[TeamMemberInput]:
        if len(members) > 4:
            raise ValueError('Команда может содержать не более 4 персонажей')
        slots = [m.slot_index for m in members]
        if len(slots) != len(set(slots)):
            raise ValueError('slot_index должен быть уникальным')
        char_ids = [m.user_character_id for m in members]
        if len(char_ids) != len(set(char_ids)):
            raise ValueError('Один персонаж не может быть в команде дважды')
        return members


class TeamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    rotation_seconds: float | None = Field(default=None, ge=1, le=300)
    members: list[TeamMemberInput] | None = None


class TeamMemberResponse(BaseModel):
    id: UUID
    user_character_id: UUID
    slot_index: int
    rotation_order: int


class TeamResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    rotation_seconds: float
    members: list[TeamMemberResponse]
    created_at: datetime
    updated_at: datetime


# --- Builds (snapshots) ---


class BuildCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    source_user_character_id: UUID | None = None
    snapshot: dict[str, Any] | None = None
    team_snapshot: dict[str, Any] | None = None
    calculated_dps: dict[str, Any] | None = None


class BuildResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    game_character_id: str | None
    source_user_character_id: UUID | None
    snapshot: dict[str, Any]
    team_snapshot: dict[str, Any] | None
    calculated_dps: dict[str, Any] | None
    created_at: datetime


# --- Calculate (public, без сохранения) ---


class CalculateDpsRequest(BaseModel):
    level: int = Field(default=90, ge=1, le=90)
    atk_base: float = Field(default=300, ge=0)
    atk_bonus: float = Field(default=100, ge=0)
    crit_rate: float = Field(default=50, ge=0, le=100)
    crit_dmg: float = Field(default=120, ge=0)
    constellation: int = Field(default=0, ge=0, le=6)


class CalculateDpsResponse(BaseModel):
    total_dps: int
    skills: dict[str, Any]


class MessageResponse(BaseModel):
    detail: str


# --- Notion ---


class NotionSaveResultRequest(BaseModel):
    team_label: str = Field(min_length=1, max_length=500)
    total_dps: float = Field(gt=0)
    members: list[str] = Field(default_factory=list, max_length=4)
    levels_label: str = Field(default='', max_length=200)
    display_name: str | None = Field(default=None, max_length=100)

    @field_validator('members')
    @classmethod
    def trim_members(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item and item.strip()][:4]


class NotionResultItem(BaseModel):
    page_id: str
    user_label: str
    user_id: str
    team_label: str
    total_dps: float
    calculated_at: str | None = None
    levels_label: str = ''
    members: list[str] = Field(default_factory=list)


class NotionResultsResponse(BaseModel):
    items: list[NotionResultItem]
    unavailable: bool = False
    message: str | None = None


class NotionSaveResultResponse(BaseModel):
    item: NotionResultItem


class NotionWebhookResponse(BaseModel):
    status: str
    duplicate: bool = False
