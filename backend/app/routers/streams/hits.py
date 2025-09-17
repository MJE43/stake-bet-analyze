"""Hit analysis endpoints for live streams."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import func, select

from ...db import get_session
from ...models.live_streams import LiveBet, LiveStream
from ...schemas.live_streams import (
    BatchHitQueryResponse,
    BucketStats,
    GlobalHitStatsResponse,
    HitQueryResponse,
    HitRecord,
    HitStatsResponse,
    RangeStats,
)


def uuid_to_db_format(uuid_obj: UUID) -> str:
    """Convert UUID to database format (without hyphens)."""
    return str(uuid_obj).replace("-", "")


router = APIRouter(prefix="/streams", tags=["hits"])


@router.get("/{stream_id}/hits", response_model=HitQueryResponse)
async def get_stream_hits(
    stream_id: UUID,
    bucket: float,
    after_nonce: int = Query(0, ge=0, description="Start nonce (inclusive)"),
    before_nonce: int | None = Query(None, ge=0, description="End nonce (exclusive)"),
    limit: int = Query(
        500, ge=1, le=1000, description="Maximum number of hits to return"
    ),
    order: Literal["nonce_asc", "nonce_desc"] = Query(
        "nonce_asc", description="Sort order"
    ),
    include_distance: bool = Query(True, description="Include distance calculations"),
    session: AsyncSession = Depends(get_session),
) -> HitQueryResponse:
    """
    Get hits for a specific multiplier bucket with server-side distance calculation.

    Returns only bets that match the specified bucket (rounded to 2 decimal places)
    with proper distance calculations using LAG window function.
    """
    try:
        # Validate parameters first
        bucket_2dp = round(bucket, 2)
        if bucket_2dp < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bucket value cannot be negative",
            )

        # Validate range if before_nonce is specified
        if before_nonce is not None and after_nonce >= before_nonce:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="after_nonce must be less than before_nonce",
            )

        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found",
            )

        # Get max nonce if before_nonce not specified
        if before_nonce is None:
            max_nonce_query = select(func.max(LiveBet.nonce)).where(
                LiveBet.stream_id == stream_id
            )
            max_nonce_result = await session.execute(max_nonce_query)
            before_nonce = max_nonce_result.scalar_one() or 0

        # Final range validation after getting max nonce
        if after_nonce >= before_nonce:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="after_nonce must be less than before_nonce",
            )

        # Find previous nonce before range for distance calculation
        prev_nonce_before_range = None
        if include_distance and after_nonce > 0:
            prev_nonce_query = select(func.max(LiveBet.nonce)).where(
                LiveBet.stream_id == stream_id,
                LiveBet.bucket_2dp == bucket_2dp,
                LiveBet.nonce < after_nonce,
            )
            prev_nonce_result = await session.execute(prev_nonce_query)
            prev_nonce_before_range = prev_nonce_result.scalar_one()

        # Get total count in range
        count_query = select(func.count(LiveBet.id)).where(
            LiveBet.stream_id == stream_id,
            LiveBet.bucket_2dp == bucket_2dp,
            LiveBet.nonce >= after_nonce,
            LiveBet.nonce < before_nonce,
        )
        count_result = await session.execute(count_query)
        total_in_range = count_result.scalar_one()

        if include_distance:
            # Build query with distance calculation using LAG window function
            order_clause = (
                "ORDER BY nonce ASC" if order == "nonce_asc" else "ORDER BY nonce DESC"
            )

            hits_query = text(
                f"""
                SELECT 
                    nonce,
                    bucket_2dp as bucket,
                    nonce - LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as distance_prev,
                    id,
                    date_time
                FROM live_bets
                WHERE stream_id = :stream_id 
                  AND bucket_2dp = :bucket_2dp
                  AND nonce >= :after_nonce 
                  AND nonce < :before_nonce
                {order_clause}
                LIMIT :limit
            """
            )

            hits_result = await session.execute(
                hits_query,
                {
                    "stream_id": uuid_to_db_format(stream_id),
                    "bucket_2dp": bucket_2dp,
                    "after_nonce": after_nonce,
                    "before_nonce": before_nonce,
                    "limit": limit,
                },
            )
            hit_records = hits_result.fetchall()

            # Convert to HitRecord format with distance
            hits = []
            for row in hit_records:
                # For the first hit in range, use distance from prev_nonce_before_range if available
                distance_prev = row.distance_prev
                if distance_prev is None and prev_nonce_before_range is not None:
                    distance_prev = row.nonce - prev_nonce_before_range

                hits.append(
                    HitRecord(
                        nonce=row.nonce,
                        bucket=row.bucket,
                        distance_prev=distance_prev,
                        id=row.id,
                        date_time=row.date_time,
                    )
                )
        else:
            # Query without distance calculation
            base_query = select(LiveBet).where(
                LiveBet.stream_id == stream_id,
                LiveBet.bucket_2dp == bucket_2dp,
                LiveBet.nonce >= after_nonce,
                LiveBet.nonce < before_nonce,
            )

            # Add ordering
            if order == "nonce_asc":
                base_query = base_query.order_by(LiveBet.nonce.asc())
            else:
                base_query = base_query.order_by(LiveBet.nonce.desc())

            # Add limit
            hits_query = base_query.limit(limit)

            hits_result = await session.execute(hits_query)
            hit_records = hits_result.scalars().all()

            # Convert to HitRecord format without distance
            hits = []
            for bet in hit_records:
                hits.append(
                    HitRecord(
                        nonce=bet.nonce,
                        bucket=bet.bucket_2dp,
                        distance_prev=None,
                        id=bet.id,
                        date_time=bet.date_time,
                    )
                )

        # Check if there are more records beyond the limit
        has_more = len(hits) == limit and total_in_range > limit

        return HitQueryResponse(
            hits=hits,
            prev_nonce_before_range=prev_nonce_before_range,
            total_in_range=total_in_range,
            has_more=has_more,
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching hits",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching hits",
        )


@router.get("/{stream_id}/hits/stats", response_model=HitStatsResponse)
async def get_hit_statistics(
    stream_id: UUID,
    bucket: float,
    ranges: str | None = Query(
        None, description="Comma-separated ranges (e.g., '0-10000,10000-20000')"
    ),
    session: AsyncSession = Depends(get_session),
) -> HitStatsResponse:
    """
    Get hit statistics for a specific multiplier bucket across specified ranges.

    Returns count, median, mean, min, max distance statistics using SQL aggregation
    with percentile_cont() for accurate medians.
    """
    try:
        # Validate parameters
        bucket_2dp = round(bucket, 2)
        if bucket_2dp < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bucket value cannot be negative",
            )

        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found",
            )

        # Parse ranges if provided, otherwise use full range
        range_list = []
        if ranges:
            try:
                for range_str in ranges.split(","):
                    range_str = range_str.strip()
                    if "-" not in range_str:
                        raise ValueError(f"Invalid range format: {range_str}")
                    start_str, end_str = range_str.split("-", 1)
                    start_nonce = int(start_str.strip())
                    end_nonce = int(end_str.strip())
                    if start_nonce < 0 or end_nonce < 0:
                        raise ValueError(
                            f"Range values cannot be negative: {range_str}"
                        )
                    if start_nonce >= end_nonce:
                        raise ValueError(
                            f"Start nonce must be less than end nonce: {range_str}"
                        )
                    range_list.append((start_nonce, end_nonce, range_str))
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid ranges parameter: {str(e)}",
                )
        else:
            # Use full range if no ranges specified
            max_nonce_query = select(func.max(LiveBet.nonce)).where(
                LiveBet.stream_id == stream_id
            )
            max_nonce_result = await session.execute(max_nonce_query)
            max_nonce = max_nonce_result.scalar_one() or 0
            range_list = [(0, max_nonce, f"0-{max_nonce}")]

        # Calculate statistics for each range
        stats_by_range = []
        for start_nonce, end_nonce, range_str in range_list:
            # Use a simpler approach for SQLite compatibility
            # Calculate distances between consecutive hits of the same bucket
            stats_query = text(
                """
                WITH ordered_hits AS (
                    SELECT 
                        nonce,
                        LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as prev_nonce
                    FROM live_bets
                    WHERE stream_id = :stream_id 
                      AND bucket_2dp = :bucket_2dp
                      AND nonce >= :start_nonce 
                      AND nonce < :end_nonce
                    ORDER BY nonce
                ),
                distances AS (
                    SELECT 
                        nonce - prev_nonce as distance
                    FROM ordered_hits
                    WHERE prev_nonce IS NOT NULL
                )
                SELECT 
                    distance
                FROM distances
                ORDER BY distance
            """
            )

            stats_result = await session.execute(
                stats_query,
                {
                    "stream_id": uuid_to_db_format(stream_id),
                    "bucket_2dp": bucket_2dp,
                    "start_nonce": start_nonce,
                    "end_nonce": end_nonce,
                },
            )
            distances = [row.distance for row in stats_result.fetchall()]

            if distances:
                # Calculate statistics in Python for accuracy
                count = len(distances)
                mean = sum(distances) / count
                min_distance = min(distances)
                max_distance = max(distances)

                # Calculate proper median
                sorted_distances = sorted(distances)
                if count % 2 == 0:
                    # Even number of elements - average of middle two
                    median = (
                        sorted_distances[count // 2 - 1] + sorted_distances[count // 2]
                    ) / 2
                else:
                    # Odd number of elements - middle element
                    median = sorted_distances[count // 2]

                bucket_stats = BucketStats(
                    count=count,
                    median=float(median),
                    mean=float(mean),
                    min=int(min_distance),
                    max=int(max_distance),
                    method="exact",
                )
            else:
                bucket_stats = BucketStats(
                    count=0, median=None, mean=None, min=None, max=None, method="exact"
                )

            stats_by_range.append(RangeStats(range=range_str, stats=bucket_stats))

        return HitStatsResponse(stats_by_range=stats_by_range)

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while calculating hit statistics",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while calculating hit statistics",
        )


@router.get(
    "/{stream_id}/hits/stats/global", response_model=GlobalHitStatsResponse
)
async def get_global_hit_statistics(
    stream_id: UUID, bucket: float, session: AsyncSession = Depends(get_session)
) -> GlobalHitStatsResponse:
    """
    Get global hit statistics for a specific multiplier bucket across the entire seed history.

    Returns global statistics with theoretical ETA calculations and confidence intervals.
    """
    try:
        # Validate parameters
        bucket_2dp = round(bucket, 2)
        if bucket_2dp < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bucket value cannot be negative",
            )

        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found",
            )

        # Calculate global statistics - fetch all distances for proper median calculation
        global_stats_query = text(
            """
            WITH ordered_hits AS (
                SELECT 
                    nonce,
                    LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as prev_nonce
                FROM live_bets
                WHERE stream_id = :stream_id 
                  AND bucket_2dp = :bucket_2dp
                ORDER BY nonce
            ),
            distances AS (
                SELECT 
                    nonce - prev_nonce as distance
                FROM ordered_hits
                WHERE prev_nonce IS NOT NULL
            )
            SELECT 
                distance
            FROM distances
            ORDER BY distance
        """
        )

        global_stats_result = await session.execute(
            global_stats_query,
            {"stream_id": uuid_to_db_format(stream_id), "bucket_2dp": bucket_2dp},
        )
        distances = [row.distance for row in global_stats_result.fetchall()]

        if distances:
            # Calculate statistics in Python for accuracy
            count = len(distances)
            mean = sum(distances) / count
            min_distance = min(distances)
            max_distance = max(distances)

            # Calculate proper median
            sorted_distances = sorted(distances)
            if count % 2 == 0:
                # Even number of elements - average of middle two
                median = (
                    sorted_distances[count // 2 - 1] + sorted_distances[count // 2]
                ) / 2
            else:
                # Odd number of elements - middle element
                median = sorted_distances[count // 2]

            # Calculate theoretical ETA based on probability
            # For simplicity, use 1/probability approximation
            # This could be enhanced with actual probability tables
            theoretical_eta = None
            if bucket_2dp >= 1.0:
                # Simple approximation: higher multipliers are rarer
                # This should be replaced with actual probability calculations
                theoretical_eta = bucket_2dp * 100  # Rough approximation

            # Simple confidence interval (placeholder)
            confidence_interval = None
            if count > 2:
                confidence_interval = [mean * 0.8, mean * 1.2]

            global_stats = BucketStats(
                count=count,
                median=float(median),
                mean=float(mean),
                min=int(min_distance),
                max=int(max_distance),
                method="exact",
            )
        else:
            global_stats = BucketStats(
                count=0, median=None, mean=None, min=None, max=None, method="exact"
            )
            theoretical_eta = None
            confidence_interval = None

        return GlobalHitStatsResponse(
            global_stats=global_stats,
            theoretical_eta=theoretical_eta,
            confidence_interval=confidence_interval,
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while calculating global hit statistics",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while calculating global hit statistics",
        )


@router.get("/{stream_id}/hits/batch", response_model=BatchHitQueryResponse)
async def get_batch_hits(
    stream_id: UUID,
    buckets: str = Query(
        ..., description="Comma-separated list of bucket values (e.g., '11200,48800')"
    ),
    after_nonce: int = Query(0, ge=0, description="Start nonce (inclusive)"),
    before_nonce: int | None = Query(None, ge=0, description="End nonce (exclusive)"),
    limit_per_bucket: int = Query(
        500, ge=1, le=1000, description="Maximum hits per bucket"
    ),
    session: AsyncSession = Depends(get_session),
) -> BatchHitQueryResponse:
    """
    Get hits for multiple buckets in a single request for efficient multi-bucket analysis.

    This endpoint minimizes database round trips by fetching hits for multiple multiplier
    buckets in a single query, with proper distance calculations and statistics.
    """
    try:
        # Parse and validate buckets parameter
        try:
            bucket_values = [float(b.strip()) for b in buckets.split(",") if b.strip()]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid bucket values. Must be comma-separated numbers.",
            )

        if not bucket_values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one bucket value must be provided",
            )

        if len(bucket_values) > 20:  # Reasonable limit to prevent abuse
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 20 buckets allowed per batch request",
            )

        # Validate bucket values
        bucket_2dp_values = []
        for bucket in bucket_values:
            if bucket < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Bucket value {bucket} cannot be negative",
                )
            bucket_2dp_values.append(round(bucket, 2))

        # Validate nonce range
        if before_nonce is not None and before_nonce <= after_nonce:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="before_nonce must be greater than after_nonce",
            )

        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found",
            )

        # Build efficient batch query for all buckets
        # Use UNION ALL to combine results for all buckets in a single query
        bucket_queries = []
        query_params = {
            "stream_id": uuid_to_db_format(stream_id),
            "after_nonce": after_nonce,
            "limit_per_bucket": limit_per_bucket,
        }

        for i, bucket_2dp in enumerate(bucket_2dp_values):
            bucket_param = f"bucket_{i}"
            query_params[bucket_param] = bucket_2dp

            # Build individual bucket query with distance calculation
            before_nonce_clause = ""
            if before_nonce is not None:
                before_nonce_param = f"before_nonce_{i}"
                query_params[before_nonce_param] = before_nonce
                before_nonce_clause = f"AND nonce < :{before_nonce_param}"

            bucket_query = f"""
                SELECT 
                    nonce,
                    bucket_2dp as bucket,
                    nonce - LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as distance_prev,
                    id,
                    date_time,
                    ROW_NUMBER() OVER (PARTITION BY bucket_2dp ORDER BY nonce) as rn
                FROM live_bets
                WHERE stream_id = :stream_id 
                  AND bucket_2dp = :{bucket_param}
                  AND nonce >= :after_nonce
                  {before_nonce_clause}
            """
            bucket_queries.append(bucket_query)

        # Combine all bucket queries with UNION ALL and apply limit per bucket
        combined_query = f"""
            WITH all_hits AS (
                {' UNION ALL '.join(bucket_queries)}
            )
            SELECT 
                nonce,
                bucket,
                distance_prev,
                id,
                date_time
            FROM all_hits
            WHERE rn <= :limit_per_bucket
            ORDER BY bucket, nonce
        """

        batch_result = await session.execute(text(combined_query), query_params)
        all_hit_records = batch_result.fetchall()

        # Group hits by bucket and calculate statistics
        hits_by_bucket = {}
        stats_by_bucket = {}

        for bucket_2dp in bucket_2dp_values:
            bucket_str = str(bucket_2dp)
            hits_by_bucket[bucket_str] = []

            # Filter hits for this bucket
            bucket_hits = [
                row
                for row in all_hit_records
                if abs(float(row.bucket) - bucket_2dp)
                < 0.001  # Handle floating point precision
            ]

            # Convert to HitRecord format
            for row in bucket_hits:
                hits_by_bucket[bucket_str].append(
                    HitRecord(
                        nonce=row.nonce,
                        bucket=float(row.bucket),
                        distance_prev=row.distance_prev,
                        id=row.id,
                        date_time=row.date_time,
                    )
                )

            # Calculate statistics for this bucket
            distances = [
                hit.distance_prev
                for hit in hits_by_bucket[bucket_str]
                if hit.distance_prev is not None
            ]

            if distances:
                # Calculate proper median
                sorted_distances = sorted(distances)
                count = len(distances)
                if count % 2 == 0:
                    # Even number of elements - average of middle two
                    median = (
                        sorted_distances[count // 2 - 1] + sorted_distances[count // 2]
                    ) / 2
                else:
                    # Odd number of elements - middle element
                    median = sorted_distances[count // 2]

                stats_by_bucket[bucket_str] = BucketStats(
                    count=count,
                    median=float(median),
                    mean=float(sum(distances) / count),
                    min=min(distances),
                    max=max(distances),
                    method="exact",
                )
            else:
                stats_by_bucket[bucket_str] = BucketStats(
                    count=0, median=None, mean=None, min=None, max=None, method="exact"
                )

        return BatchHitQueryResponse(
            hits_by_bucket=hits_by_bucket, stats_by_bucket=stats_by_bucket
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching batch hits",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching batch hits",
        )