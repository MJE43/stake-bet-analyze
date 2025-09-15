// Shared types for streaming functionality
export interface StreamFilters {
  limit?: number;
  offset?: number;
  search?: string;
  minMultiplier?: number;
  maxMultiplier?: number;
}

export interface StreamData {
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

export interface StreamBetsFilters {
  min_multiplier?: number;
  limit?: number;
  offset?: number;
  order?: "nonce_asc" | "id_desc";
  include_distance?: boolean;
}

// Legacy hook compatibility types
export interface UseStreamTailOptions {
  streamId: string;
  enabled?: boolean;
  pollingInterval?: number;
  includeDistance?: boolean;
  initialLastId?: number;
  onNewBets?: (newBets: BetRecord[]) => void;
  onError?: (error: Error) => void;
}

export interface UseStreamTailResult {
  newBets: BetRecord[];
  lastId: number;
  isPolling: boolean;
  isError: boolean;
  error: Error | null;
  totalNewBets: number;
  startPolling: () => void;
  stopPolling: () => void;
  resetTail: () => void;
}