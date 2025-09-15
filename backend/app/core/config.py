"""
Application configuration loader.

Simple environment-based configuration with sensible defaults for local-first
development. Uses python-dotenv if available to load a local .env file.
"""

import os
from dataclasses import dataclass
from typing import List

try:
    # Optional: load .env if present
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()
except Exception:
    # Safe to ignore if dotenv isn't installed
    pass


def _get_env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value not in (None, "") else default


def _split_csv(value: str) -> List[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str
    api_cors_origins: List[str]
    max_nonces: int
    ingest_token: str | None
    api_host: str
    api_port: int
    ingest_rate_limit: int


def get_settings() -> Settings:
    database_url = _get_env("DATABASE_URL", "sqlite+aiosqlite:///./pump.db")
    cors_origins_raw = _get_env("API_CORS_ORIGINS", "http://localhost:5173")
    api_cors_origins = _split_csv(cors_origins_raw)

    max_nonces_raw = _get_env("MAX_NONCES", str(500_000))
    try:
        max_nonces = int(max_nonces_raw)
    except ValueError:
        max_nonces = 500_000

    ingest_token = os.getenv("INGEST_TOKEN")
    if ingest_token == "":
        ingest_token = None

    # API server configuration
    api_host = _get_env("API_HOST", "127.0.0.1")
    
    api_port_raw = _get_env("API_PORT", "8000")
    try:
        api_port = int(api_port_raw)
    except ValueError:
        api_port = 8000

    # Rate limiting configuration
    ingest_rate_limit_raw = _get_env("INGEST_RATE_LIMIT", "60")
    try:
        ingest_rate_limit = int(ingest_rate_limit_raw)
    except ValueError:
        ingest_rate_limit = 60

    return Settings(
        database_url=database_url,
        api_cors_origins=api_cors_origins,
        max_nonces=max_nonces,
        ingest_token=ingest_token,
        api_host=api_host,
        api_port=api_port,
        ingest_rate_limit=ingest_rate_limit,
    )
