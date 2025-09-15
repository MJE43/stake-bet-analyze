from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

Difficulty = str  # "easy" | "medium" | "hard" | "expert" (validated at API layer)


class RunCreate(BaseModel):
    server_seed: str
    client_seed: str
    start: int = Field(ge=1)
    end: int
    difficulty: Difficulty
    targets: list[float]


class RunRead(BaseModel):
    id: UUID
    created_at: datetime
    server_seed_sha256: str
    client_seed: str
    difficulty: Difficulty
    nonce_start: int
    nonce_end: int
    duration_ms: int
    engine_version: str
    targets: list[float]
    counts_by_target: dict[str, int]


class RunDetail(BaseModel):
    id: UUID
    created_at: datetime
    server_seed_sha256: str
    server_seed: str
    client_seed: str
    difficulty: Difficulty
    nonce_start: int
    nonce_end: int
    duration_ms: int
    engine_version: str
    targets: list[float]
    summary: dict


class HitRow(BaseModel):
    nonce: int
    max_multiplier: float
    distance_prev: int | None = None


class HitsPage(BaseModel):
    total: int
    rows: list[HitRow]


class DistanceStatsPayload(BaseModel):
    multiplier: float
    tol: float
    count: int
    nonces: list[int]
    distances: list[int]
    stats: dict


class RunListResponse(BaseModel):
    runs: list[RunRead]
    total: int
