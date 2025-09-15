import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { distancesApi, type DistanceStatsResponse } from "../../lib/api";
import { ChartBarIcon, ChartPieIcon, ArrowTrendingUpIcon, CursorArrowRaysIcon } from "@heroicons/react/24/outline";

interface PerformanceChartProps {
  runId: string;
  multipliers: number[];
  selectedMultiplier: number;
  onMultiplierChange: (multiplier: number) => void;
}

type ChartType = "distribution" | "scatter" | "timeline" | "breakdown";

interface HistogramBin {
  range: string;
  count: number;
  min: number;
  max: number;
}

const formatNumber = (n: number | string | null | undefined) => {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat().format(Number(n));
};

export const PerformanceChart = ({
  runId,
  multipliers,
  selectedMultiplier,
  onMultiplierChange,
}: PerformanceChartProps) => {
  const [data, setData] = useState<DistanceStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>("distribution");
  const [histogramData, setHistogramData] = useState<HistogramBin[] | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    distancesApi
      .get(runId, { multiplier: selectedMultiplier })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((e: unknown) => {
        const msg = (e as Error)?.message || "Failed to load distances";
        if (!cancelled) setError(msg);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [runId, selectedMultiplier]);

  // Initialize Web Worker
  useEffect(() => {
    if (typeof Worker !== 'undefined') {
      workerRef.current = new Worker(new URL('../../workers/histogram.worker.ts', import.meta.url), {
        type: 'module'
      });

      workerRef.current.onmessage = (e) => {
        const { type, bins } = e.data;
        if (type === 'result') {
          setHistogramData(bins);
        }
      };

      return () => {
        workerRef.current?.terminate();
      };
    }
  }, []);

  // Calculate histogram using Web Worker when data changes
  useEffect(() => {
    if (data && data.distances && data.distances.length > 0 && workerRef.current) {
      workerRef.current.postMessage({
        type: 'calculate',
        distances: data.distances,
        binCount: 20,
      });
    }
  }, [data]);

  const chartData = useMemo(() => {
    if (!data || data.count < 2) return null;

    const stats = data.stats as {
      mean: number;
      median: number;
      min: number;
      max: number;
      p90: number;
      p99: number;
      stddev: number;
      cv: number;
    };

    switch (chartType) {
      case "distribution": {
        // Use Web Worker result if available, otherwise fallback to main thread calculation
        if (histogramData) {
          return histogramData;
        }

        // Fallback calculation on main thread
        const distances = data.distances;
        if (!distances || distances.length === 0) return [];

        const min = Math.min(...distances);
        const max = Math.max(...distances);
        const binCount = 20;
        const binSize = (max - min) / binCount;

        const bins = Array.from({ length: binCount }, (_, i) => ({
          range: `${Math.floor(min + i * binSize)}-${Math.floor(min + (i + 1) * binSize)}`,
          count: 0,
          min: min + i * binSize,
          max: min + (i + 1) * binSize,
        }));

        distances.forEach((distance) => {
          const binIndex = Math.min(Math.floor((distance - min) / binSize), binCount - 1);
          if (bins[binIndex]) {
            bins[binIndex].count++;
          }
        });

        return bins.filter(bin => bin.count > 0);
      }

      case "scatter": {
        const fullData = data.nonces.slice(1).map((to: number, idx: number) => ({
          nonce: to,
          distance: data.distances[idx],
          multiplier: selectedMultiplier,
        }));

        // Downsample for performance - limit to 1000 points
        const maxPoints = 1000;
        if (fullData.length > maxPoints) {
          const step = Math.floor(fullData.length / maxPoints);
          return fullData.filter((_, idx) => idx % step === 0);
        }

        return fullData;
      }

      case "timeline": {
        // Mock timeline data - in real app, this would come from time-series data
        const fullData = data.nonces.slice(1).map((to: number, idx: number) => ({
          nonce: to,
          distance: data.distances[idx],
          time: idx * 1000, // Mock time progression
        }));

        // Downsample for performance - limit to 500 points
        const maxPoints = 500;
        if (fullData.length > maxPoints) {
          const step = Math.floor(fullData.length / maxPoints);
          return fullData.filter((_, idx) => idx % step === 0);
        }

        return fullData;
      }

      case "breakdown": {
        return [
          { name: "Min Distance", value: stats.min, color: "#ef4444" },
          { name: "Median", value: stats.median, color: "#f59e0b" },
          { name: "Mean", value: stats.mean, color: "#10b981" },
          { name: "Max Distance", value: stats.max, color: "#3b82f6" },
        ];
      }

      default:
        return null;
    }
  }, [data, chartType, selectedMultiplier, histogramData]);

  // Custom tooltip component
  const CustomTooltip = useCallback(({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{
      name: string;
      value: number;
      color?: string;
    }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-slate-300 text-sm font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-white text-sm">
              {entry.name}: {formatNumber(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  }, []);

  // Memoize chart rendering functions
  const renderChart = useCallback(() => {
    if (!chartData) return null;

    switch (chartType) {
      case "distribution":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="range"
                stroke="#9ca3af"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "scatter":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="nonce"
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(value) => formatNumber(value)}
              />
              <YAxis
                dataKey="distance"
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter dataKey="distance" fill="#10b981" />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case "timeline":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(value) => `${value}ms`}
              />
              <YAxis
                dataKey="distance"
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="distance"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: "#f59e0b", strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "breakdown":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${formatNumber(value)}`}
              >
                {chartData?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={(entry as { name: string; value: number; color: string }).color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  }, [chartData, chartType, CustomTooltip]);



  const chartTypes = [
    { type: "distribution" as ChartType, icon: ChartBarIcon, label: "Distribution" },
    { type: "scatter" as ChartType, icon: CursorArrowRaysIcon, label: "Scatter Plot" },
    { type: "timeline" as ChartType, icon: ArrowTrendingUpIcon, label: "Timeline" },
    { type: "breakdown" as ChartType, icon: ChartPieIcon, label: "Breakdown" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white">
              Performance Analysis - {selectedMultiplier}x Multiplier
            </CardTitle>
            <div className="flex items-center gap-2">
              <select
                className="bg-slate-700 border-slate-600 text-white rounded-md px-3 py-1 text-sm"
                value={selectedMultiplier}
                onChange={(e) => onMultiplierChange(parseFloat(e.target.value))}
              >
                {multipliers.map((m) => (
                  <option key={m} value={m} className="bg-slate-700">
                    {m}x
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <a href={distancesApi.getCsvUrl(runId, selectedMultiplier)}>
                  Export CSV
                </a>
              </Button>
            </div>
          </div>

          {/* Chart Type Selector */}
          <div className="flex gap-2 mt-4">
            {chartTypes.map(({ type, icon: Icon, label }) => (
              <Button
                key={type}
                size="sm"
                variant={chartType === type ? "default" : "outline"}
                onClick={() => setChartType(type)}
                className={`flex items-center gap-2 ${
                  chartType === type
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "border-slate-600 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {loading && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {error && (
            <div className="text-center text-red-400 p-4">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              {data.count < 2 ? (
                <div className="text-center text-slate-400 p-8">
                  Not enough data (need ≥2 occurrences).
                </div>
              ) : (
                <>
                  {/* Stats Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{data.count}</div>
                      <div className="text-xs text-slate-400">Total Hits</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {formatNumber((data.stats as { mean: number; median: number; min: number; max: number; p90: number; p99: number; stddev: number; cv: number }).mean)}
                      </div>
                      <div className="text-xs text-slate-400">Mean Distance</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {formatNumber((data.stats as { mean: number; median: number; min: number; max: number; p90: number; p99: number; stddev: number; cv: number }).median)}
                      </div>
                      <div className="text-xs text-slate-400">Median Distance</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {formatNumber((data.stats as { mean: number; median: number; min: number; max: number; p90: number; p99: number; stddev: number; cv: number }).stddev)}
                      </div>
                      <div className="text-xs text-slate-400">Std Deviation</div>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    {renderChart()}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};