from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, models, schemas
from app.auth_service import require_user
from app.database import get_db


router = APIRouter(prefix="/referrals", tags=["referrals"])


@router.get("/me", response_model=schemas.ReferralSummary)
async def get_my_referrals(
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_referral_summary(db, user)
