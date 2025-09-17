"""Bookmark endpoints for live streams."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from ...db import get_session
from ...models.live_streams import LiveBet, LiveBookmark, LiveStream
from ...schemas.live_streams import (
    BookmarkCreate,
    BookmarkResponse,
    BookmarkUpdate,
)


router = APIRouter(prefix="/streams", tags=["bookmarks"])


@router.post("/{stream_id}/bookmarks", response_model=BookmarkResponse)
async def create_bookmark(
    stream_id: UUID,
    bookmark_data: BookmarkCreate,
    session: AsyncSession = Depends(get_session),
) -> BookmarkResponse:
    """
    Create a new bookmark for a specific bet in a stream.
    """
    try:
        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found",
            )

        # Verify the bet exists in the stream
        bet_query = select(LiveBet).where(
            LiveBet.stream_id == stream_id,
            LiveBet.nonce == bookmark_data.nonce,
            LiveBet.round_result == bookmark_data.multiplier,
        )
        bet_result = await session.execute(bet_query)
        bet = bet_result.scalar_one_or_none()

        if bet is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bet with nonce {bookmark_data.nonce} and multiplier {bookmark_data.multiplier} not found in stream",
            )

        # Check if bookmark already exists
        existing_bookmark_query = select(LiveBookmark).where(
            LiveBookmark.stream_id == stream_id,
            LiveBookmark.nonce == bookmark_data.nonce,
            LiveBookmark.multiplier == bookmark_data.multiplier,
        )
        existing_result = await session.execute(existing_bookmark_query)
        existing_bookmark = existing_result.scalar_one_or_none()

        if existing_bookmark is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bookmark already exists for this bet",
            )

        # Create new bookmark
        new_bookmark = LiveBookmark(
            stream_id=stream_id,
            nonce=bookmark_data.nonce,
            multiplier=bookmark_data.multiplier,
            note=bookmark_data.note,
            created_at=datetime.utcnow(),
        )

        session.add(new_bookmark)
        await session.commit()
        await session.refresh(new_bookmark)

        return BookmarkResponse(
            id=new_bookmark.id,
            stream_id=new_bookmark.stream_id,
            nonce=new_bookmark.nonce,
            multiplier=new_bookmark.multiplier,
            note=new_bookmark.note,
            created_at=new_bookmark.created_at,
        )

    except HTTPException:
        await session.rollback()
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating bookmark",
        )
    except Exception:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating bookmark",
        )


@router.get("/{stream_id}/bookmarks", response_model=list[BookmarkResponse])
async def list_bookmarks(
    stream_id: UUID, session: AsyncSession = Depends(get_session)
) -> list[BookmarkResponse]:
    """
    List all bookmarks for a specific stream.
    """
    try:
        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found",
            )

        # Get all bookmarks for the stream ordered by created_at DESC
        bookmarks_query = (
            select(LiveBookmark)
            .where(LiveBookmark.stream_id == stream_id)
            .order_by(LiveBookmark.created_at.desc())
        )

        bookmarks_result = await session.execute(bookmarks_query)
        bookmarks = bookmarks_result.scalars().all()

        # Convert to response format
        return [
            BookmarkResponse(
                id=bookmark.id,
                stream_id=bookmark.stream_id,
                nonce=bookmark.nonce,
                multiplier=bookmark.multiplier,
                note=bookmark.note,
                created_at=bookmark.created_at,
            )
            for bookmark in bookmarks
        ]

    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching bookmarks",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching bookmarks",
        )


@router.put("/bookmarks/{bookmark_id}", response_model=BookmarkResponse)
async def update_bookmark(
    bookmark_id: int,
    update_data: BookmarkUpdate,
    session: AsyncSession = Depends(get_session),
) -> BookmarkResponse:
    """
    Update a bookmark's note.
    """
    try:
        # Get the bookmark
        bookmark_query = select(LiveBookmark).where(LiveBookmark.id == bookmark_id)
        bookmark_result = await session.execute(bookmark_query)
        bookmark = bookmark_result.scalar_one_or_none()

        if bookmark is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bookmark with ID {bookmark_id} not found",
            )

        # Update the note
        bookmark.note = update_data.note

        session.add(bookmark)
        await session.commit()
        await session.refresh(bookmark)

        return BookmarkResponse(
            id=bookmark.id,
            stream_id=bookmark.stream_id,
            nonce=bookmark.nonce,
            multiplier=bookmark.multiplier,
            note=bookmark.note,
            created_at=bookmark.created_at,
        )

    except HTTPException:
        await session.rollback()
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating bookmark",
        )
    except Exception:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating bookmark",
        )


@router.delete("/bookmarks/{bookmark_id}")
async def delete_bookmark(
    bookmark_id: int, session: AsyncSession = Depends(get_session)
) -> dict:
    """
    Delete a bookmark.
    """
    try:
        # Get the bookmark
        bookmark_query = select(LiveBookmark).where(LiveBookmark.id == bookmark_id)
        bookmark_result = await session.execute(bookmark_query)
        bookmark = bookmark_result.scalar_one_or_none()

        if bookmark is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bookmark with ID {bookmark_id} not found",
            )

        # Delete the bookmark
        await session.delete(bookmark)
        await session.commit()

        return {"deleted": True, "bookmark_id": bookmark_id}

    except HTTPException:
        await session.rollback()
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while deleting bookmark",
        )
    except Exception:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting bookmark",
        )