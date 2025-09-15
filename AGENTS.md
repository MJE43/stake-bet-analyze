# AGENTS.md

## Build/Lint/Test Commands

### Frontend (cd frontend)
- Dev: `npm run dev` (Vite port 5173)
- Build: `npm run build` (tsc + vite)
- Lint: `npm run lint` (ESLint)
- Test all: `npm run test` (Vitest) or `npm run test:run` (once)
- Single test: `npx vitest src/path/to/test.tsx --run`

### Backend (cd backend)
- Dev: `python start_server.py` (uvicorn port 8000)
- Test all: `pytest` (async, verbose)
- Single test: `pytest tests/test_specific.py::test_func`
- Lint: `black . && ruff check .` (PEP8)
- Typecheck: `mypy .`
- Migrations: `python run_migration.py`

## Code Style Guidelines

### General
- **Naming**: Backend: snake_case (files/vars), PascalCase (classes). Frontend: PascalCase (components), camelCase (hooks/vars)
- **Imports**: Backend: relative. Frontend: @/src alias
- **Types**: Backend: SQLModel/Pydantic. Frontend: Strict TS, Zod validation
- **Formatting**: Frontend: ESLint. Backend: Black/Ruff, 88-char lines

### Backend (FastAPI)
- Structure: Routers per feature (app/routers/), models/schemas separate, async/await
- Error Handling: Custom exceptions, HTTP 422/404/429, structured JSON responses
- API: Pagination, 201 POST, rate limiting, token auth
- Database: AsyncSession, select() queries, no raw SQL

### Frontend (React/TS)
- Components: PascalCase, props interfaces (required first), composition, cn() Tailwind
- Hooks: Custom logic, TanStack Query for data, useState/useReducer for local
- Forms: React Hook Form + Zod, per-field errors
- Error Handling: ErrorBoundary, query onError with toast
- Testing: Vitest + RTL, renderHook, mock API, golden vectors

Run lint/typecheck after changes: `npm run lint` (frontend), `mypy . && pytest` (backend)
