"""Main router for live streams functionality."""

from fastapi import APIRouter

from . import analytics, bookmarks, hits, ingestion, management, snapshots

router = APIRouter(prefix="/live", tags=["live-streams"])

# Include all sub-routers
router.include_router(ingestion.router)
router.include_router(management.router)
router.include_router(analytics.router)
router.include_router(bookmarks.router)
router.include_router(snapshots.router)
router.include_router(hits.router)