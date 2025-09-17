# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (Python/FastAPI)
- Start development server: `cd backend && python start_server.py`
- Run tests: `cd backend && pytest`
- Run a single test: `cd backend && pytest tests/test_file.py::test_function`
- Lint: `cd backend && black . && ruff check .`
- Type check: `cd backend && mypy .`

### Frontend (React/TypeScript)
- Start development server: `cd frontend && npm run dev`
- Build for production: `cd frontend && npm run build`
- Lint code: `cd frontend && npm run lint`
- Run all tests: `cd frontend && npm run test`
- Run tests in watch mode: `cd frontend && npm run test:run`
- Run tests with UI: `cd frontend && npm run test:ui`
- Run a single test file: `cd frontend && npm run test -- path/to/test.tsx`
- Preview production build: `cd frontend && npm run preview`
- Clean build artifacts: `cd frontend && npm run clean`

## Code Architecture

### Overall Structure
This is a local-first web application for analyzing Stake Pump game outcomes using provably-fair systems. It consists of:
- A Python FastAPI backend with SQLite database
- A React + TypeScript frontend with Vite build system
- TanStack Query for data fetching and caching
- Mantine UI components with Tailwind CSS

### Backend Architecture
The backend is structured as a FastAPI application:
- `app/main.py`: Application entry point with FastAPI setup, CORS, and startup events
- `app/core/`: Configuration and utilities including settings management and rate limiting
- `app/engine/`: Core pump analysis engine implementing the provably-fair HMAC-SHA256 algorithm
- `app/models/`: SQLModel database models for runs, hits, and live streams
- `app/routers/`: API endpoints for runs, verification, and live streams
- `app/schemas/`: Pydantic schemas for request/response validation
- `tests/`: Unit and integration tests using pytest

### Frontend Architecture
The frontend is a React 18 TypeScript application:
- `src/main.tsx`: Application entry point
- `src/App.tsx`: Main application component with routing
- `src/pages/`: Page components for different views (runs, verification, live streams)
- `src/components/`: Reusable UI components
- `src/hooks/`: Custom React hooks for data fetching and business logic
- `src/lib/`: Utility functions including API clients and analysis engine
- `src/routes/`: React Router route definitions

### Key Features
1. **Pump Analysis**: Deterministically replay Stake Pump outcomes using server/client seeds
2. **Data Management**: Persistent storage of analysis runs with SQLite database
3. **Live Streams**: Real-time processing of live stream data with WebSocket support
4. **Verification**: Individual nonce verification capability
5. **Export**: CSV export functionality for analysis results

### Data Flow
1. Frontend makes API requests to backend using TanStack Query
2. Backend processes requests using the analysis engine
3. Results are stored in SQLite database via SQLModel ORM
4. Frontend displays results and provides export capabilities

### Testing
- Backend tests use pytest with asyncio support
- Frontend tests use Vitest with React Testing Library