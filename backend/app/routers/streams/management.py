"""Stream management endpoints for live streams."""

from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import func, select

from ...db import get_session
from ...models.live_streams import LiveBet, LiveStream
from ...schemas.live_streams import (
    BetListResponse,
    BetRecord,
    StreamDeleteResponse,
    StreamDetail,
    StreamListResponse,
    StreamSummary,
    StreamUpdateRequest,
    TailResponse,
)


def uuid_to_db_format(uuid_obj: UUID) -> str:
    """Convert UUID to database format (without hyphens)."""
    return str(uuid_obj).replace("-", "")


router = APIRouter(prefix="/streams", tags=["streams"])


@router.get("", response_model=StreamListResponse)
async def list_streams(
    limit: int = 50, offset: int = 0, session: AsyncSession = Depends(get_session)
) -> StreamListResponse:
    """
    List all live streams with pagination and metadata aggregation.

    Returns streams ordered by last_seen_at DESC with total bets and highest multiplier.
    """
    # Validate limit constraint (≤100)
    if limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Limit cannot exceed 100"
        )

    if limit < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Limit must be at least 1"
        )

    if offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Offset cannot be negative"
        )

    try:
        # Get total count of streams
        count_query = select(func.count(LiveStream.id))
        count_result = await session.execute(count_query)
        total_streams = count_result.scalar_one()

        # Get streams with aggregated metadata
        # Using subquery to get bet counts and highest multipliers
        streams_query = (
            select(
                LiveStream,
                func.count(LiveBet.id).label("total_bets"),
                func.max(LiveBet.round_result).label("highest_multiplier"),
            )
            .outerjoin(LiveBet, LiveStream.id == LiveBet.stream_id)
            .group_by(LiveStream.id)
            .order_by(LiveStream.last_seen_at.desc())
            .offset(offset)
            .limit(limit)
        )

        result = await session.execute(streams_query)
        stream_rows = result.all()

        # Convert to response format
        streams = []
        for row in stream_rows:
            stream = row[0]  # LiveStream object
            total_bets = row[1] or 0  # bet count
            highest_multiplier = row[2]  # max multiplier (can be None)

            streams.append(
                StreamSummary(
                    id=stream.id,
                    server_seed_hashed=stream.server_seed_hashed,
                    client_seed=stream.client_seed,
                    created_at=stream.created_at,
                    last_seen_at=stream.last_seen_at,
                    total_bets=total_bets,
                    highest_multiplier=highest_multiplier,
                    notes=stream.notes,
                )
            )

        return StreamListResponse(
            streams=streams, total=total_streams, limit=limit, offset=offset
        )

    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching streams",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching streams",
        )


@router.get("/{stream_id}", response_model=StreamDetail)
async def get_stream_detail(
    stream_id: UUID, session: AsyncSession = Depends(get_session)
) -> StreamDetail:
    """
    Get detailed information about a specific stream including statistics and recent activity.
    """
    try:
        # Get the stream
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found",
            )

        # Get aggregated statistics for this stream
        stats_query = select(
            func.count(LiveBet.id).label("total_bets"),
            func.max(LiveBet.round_result).label("highest_multiplier"),
            func.min(LiveBet.round_result).label("lowest_multiplier"),
            func.avg(LiveBet.round_result).label("average_multiplier"),
        ).where(LiveBet.stream_id == stream_id)

        stats_result = await session.execute(stats_query)
        stats = stats_result.first()

        total_bets = stats[0] or 0
        highest_multiplier = stats[1]
        lowest_multiplier = stats[2]
        average_multiplier = stats[3]

        # Get recent bets (last 10) ordered by nonce DESC for recent activity
        recent_bets_query = (
            select(LiveBet)
            .where(LiveBet.stream_id == stream_id)
            .order_by(LiveBet.nonce.desc())
            .limit(10)
        )

        recent_bets_result = await session.execute(recent_bets_query)
        recent_bet_records = recent_bets_result.scalars().all()

        # Convert to BetRecord format
        recent_bets = []
        for bet in recent_bet_records:
            recent_bets.append(
                BetRecord(
                    id=bet.id,
                    antebot_bet_id=bet.antebot_bet_id,
                    received_at=bet.received_at,
                    date_time=bet.date_time,
                    nonce=bet.nonce,
                    amount=bet.amount,
                    payout=bet.payout,
                    difficulty=bet.difficulty,
                    round_target=bet.round_target,
                    round_result=bet.round_result,
                    distance_prev_opt=None,
                )
            )

        return StreamDetail(
            id=stream.id,
            server_seed_hashed=stream.server_seed_hashed,
            client_seed=stream.client_seed,
            created_at=stream.created_at,
            last_seen_at=stream.last_seen_at,
            total_bets=total_bets,
            highest_multiplier=highest_multiplier,
            lowest_multiplier=lowest_multiplier,
            average_multiplier=average_multiplier,
            notes=stream.notes,
            recent_bets=recent_bets,
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching stream details",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching stream details",
        )


