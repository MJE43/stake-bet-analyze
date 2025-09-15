import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, Clock } from "lucide-react";
import LiveBetsTable from "@/components/live-streams/LiveBetsTable";

import type { BetRecord } from "@/lib/api/types";

interface BetsTableCardProps {
  streamId: string;
  isPolling: boolean;
  highFrequencyMode: boolean;
  bets: BetRecord[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  fetchNextPage: () => void;
  refetch: () => void;
  hasNextPage: boolean;
  isFetching: boolean;
}

export const BetsTableCard = ({
  streamId,
  isPolling,
  highFrequencyMode,
  bets,
  total,
  isLoading,
  isError,
  error,
  fetchNextPage,
  refetch,
  hasNextPage,
  isFetching,
}: BetsTableCardProps) => {
  const pollingInterval = highFrequencyMode ? 500 : 2000;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Live Betting Activity
          </CardTitle>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              Updates every {highFrequencyMode ? "0.5" : "2"} seconds
            </span>
          </div>
        </div>
        <CardDescription>
          Real-time betting data with distance calculations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LiveBetsTable
          streamId={streamId}
          isPolling={isPolling}
          pollingInterval={pollingInterval}
          bets={bets}
          total={total}
          isLoading={isLoading}
          isError={isError}
          error={error}
          fetchNextPage={fetchNextPage}
          refetch={refetch}
          hasNextPage={hasNextPage}
          isFetching={isFetching}
        />
      </CardContent>
    </Card>
  );
};
