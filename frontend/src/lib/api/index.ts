// Re-export from modular API structure
export { apiClient, testApiConnection, getErrorDetails } from "./client";
export { liveStreamsApi } from "./streams";
export { runsApi, distancesApi } from "./runs";
export { verifyApi } from "./verify";

// Re-export types
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
  RunCreateRequest,
  RunListItem,
  RunDetail,
  Hit,
  RunListFilters,
  HitsFilters,
  DistanceStatsResponse,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "./types";

// Legacy validation utilities (can be moved to separate module later)
export {
  validateRunDetail,
  validateHit,
  formatValidationErrors,
  formatValidationWarnings,
} from "../validation";