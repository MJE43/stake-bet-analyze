# Stake Seed Analysis

A local-first web tool for deterministically replaying Stake Pump game outcomes and analyzing nonce sequences for profitable opportunities.

## Overview

This application allows you to:
- Deterministically replay Stake Pump outcomes using server seeds, client seeds, and nonce ranges
- Analyze results for specific target multipliers across all difficulties (easy, medium, hard, expert)
- Store and browse analysis runs with detailed summaries
- Export results as CSV files for further analysis
- Verify individual nonce outcomes

The tool implements Stake's provably-fair system using HMAC-SHA256 to generate deterministic random sequences that determine pump outcomes.

## Tech Stack

- **Frontend**: React + TypeScript + Vite with TanStack Query and Mantine UI components
- **Backend**: FastAPI (Python 3.11) with SQLModel ORM
- **Database**: SQLite for local storage
- **Deployment**: Local-first application (runs on your machine)

## Features

### Pump Analysis
- Supports all Pump difficulties: easy, medium, hard, expert
- Analyzes arbitrary target multipliers
- Processes up to 1M nonces per run with configurable limits
- Shows detailed statistics including max/median multipliers and hit counts

### Data Management
- Persistent storage of analysis runs
- Browse and filter previous runs
- Export hits as CSV
- Duplicate runs with modified parameters

### Verification
- Verify individual nonce outcomes
- Real-time computation of pump results

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm 9+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd stake-bet-analyze
```

2. Set up the backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

3. Set up the frontend:
```bash
cd ../frontend
npm install
```

### Running the Application

1. Start the backend server:
```bash
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
python start_server.py
```

2. In a new terminal, start the frontend:
```bash
cd frontend
npm run dev
```

3. Open your browser to `http://localhost:5173`

## API Endpoints

- `POST /runs` - Create and analyze a new run
- `GET /runs` - List all runs
- `GET /runs/{id}` - Get run details
- `GET /runs/{id}/hits` - Get hits for a run (with filtering)
- `GET /runs/{id}/export/hits.csv` - Export hits as CSV
- `GET /runs/{id}/export/full.csv` - Export full analysis as CSV
- `GET /verify` - Verify a single nonce

## Project Structure

```
backend/
  app/
    core/          # Configuration and utilities
    engine/        # Core pump analysis engine
    models/        # Database models
    routers/       # API endpoints
    schemas/       # Pydantic schemas
  tests/           # Unit and integration tests

frontend/
  src/
    components/    # React components
    hooks/         # Custom React hooks
    lib/           # API clients and utilities
    pages/         # Page components
```

## Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm run test
```

## Configuration

### Backend (.env)
- `DATABASE_URL` - SQLite database path
- `API_CORS_ORIGINS` - Allowed CORS origins
- `MAX_NONCES` - Maximum nonces per run

### Frontend (.env)
- `VITE_API_BASE` - Backend API base URL

## License

This project is licensed for personal use only. It is designed to be run locally and should not be deployed publicly.
