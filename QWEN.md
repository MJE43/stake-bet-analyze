# Pump Analyzer Web - Project Context

## Project Overview

This is a full-stack web application called "Pump Analyzer Web" that enables users to deterministically replay Stake Pump game outcomes for provably-fair verification. The application analyzes server/client seed pairs over a range of nonces to identify patterns and hits for specific multiplier targets.

### Core Technologies

- **Backend:** FastAPI (Python 3.12+) with SQLModel/SQLite
- **Frontend:** React 18 + TypeScript + Vite with TanStack Query
- **Database:** SQLite (via aiosqlite) with SQLModel ORM
- **Package Management:** uv (backend), npm (frontend)

### Project Structure

```
pump-analyzer/
├── backend/
│   ├── app/
│   │   ├── core/          # Configuration and utilities
│   │   ├── engine/        # Core analysis algorithms
│   │   ├── models/        # Database models
│   │   ├── routers/       # API endpoints
│   │   ├── schemas/       # Pydantic data schemas
│   │   ├── db.py          # Database setup
│   │   └── main.py        # FastAPI app entry point
│   ├── tests/             # Backend test suite
│   ├── start_server.py    # Development server entry point
│   ├── requirements.txt   # Python dependencies
│   ├── pyproject.toml     # Project configuration
│   └── .env.example       # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── components/    # React UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # API clients and utilities
│   │   ├── pages/         # Page components (RunsList, NewRun, RunDetail)
│   │   ├── styles/        # CSS and styling
│   │   └── App.tsx        # Main application component
│   ├── package.json       # Frontend dependencies
│   └── vite.config.ts     # Build configuration
├── README.md
├── PRD.md                 # Product Requirements Document
└── setup.sh               # Project setup script
```

## Development Workflow

### Setup

1. Run `./setup.sh` to install dependencies for both backend and frontend
2. Copy `.env.example` files in both `backend/` and `frontend/` to `.env` and configure as needed

### Running the Application

**Backend:**
```bash
cd backend
python start_server.py
# or alternatively:
# uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```

The backend runs on `http://localhost:8000` and the frontend on `http://localhost:5173`.

### Building for Production

**Backend:**
No separate build step required - FastAPI serves directly

**Frontend:**
```bash
cd frontend
npm run build
```

### Testing

**Backend Tests:**
```bash
cd backend
pytest
# or for specific test files:
# pytest tests/test_pump_engine.py -v
```

**Frontend Tests:**
```bash
cd frontend
npm run test
# or for interactive mode:
# npm run test:ui
```

## Core Functionality

### Pump Analysis Engine

The core algorithm implements Stake's provably-fair Pump game verification:

1. **HMAC Generation:** Uses `HMAC-SHA256(server_seed, client_seed:nonce:round)` to generate deterministic byte sequences
2. **Float Conversion:** Converts bytes to floats in range [0,1) for selection shuffle
3. **Permutation Generation:** Creates a permutation of positions 1-25 using selection shuffle algorithm
4. **Pump Calculation:** Determines pop point, safe pumps, and multiplier based on difficulty level
5. **Range Scanning:** Processes nonce ranges to identify hits for target multipliers

### API Endpoints

The backend exposes a REST API with these key endpoints:

- `POST /runs` - Create and analyze a new run
- `GET /runs` - List runs with filtering
- `GET /runs/{id}` - Get run details
- `GET /runs/{id}/hits` - Get hits with pagination/filtering
- `GET /runs/{id}/export/hits.csv` - Export hits as CSV
- `GET /runs/{id}/export/full.csv` - Export full analysis as CSV
- `GET /verify` - Verify a single nonce
- Live Streams endpoints for real-time bet tracking

### Frontend Features

- Create new analysis runs with form validation
- Browse and filter historical runs
- View detailed run analysis with performance metrics
- Export data as CSV files
- Verify individual nonces
- Real-time bet tracking through Live Streams feature

## Development Practices

### Backend

- **Type Safety:** Full type hints throughout the codebase
- **Async/Await:** Asynchronous endpoints with async database operations
- **Validation:** Pydantic schemas for request/response validation
- **Error Handling:** Structured error responses with appropriate HTTP status codes
- **Testing:** Pytest with comprehensive unit and integration tests

### Frontend

- **TypeScript:** Strict typing with comprehensive interfaces
- **State Management:** TanStack Query for server state management
- **Component Architecture:** Reusable components with clear separation of concerns
- **Responsive Design:** Mobile-first responsive UI
- **Error Handling:** Structured error handling with user-friendly messages

### Database

- **ORM:** SQLModel (SQLAlchemy-based) for database operations
- **Migrations:** Automatic schema creation at startup
- **Relationships:** Proper foreign key relationships with cascade deletion
- **Indexes:** Optimized indexes for common query patterns

### Security

- **CORS:** Configurable CORS policies
- **Rate Limiting:** Ingest endpoint rate limiting
- **Input Validation:** Comprehensive input validation and sanitization
- **Environment Variables:** Sensitive configuration via environment variables

## Key Concepts

- **Run:** A complete analysis session with seed pair, nonce range, difficulty, and targets
- **Hit:** A nonce that produces a multiplier matching or exceeding a target value
- **Nonce:** Sequential index for game plays under a given seed pair
- **Difficulty:** Pump game difficulty (easy/medium/hard/expert) determining number of pop tokens
- **Provably Fair:** Cryptographic system ensuring game outcomes are predetermined but verifiable

## Configuration

Environment variables can be set in `.env` files:

**Backend (.env):**
- `DATABASE_URL` - Database connection string
- `API_CORS_ORIGINS` - Allowed CORS origins
- `MAX_NONCES` - Maximum nonces per analysis run
- `API_HOST`/`API_PORT` - Server binding configuration

**Frontend (.env):**
- `VITE_API_BASE` - Backend API base URL

## Testing Strategy

### Backend
- Unit tests for engine algorithms (golden vector validation)
- Integration tests for API endpoints
- Database tests with temporary in-memory SQLite
- Performance and validation tests

### Frontend
- Component unit tests with React Testing Library
- Integration tests for API hooks
- End-to-end user flow testing

## Deployment Considerations

- Single-user, local-first application
- SQLite database stored locally
- No authentication or multi-user support in MVP
- Designed for modern laptop/desktop systems (8GB+ RAM)

## Troubleshooting

Common issues and solutions:

1. **Port Conflicts:** Change `API_PORT` in backend `.env`
2. **CORS Errors:** Update `API_CORS_ORIGINS` to match frontend URL
3. **Database Issues:** Delete `pump.db` to start fresh (loses all data)
4. **Slow Performance:** Reduce nonce range for analysis runs