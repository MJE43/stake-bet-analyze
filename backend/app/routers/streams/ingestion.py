"""Bet ingestion endpoints for live streams."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from ...core.config import get_settings
from ...core.rate_limiter import rate_limit_dependency
from ...db import get_session
from ...models.live_streams import LiveBet, LiveStream
from ...schemas.live_streams import IngestBetRequest, IngestResponse


def uuid_to_db_format(uuid_obj: UUID) -> str:
    """Convert UUID to database format (without hyphens)."""
    return str(uuid_obj).replace("-", "")


def verify_ingest_token(
    x_ingest_token: str | None = Header(None, alias="X-Ingest-Token")
) -> None:
    """Verify the ingest token if configured."""
    settings = get_settings()

    # If no token is configured, allow all requests
    if settings.ingest_token is None:
        return

    # If token is configured but not provided, reject
    if x_ingest_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Ingest-Token header is required",
        )

    # If token doesn't match, reject
    if x_ingest_token != settings.ingest_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ingest token"
        )


def get_rate_limit_dependency():
    """Get rate limit dependency with current settings."""
    settings = get_settings()
    return rate_limit_dependency(settings.ingest_rate_limit)


router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestResponse)
async def ingest_bet(
    bet_data: IngestBetRequest,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(verify_ingest_token),
    __: None = Depends(get_rate_limit_dependency()),
) -> IngestResponse:
    """
    Ingest bet data from Antebot with automatic stream management.

    Creates new streams for new seed pairs and handles duplicate bets idempotently.
    """
    try:
        # Parse datetime with UTC conversion and null fallback
        parsed_datetime = None
        if bet_data.dateTime:
            try:
                # Parse ISO datetime string and ensure UTC
                if bet_data.dateTime.endswith("Z"):
                    # Replace Z with +00:00 for proper ISO parsing
                    datetime_str = bet_data.dateTime.replace("Z", "+00:00")
                else:
                    datetime_str = bet_data.dateTime

                parsed_datetime = datetime.fromisoformat(datetime_str)

                if parsed_datetime.tzinfo is None:
                    # Assume UTC if no timezone info
                    parsed_datetime = parsed_datetime.replace(tzinfo=UTC)

                # Convert to UTC and remove timezone info for storage
                parsed_datetime = parsed_datetime.astimezone(UTC).replace(tzinfo=None)
            except (ValueError, TypeError):
                # On parsing failure, set to null and continue
                parsed_datetime = None

        # Find or create stream for this seed pair
        stream_query = select(LiveStream).where(
            LiveStream.server_seed_hashed == bet_data.serverSeedHashed,
            LiveStream.client_seed == bet_data.clientSeed,
        )
        result = await session.execute(stream_query)
        stream = result.scalar_one_or_none()

        if stream is None:
            # Create the stream and commit immediately to make it visible to others
            new_stream = LiveStream(
                server_seed_hashed=bet_data.serverSeedHashed,
                client_seed=bet_data.clientSeed,
                created_at=datetime.utcnow(),
                last_seen_at=datetime.utcnow(),
            )
            session.add(new_stream)
            try:
                await session.commit()
                # Re-select to avoid refresh race issues under concurrency
                result = await session.execute(stream_query)
                stream = result.scalar_one_or_none() or new_stream
            except IntegrityError:
                # Another request created it; rollback and fetch existing
                await session.rollback()
                result = await session.execute(stream_query)
                stream = (
                    result.scalar_one()
                )  # Should exist since another request created it

        # Check for duplicate bet (idempotent handling)
        duplicate_query = select(LiveBet).where(
            LiveBet.stream_id == stream.id, LiveBet.antebot_bet_id == bet_data.id
        )
        duplicate_result = await session.execute(duplicate_query)
        existing_bet = duplicate_result.scalar_one_or_none()

        if existing_bet is not None:
            # Duplicate bet - return success with accepted=false
            return IngestResponse(streamId=stream.id, accepted=False)

        # Create new bet record
        new_bet = LiveBet(
            stream_id=stream.id,
            antebot_bet_id=bet_data.id,
            received_at=datetime.utcnow(),
            date_time=parsed_datetime,
            nonce=bet_data.nonce,
            amount=bet_data.amount,
            payout=bet_data.payout,
            difficulty=bet_data.difficulty,
            round_target=bet_data.roundTarget,
            round_result=bet_data.roundResult,
        )

        # Update stream's last_seen_at timestamp using explicit UPDATE to avoid stale instance issues
        await session.execute(
            update(LiveStream)
            .where(LiveStream.id == stream.id)
            .values(last_seen_at=datetime.utcnow())
        )

        session.add(new_bet)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            error_msg = str(e.orig) if hasattr(e, "orig") else str(e)
            # Treat unique bet constraint as idempotent duplicate
            if (
                "idx_live_bets_unique_bet" in error_msg
                or "UNIQUE constraint failed: live_bets.stream_id, live_bets.antebot_bet_id"
                in error_msg
                or "unique constraint" in error_msg.lower()
            ):
                return IngestResponse(streamId=stream.id, accepted=False)
            raise

        return IngestResponse(streamId=stream.id, accepted=True)

    except HTTPException:
        # Re-raise HTTP exceptions (like validation errors)
        await session.rollback()
        raise
    except IntegrityError as e:
        # Handle database constraint violations
        await session.rollback()
        error_msg = str(e.orig) if hasattr(e, "orig") else str(e)

        # Check for specific constraint violations
        if "ck_live_bets_nonce_ge_1" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Nonce must be greater than or equal to 1",
            )
        elif "ck_live_bets_amount_ge_0" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Amount must be greater than or equal to 0",
            )
        elif "ck_live_bets_payout_ge_0" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Payout must be greater than or equal to 0",
            )
        elif "ck_live_bets_difficulty" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Difficulty must be one of: easy, medium, hard, expert",
            )
        elif "ck_live_bets_round_target_gt_0" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Round target must be greater than 0 if provided",
            )
        elif "ck_live_bets_round_result_ge_0" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Round result must be greater than or equal to 0",
            )
        elif (
            "UNIQUE constraint failed" in error_msg
            or "unique constraint" in error_msg.lower()
        ):
            # This shouldn't happen due to our duplicate check, but handle it gracefully
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bet with this ID already exists for this stream",
            )
        else:
            # Generic constraint violation
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Data validation failed: constraint violation",
            )
    except SQLAlchemyError:
        # Handle other database errors
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while processing request",
        )
    except Exception:
        # Handle any other unexpected errors
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing the request",
        )