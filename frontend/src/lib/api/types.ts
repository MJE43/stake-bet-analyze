// Shared types for API modules
export type { APIError, DebugInfo } from "./client";

// Re-export commonly used types for convenience

// Re-export commonly used types for convenience
export type {
  StreamSummary,
  StreamDetail,
  BetRecord,
  TailResponse,
  StreamListFilters,
  StreamBetsFilters,
  HitRecord,
  BucketStats,
  RangeStats,
  HitQueryResponse,
  HitStatsResponse,
  GlobalHitStatsResponse,
  BatchHitQueryResponse,
  HitQueryFilters,
  HitStatsFilters,
  BatchHitFilters,
} from "./streams";

export type {
  RunCreateRequest,
  RunListItem,
  RunDetail,
  Hit,
  RunListFilters,
  HitsFilters,
  DistanceStatsResponse,
} from "./runs";

export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "../validation";