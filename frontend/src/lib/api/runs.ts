import { apiClient } from "./client";

// Types for API requests and responses
export interface RunCreateRequest {
  server_seed: string;
  client_seed: string;
  start: number;
  end: number;
  difficulty: "easy" | "medium" | "hard" | "expert";
  targets: number[];
}

export interface RunListItem {
  id: string;
  created_at: string;
  server_seed_sha256: string; // First 10 chars for display
  client_seed: string;
  difficulty: string;
  nonce_start: number;
  nonce_end: number;
  duration_ms: number;
  counts_by_target: Record<string, number>;
}

export interface RunDetail {
  id: string;
  server_seed: string; // Full seed shown in detail
  client_seed: string;
  nonce_start: number;
  nonce_end: number;
  difficulty: string;
  targets: number[];
  duration_ms: number;
  engine_version: string;
  summary: {
    count: number;
    max_multiplier: number;
    median_multiplier: number;
    counts_by_target: Record<string, number>;
  };
}

export interface Hit {
  nonce: number;
  max_multiplier: number;
  distance_prev?: number | null;
}

export interface RunListFilters {
  limit?: number;
  offset?: number;
  search?: string;
  difficulty?: string;
}

export interface HitsFilters {
  min_multiplier?: number;
  limit?: number;
  offset?: number;
  include_distance?: "per_multiplier" | "filtered";
  tol?: number;
}

// Distances API
export interface DistanceStatsResponse {
  multiplier: number;
  tol: number;
  count: number;
  nonces: number[];
  distances: number[];
  stats:
    | {
        mean: number;
        median: number;
        min: number;
        max: number;
        p90: number;
        p99: number;
        stddev: number;
        cv: number;
      }
    | Record<string, unknown>;
}

// API functions
export const runsApi = {
  // List runs with optional filters
  list: (params?: RunListFilters) =>
    apiClient.get<{ runs: RunListItem[]; total: number }>("/runs", { params }),

  // Create new run
  create: (
    data: RunCreateRequest,
    config?: import("axios").AxiosRequestConfig
  ) => apiClient.post<RunDetail>("/runs", data, config),

  // Get run details
  get: (id: string) => apiClient.get<RunDetail>(`/runs/${id}`),

  // Get paginated hits
  getHits: (id: string, params?: HitsFilters) =>
    apiClient.get<{ total: number; rows: Hit[] }>(`/runs/${id}/hits`, {
      params,
    }),

  // CSV export URLs (direct links, not API calls)
  getHitsCsvUrl: (id: string) => `${apiClient.defaults.baseURL}/runs/${id}/export/hits.csv`,
  getFullCsvUrl: (id: string) => `${apiClient.defaults.baseURL}/runs/${id}/export/full.csv`,
};

export const distancesApi = {
  get: (id: string, params: { multiplier: number; tol?: number }) =>
    apiClient.get<DistanceStatsResponse>(`/runs/${id}/distances`, { params }),
  getCsvUrl: (id: string, multiplier: number, tol?: number) => {
    const url = new URL(`${apiClient.defaults.baseURL}/runs/${id}/distances.csv`);
    url.searchParams.set("multiplier", String(multiplier));
    if (tol !== undefined) url.searchParams.set("tol", String(tol));
    return url.toString();
  },
};