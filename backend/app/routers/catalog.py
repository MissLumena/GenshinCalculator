"""Публичные справочники (без авторизации)."""

from fastapi import APIRouter, HTTPException, status

from app.catalog import ARTIFACT_SETS, GAME_CHARACTERS, find_artifact_set, find_game_character
from app.schemas import ArtifactSetResponse, GameCharacterResponse

router = APIRouter(prefix='/catalog', tags=['Catalog'])


@router.get('/characters', response_model=list[GameCharacterResponse])
def list_characters() -> list[GameCharacterResponse]:
    return [GameCharacterResponse(**c) for c in GAME_CHARACTERS]


@router.get('/characters/{character_id}', response_model=GameCharacterResponse)
def get_character(character_id: str) -> GameCharacterResponse:
    char = find_game_character(character_id)
    if char is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Character not found')
    return GameCharacterResponse(**char)


@router.get('/artifact-sets', response_model=list[ArtifactSetResponse])
def list_artifact_sets() -> list[ArtifactSetResponse]:
    return [
        ArtifactSetResponse(
            id=s['id'],
            name=s['name'],
            bonus_2pc=s['bonus_2pc'],
            bonus_4pc=s['bonus_4pc'],
        )
        for s in ARTIFACT_SETS
    ]


@router.get('/artifact-sets/{set_id}', response_model=ArtifactSetResponse)
def get_artifact_set(set_id: str) -> ArtifactSetResponse:
    artifact_set = find_artifact_set(set_id)
    if artifact_set is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Artifact set not found')
    return ArtifactSetResponse(
        id=artifact_set['id'],
        name=artifact_set['name'],
        bonus_2pc=artifact_set['bonus_2pc'],
        bonus_4pc=artifact_set['bonus_4pc'],
    )
