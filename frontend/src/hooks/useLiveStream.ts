import React, { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { liveStreamsApi } from "@/lib/api/streams";
import type { BetRecord, StreamDetail, StreamBetsFilters } from "@/lib/api/types";
import { queryKeys } from "@/lib/queryClient";

export interface UseLiveStreamOptions {
  streamId: string;
  mode?: 'realtime' | 'polling' | 'static';
  intervalMs?: number;
  filters?: StreamBetsFilters;
  onError?: (error: Error) => void;
  onData?: (data: StreamDetail) => void;
  enabled?: boolean;
}

export interface UseLiveStreamResult {
  data: StreamDetail | undefined;
  bets: BetRecord[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  totalBets: number;
}

/**
 * Unified hook for live stream data management
 * Consolidates useLiveStreams, useStreamTail, and useStreamTailUpdater
 */
export function useLiveStream(options: UseLiveStreamOptions): UseLiveStreamResult {
  const {
    streamId,
    mode = 'realtime',
    intervalMs = 2000,
    filters,
    onError,
    onData,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();

  // Default filters for consistent behavior
  const defaultFilters: StreamBetsFilters = useMemo(
    () => ({ order: "id_desc", limit: 1000, ...(filters ?? {}) }),
    [filters]
  );

  // Stream details query
  const streamQuery = useQuery({
    queryKey: queryKeys.streams.detail(streamId),
    queryFn: () => liveStreamsApi.get(streamId).then(res => res.data),
    enabled: enabled && !!streamId,
    staleTime: mode === 'static' ? Infinity : 1000,
    refetchInterval: mode === 'polling' ? intervalMs : false,
  });

  // Stream bets query with real-time updates
  const betsQuery = useQuery({
    queryKey: queryKeys.streams.betsFiltered(streamId, defaultFilters as Record<string, unknown>),
    queryFn: () => liveStreamsApi.getBets(streamId, defaultFilters).then(res => res.data),
    enabled: enabled && !!streamId,
    staleTime: 500,
    refetchInterval: mode === 'realtime' ? intervalMs : false,
  });

  // Real-time tail updates (only for realtime mode)
  const tailQuery = useQuery({
    queryKey: ['stream-tail', streamId],
    queryFn: async () => {
      // Get last bet ID from current cache
      const cachedData = queryClient.getQueryData<{
        bets: BetRecord[];
        total: number;
      }>(queryKeys.streams.betsFiltered(streamId, defaultFilters as Record<string, unknown>));

      const lastId = cachedData?.bets?.[0]?.id ?? 0;

      const response = await liveStreamsApi.tail(streamId, lastId, true);
      return response.data;
    },
    enabled: enabled && !!streamId && mode === 'realtime',
    staleTime: 0,
    refetchInterval: intervalMs,
  });

  // Handle success callbacks using useEffect
  React.useEffect(() => {
    if (streamQuery.data && onData) {
      onData(streamQuery.data);
    }
  }, [streamQuery.data, onData]);

  // Handle error callbacks using useEffect
  React.useEffect(() => {
    const error = streamQuery.error || betsQuery.error || tailQuery.error;
    if (error && onError) {
      onError(error as Error);
    }
  }, [streamQuery.error, betsQuery.error, tailQuery.error, onError]);

  // Handle tail data merging using useEffect
  React.useEffect(() => {
    if (tailQuery.data && tailQuery.data.bets.length > 0) {
      // Merge new bets into cache
      queryClient.setQueryData(
        queryKeys.streams.betsFiltered(streamId, defaultFilters as Record<string, unknown>),
        (old: { bets: BetRecord[]; total: number } | undefined) => {
          const existing = old?.bets ?? [];
          const seen = new Set(existing.map((b: BetRecord) => b.id));

          // Filter out duplicates and prepend new bets
          const uniqueNew = tailQuery.data.bets.filter((b: BetRecord) => !seen.has(b.id));
          const merged = [...uniqueNew, ...existing];

          // Apply ordering and limits
          if (defaultFilters.order === "id_desc") {
            merged.sort((a: BetRecord, b: BetRecord) => b.id - a.id);
          } else if (defaultFilters.order === "nonce_asc") {
            merged.sort((a: BetRecord, b: BetRecord) => a.nonce - b.nonce);
          }

          const limit = defaultFilters.limit ?? 1000;
          if (merged.length > limit) {
            merged.splice(limit);
          }

          return {
            bets: merged,
            total: (old?.total ?? 0) + uniqueNew.length,
          };
        }
      );

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.streams.detail(streamId)
      });
    }
  }, [tailQuery.data, streamId, defaultFilters, queryClient]);

  const refetch = () => {
    streamQuery.refetch();
    betsQuery.refetch();
    if (mode === 'realtime') {
      tailQuery.refetch();
    }
  };

  return {
    data: streamQuery.data,
    bets: betsQuery.data?.bets ?? [],
    isLoading: streamQuery.isLoading || betsQuery.isLoading,
    isFetching: streamQuery.isFetching || betsQuery.isFetching || tailQuery.isFetching,
    error: streamQuery.error || betsQuery.error || tailQuery.error,
    refetch,
    totalBets: betsQuery.data?.total ?? 0,
  };
}