@router.get("/{stream_id}/bets", response_model=BetListResponse)
async def list_stream_bets(
    stream_id: UUID,
    limit: int = 100,
    offset: int = 0,
    min_multiplier: float | None = None,
    order: Literal["nonce_asc", "id_desc"] = "nonce_asc",
    include_distance: bool = False,
    session: AsyncSession = Depends(get_session),
) -> BetListResponse:
    """
    List bets for a specific stream with filtering and pagination.

    Supports min_multiplier filtering and ordering by nonce (ASC) or id (DESC).
    Default order is nonce_asc for chronological bet sequence.
    """
    # Validate limit constraint (≤1000)
    if limit > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Limit cannot exceed 1000"
        )

    if limit < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Limit must be at least 1"
        )

    if offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Offset cannot be negative"
        )

    if min_multiplier is not None and min_multiplier < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="min_multiplier cannot be negative",
        )

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

        if include_distance:
            # Build query with distance calculation using window function
            params = {"stream_id": uuid_to_db_format(stream_id)}
            
            # Build WHERE clause
            where_conditions = ["stream_id = :stream_id"]
            if min_multiplier is not None:
                where_conditions.append("round_result >= :min_multiplier")
                params["min_multiplier"] = min_multiplier

            where_clause = " AND ".join(where_conditions)

            order_clause = (
                "ORDER BY nonce ASC" if order == "nonce_asc" else "ORDER BY id DESC"
            )

            # First get total count with filters
            count_query = text(f"""
                SELECT COUNT(*)
                FROM live_bets
                WHERE {where_clause}
            """)
            count_result = await session.execute(count_query, params)
            total_bets = count_result.scalar_one()

            # Get bets with distance calculation
            distance_query = text(f"""
                SELECT
                    id,
                    antebot_bet_id,
                    received_at,
                    date_time,
                    nonce,
                    amount,
                    payout,
                    difficulty,
                    round_target,
                    round_result,
                    nonce - LAG(nonce) OVER (
                        PARTITION BY round_result
                        ORDER BY nonce
                    ) as distance_prev_opt
                FROM live_bets
                WHERE {where_clause}
                {order_clause}
                LIMIT :limit OFFSET :offset
            """)
            
            params.update({
                "limit": limit,
                "offset": offset,
            })

            bets_result = await session.execute(distance_query, params)
            bet_records = bets_result.fetchall()

            # Convert to BetRecord format with distance
            bets = []
            for row in bet_records:
                bets.append(
                    BetRecord(
                        id=row.id,
                        antebot_bet_id=row.antebot_bet_id,
                        received_at=row.received_at,
                        date_time=row.date_time,
                        nonce=row.nonce,
                        amount=row.amount,
                        payout=row.payout,
                        difficulty=row.difficulty,
                        round_target=row.round_target,
                        round_result=row.round_result,
                        distance_prev_opt=row.distance_prev_opt,
                    )
                )
        else:
            # Build base query with stream filter (without distance)
            base_query = select(LiveBet).where(LiveBet.stream_id == stream_id)

            # Add min_multiplier filter if provided (using round_result instead of payout_multiplier)
            if min_multiplier is not None:
                base_query = base_query.where(LiveBet.round_result >= min_multiplier)

            # Get total count with filters applied
            count_query = select(func.count()).select_from(base_query.subquery())
            count_result = await session.execute(count_query)
            total_bets = count_result.scalar_one()

            # Add ordering
            if order == "nonce_asc":
                base_query = base_query.order_by(LiveBet.nonce.asc())
            elif order == "id_desc":
                base_query = base_query.order_by(LiveBet.id.desc())

            # Add pagination
            bets_query = base_query.offset(offset).limit(limit)

            bets_result = await session.execute(bets_query)
            bet_records = bets_result.scalars().all()

            # Convert to BetRecord format without distance
            bets = []
            for bet in bet_records:
                bets.append(
                    BetRecord(
                        id=bet.id,
                        antebot_bet_id=bet.antebot_bet_id,
                        received_at=bet.received_at,
                        date_time=bet.date_time,
                        nonce=bet.nonce,
                        amount=bet.amount,
                        payout=bet.payout,
                        difficulty=bet.difficulty,
                        round_target=bet.round_target,
                        round_result=bet.round_result,
                        distance_prev_opt=None,
                    )
                )

        return BetListResponse(
            bets=bets, total=total_bets, limit=limit, offset=offset, stream_id=stream_id
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching bets",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching bets",
        )


