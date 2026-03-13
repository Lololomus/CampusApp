from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.auth_service import require_user
from app.database import get_db
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


def require_superadmin(user: models.User = Depends(require_user)) -> models.User:
    if user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin only")
    return user


@router.post("/events", response_model=schemas.AnalyticsEventsIngestResponse)
async def ingest_events(
    payload: schemas.AnalyticsEventsIngestRequest,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.ingest_events(db, user.id, payload.events)


@router.post("/reports/rebuild", response_model=schemas.AnalyticsRebuildResponse)
async def rebuild_report(
    report_date: date = Query(..., alias="date"),
    _: models.User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.rebuild_daily_report(db, report_date, generated_by="manual")


@router.get("/reports/latest", response_model=schemas.AnalyticsReportLatestResponse)
async def latest_report(_: models.User = Depends(require_superadmin)):
    data = analytics_service.get_latest_report_metadata()
    if not data:
        raise HTTPException(status_code=404, detail="No reports found")
    return data


@router.get("/reports/{report_date}")
async def get_report(report_date: date, _: models.User = Depends(require_superadmin)):
    try:
        return analytics_service.load_report_json(report_date)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Report not found")


@router.get("/reports/{report_date}/download")
async def download_report(
    report_date: date,
    format: Literal["json", "csv"] = Query("json"),
    _: models.User = Depends(require_superadmin),
):
    paths = analytics_service.get_report_paths_for_date(report_date)
    if format == "json":
        target = paths["json"]
        media = "application/json"
    else:
        target = paths["csv_zip"]
        media = "application/zip"

    if not target.exists():
        raise HTTPException(status_code=404, detail="Report file not found")

    return FileResponse(path=str(target), filename=target.name, media_type=media)


@router.get("/health", response_model=schemas.AnalyticsHealthResponse)
async def analytics_health(
    _: models.User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.get_analytics_health(db)
