"""Расчёт DPS без сохранения (доступен анонимам)."""

from fastapi import APIRouter

from app.schemas import CalculateDpsRequest, CalculateDpsResponse
from app.services import calculate_dps

router = APIRouter(prefix='/calculate', tags=['Calculate'])


@router.post('/dps', response_model=CalculateDpsResponse)
def post_calculate_dps(data: CalculateDpsRequest) -> CalculateDpsResponse:
    result = calculate_dps(
        atk_base=data.atk_base,
        atk_bonus=data.atk_bonus,
        crit_rate=data.crit_rate,
        crit_dmg=data.crit_dmg,
        constellation=data.constellation,
    )
    return CalculateDpsResponse(total_dps=result['total_dps'], skills=result['skills'])
