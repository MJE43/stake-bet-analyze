# Stake Integration Plan

## Overview
This document outlines the implementation plan for adding Stake betting integration to the existing analytics platform while maintaining backward compatibility with Antebot data.

## PR 1: Schema & Compatibility

### Database Changes

#### Modify `live_bets` table:
- Add `provider` column (enum: 'antebot', 'stake') with default 'antebot'
- Add `provider_bet_id` column (nullable for backward compatibility)
- Add unique index on (stream_id, provider_bet_id) when not null
- Keep `antebot_bet_id` for backward compatibility
- Update existing unique constraint to work with new provider model

#### Create new tables:

1. `balance_snapshots`:
   - id (primary key)
   - provider (enum)
   - account_ref (string)
   - available (decimal)
   - currency (string)
   - captured_at (datetime)

2. `seed_rotations`:
   - id (primary key)
   - server_seed_hashed (string)
   - client_seed (string)
   - revealed_server_seed (string, nullable)
   - rotated_at (datetime, nullable)
   - prev_stream_id (UUID, foreign key to live_streams)
   - next_stream_id (UUID, foreign key to live_streams)

3. `stake_sessions`:
   - id (primary key)
   - account_ref (string)
   - x_access_token (encrypted string)
   - cf_clearance (encrypted string, nullable)
   - last_verified_at (datetime)

### Migration Strategy
- Add columns via SQLModel DDL
- Create Alembic baseline for proper migrations
- Ensure existing /live/* endpoints remain unchanged
- Keep all existing tests passing

## PR 2: Stake Integration Layer

### Backend Components

#### Stake GraphQL Client (`backend/app/integrations/stake/client.py`):
- `StakeSession` class to handle authentication headers
- Encrypted storage for x-access-token and cf_clearance cookies
- Robust error mapping for HTTP and GraphQL errors
- Request signing/headers management

#### New API Endpoints:
- `POST /stake/session`: Verify and store session token
- `POST /stake/bet`: Execute bet and normalize to canonical model
- `POST /stake/rotate-seed`: Handle seed rotation
- `GET /stake/balance`: Fetch and persist balance snapshot

#### Data Normalization:
- Map Stake responses to canonical Bet model
- Create-or-get LiveStream for seed pairs
- Write Bet rows with provider fields
- Return StreamDetail payload for immediate UI update

### Key Features
- Idempotency handling via (provider, provider_bet_id)
- Real-time publish via immediate StreamDetail response
- Security: Encrypt secrets at rest, never log them

## PR 3: Frontend Controls

### New Components

#### Stake Auth Panel:
- Inputs for x-access-token and optional cf_clearance
- POST to /stake/session for verification
- Display verified account and currency

#### Bet Controls Card (LiveStreamDetail):
- Game selector (Pump/Limbo)
- Amount input
- Difficulty/target controls
- Submit button to call /stake/bet

#### Balance Widget:
- Display latest balance from mutation response
- Manual refresh button for /stake/balance

### Real-time Updates
- Optimistically insert returned bet in table model
- Trigger immediate /tail fetch with last_id
- Reuse existing polling mechanism for efficiency

## Testing Strategy
- Keep existing integration tests for /live/* endpoints
- Add request-cassette tests for Stake GraphQL (fixtures)
- Exercise normalization without hitting Stake API
- Verify backward compatibility with Antebot data

## Design Notes
- No Cloudflare shenanigans - treat clearance as user-provided
- Idempotency via (provider, provider_bet_id) and (stream_id, nonce)
- Security: encrypt secrets, redact in audits
- Minimal changes to existing analytics engine

This approach maintains the existing analysis capabilities while adding the ability to place bets directly from the interface, with all data flowing through the same analytics pipeline.