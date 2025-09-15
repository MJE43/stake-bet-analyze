# AGENTS.md

## Build/Lint/Test Commands

### Frontend (cd frontend)
- Dev: `npm run dev` (Vite on port 5173)
- Build: `npm run build` (tsc + vite build)
- Lint: `npm run lint` (ESLint on .)
- Test all: `npm run test` (Vitest watch/UI) or `npm run test:run` (once)
- Single test: `npx vitest src/path/to/test.tsx` (or `--run` for once)

### Backend (cd backend)
- Dev: `python start_server.py` (uvicorn on 8000)
- Test all: `pytest` (async, verbose, short traces)
- Single test: `pytest tests/test_specific.py` (or `::test_func`)
- Lint: Use black/ruff if installed; follow PEP8/snake_case
- Migrations: `python run_migration.py`

## Code Style Guidelines (from .cursor/rules)

### General
- **Naming**: Backend: snake_case files/vars, PascalCase classes. Frontend: PascalCase components/pages, camelCase hooks/vars, kebab-case CSS.
- **Imports**: Backend: relative (from .models import). Frontend: @/src alias (import { Button } from '@/components/ui/button').
- **Types**: Backend: SQLModel/Pydantic for models/schemas. Frontend: Strict TypeScript; infer from Zod; shared types in src/types.
- **Formatting**: Frontend: ESLint + Prettier (via config.js). Backend: PEP8, 88-char lines; no explicit formatter in reqs.txt.

### Backend (FastAPI/Python)
- **Structure**: Routers per feature (app/routers/); models/schemas separate; async/await everywhere.
- **Error Handling**: Custom exceptions (e.g., ValidationError); HTTP 422/404/429; structured JSON responses with type/code/message.
- **API**: Pagination (limit/offset); status 201 for POST; rate limiting on ingest; token auth via Header.
- **Database**: AsyncSession via Depends; select() queries; no raw SQL.

### Frontend (React/TS)
- **Components**: PascalCase; props interfaces first (required then optional); composition over inheritance; cn() for Tailwind.
- **Hooks**: Custom for logic (useStreams); TanStack Query for data; useState/useReducer for local state.
- **Forms**: React Hook Form + Zod; error display per field.
- **Error Handling**: ErrorBoundary class; query onError with toast; AxiosError typing.
- **Testing**: Vitest + RTL; renderHook for hooks; mock API; golden vectors for engine.

### Cursor Rules Integration
- Follow tech-stack.mdc: React 19, FastAPI, Tailwind/Radix, TanStack Query/Table.
- Structure.mdc: Layered (pages > components > ui); no generic names.
- Frontend-patterns.mdc: Memoization (React.memo/useMemo); responsive Tailwind.
- Testing-requirements.mdc: Golden vector tests (expert: 11200.65x); determinism; perf <10s/200k nonces.
- Error-handling.mdc: Exception hierarchy; structured logging; boundaries.
- API-conventions.mdc: Router tags; Pydantic validators; async patterns.

Run lint/typecheck after changes: `npm run lint` (frontend), `pytest` (backend tests as proxy).
