import { useMemo, useState, Suspense, lazy } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { useRun, usePaginatedHitsQuery } from "../lib/hooks";
import { RunActionsBar } from "../components/RunActionsBar";
import { HeroSection } from "../components/run/HeroSection";
import { InsightCard } from "../components/run/InsightCard";

// Lazy load performance-heavy components
const PerformanceChart = lazy(() => import("../components/run/PerformanceChart").then(module => ({ default: module.PerformanceChart })));
const HitsTable = lazy(() => import("../components/run/HitsTable"));
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import {
  ChartBarIcon,
  ClockIcon,
  CursorArrowRaysIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";

const RunDetail = () => {
  const { id } = useParams<{ id: string }>();

  const [minMultiplier, setMinMultiplier] = useState<number | undefined>();
  const [hitsPage, setHitsPage] = useState(0);
  const hitsLimit = 50; // Reduced from 100 for better performance
  const [selectedDistanceMultiplier, setSelectedDistanceMultiplier] = useState<
    number | null
  >(null);

  const { data: run, isLoading: runLoading, error: runError } = useRun(id!);

  // Derive API params from state
  const apiFilters = useMemo(() => ({
    min_multiplier: minMultiplier,
    limit: hitsLimit,
    offset: hitsPage * hitsLimit,
    include_distance: "filtered" as const,
  }), [minMultiplier, hitsPage, hitsLimit]);

  const {
    hits,
    total: hitsTotal,
    pageCount,
    isLoading: hitsLoading,
    error: hitsErrorObj
  } = usePaginatedHitsQuery({
    runId: id!,
    filters: apiFilters,
    enabled: !!id,
  });

  const handleJumpToNonce = (nonce: number) => {
    // TODO: Implement jump to nonce functionality
    console.log("Jump to nonce:", nonce);
    toast.error("Jump to nonce functionality not yet implemented");
  };

  // No local target toggling; target buttons map to minMultiplier changes



  const handlePageChange = (page: number) => {
    setHitsPage(page);
  };

  const handleFilterChange = (filters: { minMultiplier?: number }) => {
    setMinMultiplier(filters.minMultiplier);
    setHitsPage(0); // Reset to first page when filters change
  };

  // Local helpers are declared above; no duplicates here

  if (!id) {
    return <div>Invalid run ID</div>;
  }

  if (runLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: "var(--color-primary-500)" }}
        ></div>
      </div>
    );
  }

  if (runError || !run) {
    return (
      <div
        className="rounded-md p-4"
        style={{ backgroundColor: "#2c1919", borderColor: "#5a2525" }}
      >
        <div style={{ color: "#f8b4b4" }}>
          Error loading run: {runError?.message || "Run not found"}
        </div>
        <Link
          to="/"
          className="mt-2 hover:underline"
          style={{ color: "var(--color-primary-500)" }}
        >
          ← Back to runs
        </Link>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Hero Section */}
        <HeroSection run={run} />

        {/* Actions Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.6,
            duration: 0.3,
            ease: "easeOut"
          }}
          style={{ willChange: "transform, opacity" }}
        >
          <RunActionsBar
            run={run}
            minMultiplier={undefined}
            onMinMultiplierChange={() => {}}
            onJumpToNonce={handleJumpToNonce}
          />
        </motion.div>

        {/* Insight Cards Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.7,
            duration: 0.4,
            ease: "easeOut"
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          style={{ willChange: "transform, opacity" }}
        >
          <InsightCard
            title="Median Multiplier"
            value={`${run.summary.median_multiplier.toFixed(2)}x`}
            subtitle="Average performance"
            trend="up"
            trendValue="+2.1%"
            icon={<ChartBarIcon className="h-5 w-5" />}
            delay={0.8}
          />

          <InsightCard
            title="Engine Version"
            value={run.engine_version}
            subtitle="Analysis engine"
            icon={<CursorArrowRaysIcon className="h-5 w-5" />}
            delay={0.9}
          />

          <InsightCard
            title="Processing Time"
            value={formatDuration(run.duration_ms)}
            subtitle="Total duration"
            icon={<ClockIcon className="h-5 w-5" />}
            delay={1.0}
          />

          <InsightCard
            title="Difficulty Level"
            value={run.difficulty}
            subtitle="Analysis complexity"
            trend={run.difficulty === "expert" ? "down" : "neutral"}
            icon={<TrophyIcon className="h-5 w-5" />}
            delay={1.1}
          />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            {/* Performance Chart */}
            <Suspense fallback={
              <div className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 rounded-lg p-8">
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-slate-400">Loading performance chart...</span>
                </div>
              </div>
            }>
              <PerformanceChart
                runId={id!}
                multipliers={run.targets}
                selectedMultiplier={selectedDistanceMultiplier ?? run.targets[0] ?? 1}
                onMultiplierChange={setSelectedDistanceMultiplier}
              />
            </Suspense>

            {/* Run Information Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Run Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Difficulty</span>
                        <Badge
                          variant={
                            run.difficulty === "expert"
                              ? "destructive"
                              : run.difficulty === "hard"
                              ? "default"
                              : "secondary"
                          }
                          className="capitalize"
                        >
                          {run.difficulty}
                        </Badge>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Engine</span>
                        <code className="text-sm bg-slate-700 px-2 py-1 rounded text-slate-300">
                          {run.engine_version}
                        </code>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Total Nonces</span>
                        <span className="text-white font-semibold">
                          {run.summary.count.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Range</span>
                        <span className="text-white font-mono text-sm">
                          {run.nonce_start.toLocaleString()} - {run.nonce_end.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-400">Target Multipliers</p>
                    <div className="flex flex-wrap gap-2">
                      {run.targets.slice(0, 12).map((target, index) => (
                        <motion.div
                          key={index}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 1.3 + index * 0.05 }}
                        >
                          <Badge
                            variant="outline"
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          >
                            {target}x
                          </Badge>
                        </motion.div>
                      ))}
                      {run.targets.length > 12 && (
                        <Badge variant="secondary" className="bg-slate-700">
                          +{run.targets.length - 12} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="xl:col-span-1 space-y-8">
            {/* Target Counts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
            >
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Target Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(run.summary.counts_by_target)
                    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                    .map(([target, count], index) => (
                      <motion.div
                        key={target}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.5 + index * 0.05 }}
                      >
                        <Button
                          variant="ghost"
                          className="w-full justify-between h-auto p-3 text-left hover:bg-slate-700/50 border border-transparent hover:border-slate-600 transition-all duration-200"
                          onClick={() => {
                            setSelectedDistanceMultiplier(parseFloat(target));
                          }}
                        >
                          <span className="text-sm font-medium text-slate-400">
                            ≥{target}x
                          </span>
                          <Badge variant="secondary" className="bg-slate-700">
                            {count.toLocaleString()}
                          </Badge>
                        </Button>
                      </motion.div>
                    ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Enhanced Hits Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 }}
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">
                  Hits Analysis ({hitsTotal.toLocaleString()})
                </CardTitle>
                <Badge variant="outline" className="border-slate-600 text-slate-400">
                  Page {hitsPage + 1} of {pageCount}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Suspense fallback={
                <div className="p-8">
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-slate-400">Loading hits table...</span>
                  </div>
                </div>
              }>
                <HitsTable
                  hits={hits}
                  total={hitsTotal}
                  isLoading={hitsLoading}
                  isError={!!hitsErrorObj}
                  error={hitsErrorObj}
                  page={hitsPage}
                  pageCount={pageCount}
                  onPageChange={handlePageChange}
                  onFilterChange={handleFilterChange}
                  runTargets={run.targets}
                />
              </Suspense>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default RunDetail;
