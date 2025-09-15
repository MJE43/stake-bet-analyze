# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- Start development server: `npm run dev`
- Build for production: `npm run build`
- Lint code: `npm run lint`
- Run all tests: `npm run test`
- Run tests in watch mode: `npm run test:run`
- Run tests with UI: `npm run test:ui`
- Run a single test file: `npm run test -- path/to/test.tsx`
- Preview production build: `npm run preview`
- Clean build artifacts: `npm run clean`

## Code Architecture

This is a React 18 TypeScript frontend built with Vite, using React Router for client-side routing and TanStack Query for data fetching and caching. Styling is handled with Tailwind CSS and Mantine components, supplemented by Radix UI primitives for accessible UI elements (in a shadcn/ui-like pattern).

The app focuses on analyzing stake bets from live streams and past runs, with key pages for listing and detailing runs/live streams, and creating new runs. Core data flows through API hooks in `src/lib/api.ts` to a backend, with custom hooks in `src/hooks/` managing state for streams, bets, offline detection, and hit-centric analysis.

Analysis logic is centralized in `src/lib/analysisEngine.ts` and `src/lib/analysisMath.ts`, processing bet data for KPIs, multipliers, and visualizations (using Recharts). Live stream features include real-time tail updates via WebSockets or polling in hooks like `useStreamTailUpdater.ts`. UI components are modular, with reusable primitives in `src/components/ui/` and domain-specific components in `src/components/live-streams/` and `src/components/`.

Entry point is `src/main.tsx` rendering `App.tsx`, which sets up routing and providers (QueryClient, theme). Error handling is global via `ErrorBoundary.tsx`, and offline states are managed with `useOfflineDetection.ts`."
