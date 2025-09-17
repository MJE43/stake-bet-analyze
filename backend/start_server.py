#!/usr/bin/env python3
"""
Startup script for Pump Analyzer API server.

Uses configuration from environment variables to bind to the specified
host and port for local-only access by default.
"""

import os
import sys
import uvicorn

from app.core.config import get_settings


def main():
    """Start the API server with configured host and port."""
    settings = get_settings()

    # --- Database Location Check ---
    # This check is to prevent accidental creation of a new database file.
    # The server must be started from the 'backend' directory.
    db_path = "pump.db"
    # Correctly reference the root directory from `backend/`
    root_db_path = os.path.join("..", db_path)

    if not os.path.exists(db_path) and os.path.exists(root_db_path):
        print("="*80, file=sys.stderr)
        print("ERROR: Database file not found in the 'backend' directory.", file=sys.stderr)
        print(f"A database file was found in the project root: '{os.path.abspath(root_db_path)}'", file=sys.stderr)
        print("\nPlease move the database file to the 'backend' directory to resolve this.", file=sys.stderr)
        print(f"  mv {root_db_path} {db_path}", file=sys.stderr)
        print("="*80, file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(db_path):
        print("="*80, file=sys.stderr)
        print(f"WARNING: Database file '{db_path}' not found.", file=sys.stderr)
        print("A new empty database will be created automatically on first use.", file=sys.stderr)
        print("="*80, file=sys.stderr)
    # --- End of Database Location Check ---

    print("Starting Pump Analyzer API server...")
    print(f"Host: {settings.api_host}")
    print(f"Port: {settings.api_port}")
    print(f"CORS Origins: {', '.join(settings.api_cors_origins)}")
    print(
        f"Ingest Token: {'Configured' if settings.ingest_token else 'Not configured (open access)'}"
    )
    print(f"Rate Limit: {settings.ingest_rate_limit} requests/minute")
    print(f"Max Nonces: {settings.max_nonces:,}")
    print()

    # Start the server with configured settings
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        log_level="info",
        access_log=True,
    )


if __name__ == "__main__":
    main()