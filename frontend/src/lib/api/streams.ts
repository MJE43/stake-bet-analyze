import { apiClient } from "./client";

// Live Streams API Types
export interface StreamSummary {
  id: string;
  server_seed_hashed: string;
  client_seed: string;
  created_at: string;
  last_seen_at: string;
  total_bets: number;
  highest_multiplier: number;
  notes?: string;
}

export interface StreamDetail {
  id: string;
  server_seed_hashed: string;
  client_seed: string;
  created_at: string;
  last_seen_at: string;
  total_bets: number;
  highest_multiplier: number;
  lowest_multiplier?: number;
  average_multiplier?: number;
  notes?: string;
  recent_bets: BetRecord[];
}

export interface BetRecord {
  id: number;
  antebot_bet_id: string;
  received_at: string;
  date_time?: string;
  nonce: number;
  amount: number;
  payout_multiplier: number;
  payout: number;
  difficulty: "easy" | "medium" | "hard" | "expert";
  round_target?: number;
  round_result?: number;
  distance_prev_opt?: number | null;
}

export interface TailResponse {
  bets: BetRecord[];
  lastId: number;
}

export interface StreamListFilters {
  limit?: number;
  offset?: number;
}

export interface StreamBetsFilters {
  min_multiplier?: number;
  limit?: number;
  offset?: number;
  order?: "nonce_asc" | "id_desc";
  include_distance?: boolean;
}

// Hit-Centric Analysis API Types
export interface HitRecord {
  nonce: number;
  bucket: number;
  distance_prev: number | null;
  id: number;
  date_time: string | null;
}

export interface BucketStats {
  count: number;
  median: number | null;
  mean: number | null;
  min: number | null;
  max: number | null;
  method: 'exact' | 'approximate';
}

export interface RangeStats {
  range: string;
  stats: BucketStats;
}

export interface HitQueryResponse {
  hits: HitRecord[];
  prev_nonce_before_range: number | null;
  total_in_range: number;
  has_more: boolean;
}

export interface HitStatsResponse {
  stats_by_range: RangeStats[];
}

export interface GlobalHitStatsResponse {
  global_stats: BucketStats;
  theoretical_eta: number | null;
  confidence_interval: [number, number] | null;
}

export interface BatchHitQueryResponse {
  hits_by_bucket: Record<string, HitRecord[]>;
  stats_by_bucket: Record<string, BucketStats>;
}

export interface HitQueryFilters {
  bucket: number;
  after_nonce?: number;
  before_nonce?: number;
  limit?: number;
  order?: 'nonce_asc' | 'nonce_desc';
  include_distance?: boolean;
}

export interface HitStatsFilters {
  bucket: number;
  ranges?: string;
}

export interface BatchHitFilters {
  buckets: string; // comma-separated bucket values
  after_nonce?: number;
  before_nonce?: number;
  limit_per_bucket?: number;
}

// Live Streams API
export const liveStreamsApi = {
  // List all streams
  list: (params?: StreamListFilters) =>
    apiClient.get<{ streams: StreamSummary[]; total: number }>("/live/streams", { params }),

  // Get stream details
  get: (id: string) => apiClient.get<StreamDetail>(`/live/streams/${id}`),

  // Get stream bets with pagination
  getBets: (id: string, params?: StreamBetsFilters) =>
    apiClient.get<{ total: number; bets: BetRecord[] }>(`/live/streams/${id}/bets`, {
      params: { ...params, include_distance: true }
    }),

  // Get incremental updates
  tail: (id: string, sinceId: number, includeDistance?: boolean) =>
    apiClient.get<TailResponse>(`/live/streams/${id}/tail`, {
      params: {
        since_id: sinceId,
        include_distance: includeDistance ?? true
      }
    }),

  // Delete stream
  delete: (id: string) => apiClient.delete(`/live/streams/${id}`),

  // Update stream
  update: (id: string, data: { notes?: string }) =>
    apiClient.put<StreamDetail>(`/live/streams/${id}`, data),

  // Export CSV
  getExportCsvUrl: (id: string) => `${apiClient.defaults.baseURL}/live/streams/${id}/export.csv`,

  // Hit-centric analysis endpoints
  getHits: (id: string, params: HitQueryFilters) =>
    apiClient.get<HitQueryResponse>(`/live/streams/${id}/hits`, { params }),

  getHitStats: (id: string, params: HitStatsFilters) =>
    apiClient.get<HitStatsResponse>(`/live/streams/${id}/hits/stats`, { params }),

  getGlobalHitStats: (id: string, params: { bucket: number }) =>
    apiClient.get<GlobalHitStatsResponse>(`/live/streams/${id}/hits/stats/global`, { params }),

  getBatchHits: (id: string, params: BatchHitFilters) =>
    apiClient.get<BatchHitQueryResponse>(`/live/streams/${id}/hits/batch`, { params }),
};