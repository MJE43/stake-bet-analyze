import { useMemo, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { liveStreamsApi } from "@/lib/api/streams";
import type { BetRecord, StreamBetsFilters } from "@/lib/api/types";

export interface UseStreamBetsQueryOptions {
  streamId: string;
  filters?: StreamBetsFilters;
  enabled?: boolean;
  pollingInterval?: number;
  maxPages?: number;
  includeDistance?: boolean;
}

export interface UseStreamBetsQueryResult {
  bets: BetRecord[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}

/**
 * Real-time streaming bets using infinite query pattern.
 * - Uses useInfiniteQuery for proper real-time data streaming
 * - Automatically polls for new bets via tail endpoint
 * - Maintains proper cache consistency without manual manipulation
 */
export function useStreamBetsQuery(
  options: UseStreamBetsQueryOptions
): UseStreamBetsQueryResult {
  const { streamId, filters, enabled = true, pollingInterval = 2000, includeDistance = false } = options;
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Merge default filters
  const mergedFilters: StreamBetsFilters = useMemo(
    () => ({ order: "id_desc", limit: 1000, ...(filters ?? {}) }),
    [filters]
  );

  const effectiveMaxPages = options.maxPages || 10; // Default to 10 pages (10k bets)

  // Infinite query for initial data + pagination
  const query = useInfiniteQuery({
    queryKey: ["streamBets", streamId, mergedFilters],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await liveStreamsApi.getBets(streamId, {
        ...mergedFilters,
        offset: pageParam,
      });
      return response.data;
    },
    getNextPageParam: (lastPage, pages) => {
      if (pages.length >= effectiveMaxPages) {
        return undefined;
      }
      const totalFetched = pages.reduce(
        (sum, page) => sum + page.bets.length,
        0
      );
      return totalFetched < lastPage.total ? totalFetched : undefined;
    },
    initialPageParam: 0,
    enabled: enabled && !!streamId,
    staleTime: 5 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: (failureCount, error: Error | unknown) => {
      if (failureCount >= 3) return false;
      const status = (error as Error & { apiError?: { status?: number } })?.apiError?.status;
      return !status || status >= 500;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Flatten all pages into single array, capped if needed
  const allBets = useMemo(() => {
    const flattened = query.data?.pages.flatMap((page) => page.bets) ?? [];
    // Cap total bets if exceeding reasonable limit
    return flattened.slice(0, effectiveMaxPages * (mergedFilters.limit || 1000));
  }, [query.data, effectiveMaxPages, mergedFilters.limit]);

  // Real-time polling for new bets
  const pollForNewBets = useCallback(async () => {
    if (!allBets.length || !enabled) return;

    try {
      const lastId = Math.max(...allBets.map((bet) => bet.id));
      const response = await liveStreamsApi.tail(streamId, lastId, includeDistance);

      if (response.data.bets.length > 0) {
        // Add new bets to the beginning of the first page
        queryClient.setQueryData(
          ["streamBets", streamId, mergedFilters],
          (old: { pages: { bets: BetRecord[]; total: number }[] } | undefined) => {
            if (!old?.pages?.length) return old;

             const firstPage = old.pages[0]!;
            const newBets = response.data.bets;

            // Deduplicate and merge
            const existingIds = new Set(
              firstPage.bets.map((b: BetRecord) => b.id)
            );
            const uniqueNewBets = newBets.filter(
              (bet) => !existingIds.has(bet.id)
            );

            if (uniqueNewBets.length === 0) return old;

            return {
              ...old,
              pages: [
                {
                  ...firstPage,
                  bets: [...uniqueNewBets, ...firstPage.bets].slice(
                    0,
                    mergedFilters.limit
                  ),
                  total: firstPage.total + uniqueNewBets.length,
                },
                ...old.pages.slice(1),
              ],
            };
          }
        );
      }
    } catch (error) {
      console.error("Error polling for new bets:", error);
    }
  }, [allBets, enabled, streamId, mergedFilters, queryClient, includeDistance]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || query.isLoading) return;

    intervalRef.current = setInterval(pollForNewBets, pollingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, query.isLoading, pollForNewBets, pollingInterval]);

  return {
    bets: allBets,
    total: query.data?.pages?.[0]?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    isFetching: query.isFetching,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