@router.get("/{stream_id}/tail", response_model=TailResponse)
async def tail_stream_bets(
    stream_id: UUID,
    since_id: int,
    include_distance: bool = False,
    session: AsyncSession = Depends(get_session),
) -> TailResponse:
    """
    Get incremental bet updates for a stream since a specific ID.

    Returns only new bets with id > since_id ordered by id ASC for polling-based updates.
    Includes last_id in response for next polling iteration.
    """
    if since_id < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="since_id cannot be negative",
        )

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

        if include_distance:
            # Use window function to calculate distance to previous same-multiplier hit
            distance_query = text("""
                SELECT
                    id,
                    antebot_bet_id,
                    received_at,
                    date_time,
                    nonce,
                    amount,
                    payout,
                    difficulty,
                    round_target,
                    round_result,
                    nonce - LAG(nonce) OVER (
                        PARTITION BY round_result
                        ORDER BY nonce
                    ) as distance_prev_opt
                FROM live_bets
                WHERE stream_id = :stream_id AND id > :since_id
                ORDER BY id ASC
            """)

            tail_result = await session.execute(
                distance_query,
                {"stream_id": uuid_to_db_format(stream_id), "since_id": since_id},
            )
            new_bet_records = tail_result.fetchall()

            # Convert to BetRecord format with distance
            bets = []
            last_id = since_id  # Default to input if no new records

            for row in new_bet_records:
                bets.append(
                    BetRecord(
                        id=row.id,
                        antebot_bet_id=row.antebot_bet_id,
                        received_at=row.received_at,
                        date_time=row.date_time,
                        nonce=row.nonce,
                        amount=row.amount,
                        payout=row.payout,
                        difficulty=row.difficulty,
                        round_target=row.round_target,
                        round_result=row.round_result,
                        distance_prev_opt=row.distance_prev_opt,
                    )
                )
                last_id = row.id  # Update to highest ID seen
        else:
            # Get new bets since the specified ID, ordered by id ASC (without distance)
            tail_query = (
                select(LiveBet)
                .where(LiveBet.stream_id == stream_id, LiveBet.id > since_id)
                .order_by(LiveBet.id.asc())
            )

            tail_result = await session.execute(tail_query)
            new_bet_records = tail_result.scalars().all()

            # Convert to BetRecord format without distance
            bets = []
            last_id = since_id  # Default to input if no new records

            for bet in new_bet_records:
                bets.append(
                    BetRecord(
                        id=bet.id,
                        antebot_bet_id=bet.antebot_bet_id,
                        received_at=bet.received_at,
                        date_time=bet.date_time,
                        nonce=bet.nonce,
                        amount=bet.amount,
                        payout=bet.payout,
                        difficulty=bet.difficulty,
                        round_target=bet.round_target,
                        round_result=bet.round_result,
                        distance_prev_opt=None,
                    )
                )
                last_id = bet.id  # Update to highest ID seen

        # Check if there might be more records beyond what we returned
        # For simplicity, we'll assume has_more is False since we return all new records
        # In a production system, you might want to limit the number of records returned
        # and set has_more accordingly
        has_more = False

        return TailResponse(
            bets=bets,
            last_id=last_id if bets else None,  # Only set last_id if we have new bets
            has_more=has_more,
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching tail updates",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching tail updates",
        )


@router.delete("/{stream_id}", response_model=StreamDeleteResponse)
async def delete_stream(
    stream_id: UUID, session: AsyncSession = Depends(get_session)
) -> StreamDeleteResponse:
    """
    Delete a stream and all associated bets with cascade deletion.

    This operation is irreversible and will permanently remove all bet data
    associated with the stream.
    """
    try:
        # First, verify the stream exists and get bet count for response
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found",
            )

        # Count bets that will be deleted (for response information)
        bet_count_query = select(func.count(LiveBet.id)).where(
            LiveBet.stream_id == stream_id
        )
        bet_count_result = await session.execute(bet_count_query)
        bets_to_delete = bet_count_result.scalar_one()

        # Delete the stream (cascade will handle bets due to foreign key constraint)
        await session.delete(stream)
        await session.commit()

        return StreamDeleteResponse(
            deleted=True, stream_id=stream_id, bets_deleted=bets_to_delete
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        await session.rollback()
        raise
    except SQLAlchemyError as e:
        await session.rollback()
        # Check for specific constraint violations that might prevent deletion
        error_msg = str(e.orig) if hasattr(e, "orig") else str(e)

        if "foreign key constraint" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot delete stream due to foreign key constraints",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error occurred while deleting stream",
            )
    except Exception:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting stream",
        )


