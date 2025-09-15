import { QueryClient } from '@tanstack/react-query';
import { normalizeError } from './errorModel';

// Global query client configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const appError = normalizeError(error);
        return appError.retryable && failureCount < (appError.maxRetries ?? 3);
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        const appError = normalizeError(error);
        return appError.retryable && failureCount < (appError.maxRetries ?? 2);
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Query key factory for consistent naming
export const queryKeys = {
  streams: {
    all: ['streams'] as const,
    lists: () => [...queryKeys.streams.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.streams.lists(), filters] as const,
    details: () => [...queryKeys.streams.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.streams.details(), id] as const,
    bets: (id: string) => [...queryKeys.streams.detail(id), 'bets'] as const,
    betsFiltered: (id: string, filters: Record<string, unknown>) =>
      [...queryKeys.streams.bets(id), filters] as const,
  },
  runs: {
    all: ['runs'] as const,
    lists: () => [...queryKeys.runs.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.runs.lists(), filters] as const,
    details: () => [...queryKeys.runs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.runs.details(), id] as const,
    hits: (id: string) => [...queryKeys.runs.detail(id), 'hits'] as const,
    hitsFiltered: (id: string, filters: Record<string, unknown>) =>
      [...queryKeys.runs.hits(id), filters] as const,
  },
} as const;