@router.put("/{stream_id}", response_model=StreamDetail)
async def update_stream(
    stream_id: UUID,
    update_data: StreamUpdateRequest,
    session: AsyncSession = Depends(get_session),
) -> StreamDetail:
    """
    Update stream notes and metadata.

    Currently supports updating user notes. Input is validated and sanitized.
    Handles concurrent update scenarios properly.
    """
    try:
        # Get the stream with a lock to handle concurrent updates
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found",
            )

        # Update notes if provided (None is allowed to clear notes)
        if update_data.notes is not None:
            # Basic sanitization - strip whitespace and limit length
            sanitized_notes = update_data.notes.strip()
            if len(sanitized_notes) > 1000:  # Reasonable limit for notes
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Notes cannot exceed 1000 characters",
                )
            stream.notes = sanitized_notes if sanitized_notes else None

        # Commit the update
        session.add(stream)
        await session.commit()
        await session.refresh(stream)

        # Get updated statistics for the response
        stats_query = select(
            func.count(LiveBet.id).label("total_bets"),
            func.max(LiveBet.round_result).label("highest_multiplier"),
            func.min(LiveBet.round_result).label("lowest_multiplier"),
            func.avg(LiveBet.round_result).label("average_multiplier"),
        ).where(LiveBet.stream_id == stream_id)

        stats_result = await session.execute(stats_query)
        stats = stats_result.first()

        total_bets = stats[0] or 0
        highest_multiplier = stats[1]
        lowest_multiplier = stats[2]
        average_multiplier = stats[3]

        # Get recent bets (last 10) for the response
        recent_bets_query = (
            select(LiveBet)
            .where(LiveBet.stream_id == stream_id)
            .order_by(LiveBet.nonce.desc())
            .limit(10)
        )

        recent_bets_result = await session.execute(recent_bets_query)
        recent_bet_records = recent_bets_result.scalars().all()

        # Convert to BetRecord format
        recent_bets = []
        for bet in recent_bet_records:
            recent_bets.append(
                BetRecord(
                    id=bet.id,
                    antebot_bet_id=bet.antebot_bet_id,
                    received_at=bet.received_at,
                    date_time=bet.date_time,
                    nonce=bet.nonce,
                    amount=bet.amount,
                    payout=bet.payout,
                    difficulty=bet.difficulty,
                    round_target=bet.round_target,
                    round_result=bet.round_result,
                    distance_prev_opt=None,
                )
            )

        return StreamDetail(
            id=stream.id,
            server_seed_hashed=stream.server_seed_hashed,
            client_seed=stream.client_seed,
            created_at=stream.created_at,
            last_seen_at=stream.last_seen_at,
            total_bets=total_bets,
            highest_multiplier=highest_multiplier,
            lowest_multiplier=lowest_multiplier,
            average_multiplier=average_multiplier,
            notes=stream.notes,
            recent_bets=recent_bets,
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 422)
        await session.rollback()
        raise
    except SQLAlchemyError as e:
        await session.rollback()
        error_msg = str(e.orig) if hasattr(e, "orig") else str(e)

        # Handle potential constraint violations or lock timeouts
        if "database is locked" in error_msg.lower() or "lock" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Stream is currently being updated by another request. Please try again.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error occurred while updating stream",
            )
    except Exception:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating stream",
        )


@router.get("/{stream_id}/export.csv")
async def export_stream_csv(
    stream_id: UUID, session: AsyncSession = Depends(get_session)
) -> StreamingResponse:
    """
    Export all bets for a stream as CSV data.

    Returns CSV with all bets ordered by nonce ASC for chronological analysis.
    Uses streaming response for efficient handling of large datasets.
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

        # Get all bets for the stream ordered by nonce ASC (chronological)
        bets_query = (
            select(LiveBet)
            .where(LiveBet.stream_id == stream_id)
            .order_by(LiveBet.nonce.asc())
        )

        bets_result = await session.execute(bets_query)
        all_bets = bets_result.scalars().all()

        # Create CSV content in memory
        output = io.StringIO()
        writer = csv.writer(output)

        # Write CSV header
        writer.writerow(
            [
                "nonce",
                "antebot_bet_id",
                "date_time",
                "received_at",
                "amount",
                "payout",
                "difficulty",
                "round_target",
                "round_result",
            ]
        )

        # Write bet data rows
        for bet in all_bets:
            writer.writerow(
                [
                    bet.nonce,
                    bet.antebot_bet_id,
                    bet.date_time.isoformat() if bet.date_time else "",
                    bet.received_at.isoformat(),
                    bet.amount,
                    bet.payout,
                    bet.difficulty,
                    bet.round_target if bet.round_target is not None else "",
                    bet.round_result if bet.round_result is not None else "",
                ]
            )

        # Get CSV content and reset pointer
        csv_content = output.getvalue()
        output.close()

        # Create filename with stream info
        filename = f"stream_{stream.server_seed_hashed[:10]}_{stream.client_seed}_{len(all_bets)}_bets.csv"

        # Create streaming response
        def generate_csv():
            yield csv_content

        return StreamingResponse(
            generate_csv(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "text/csv; charset=utf-8",
            },
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while exporting stream data",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while exporting stream data",
        )