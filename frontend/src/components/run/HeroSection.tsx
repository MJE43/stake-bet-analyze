import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ChevronLeftIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "@heroicons/react/24/outline";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { RunDetail as Run } from "../../lib/api";

interface HeroSectionProps {
  run: Run;
}

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
};

const formatNumber = (n: number) => new Intl.NumberFormat().format(n);

export const HeroSection = ({ run }: HeroSectionProps) => {
  const keyMetrics = [
    {
      label: "Nonce Range",
      value: formatNumber(run.summary.count),
      subtext: `${run.nonce_start.toLocaleString()} - ${run.nonce_end.toLocaleString()}`,
      trend: null,
    },
    {
      label: "Duration",
      value: formatDuration(run.duration_ms),
      subtext: "Processing time",
      trend: null,
    },
    {
      label: "Total Hits",
      value: formatNumber(run.summary.count),
      subtext: "Successful outcomes",
      trend: "up",
    },
    {
      label: "Max Multiplier",
      value: `${run.summary.max_multiplier.toFixed(2)}x`,
      subtext: "Highest achieved",
      trend: "up",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.1),transparent_50%)]" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Button variant="ghost" size="sm" asChild className="text-slate-400 hover:text-white">
              <Link to="/" className="flex items-center gap-2">
                <motion.div
                  whileHover={{ x: -2 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </motion.div>
                Back to runs
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Badge
              variant={run.difficulty === "expert" ? "destructive" : run.difficulty === "hard" ? "default" : "secondary"}
              className="capitalize"
            >
              {run.difficulty}
            </Badge>
          </motion.div>
        </div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-2">
            Analysis Run
          </h1>
          <p className="text-slate-400 text-lg">
            Run ID:{" "}
            <code className="text-sm bg-slate-800/50 px-2 py-1 rounded font-mono">
              {run.id}
            </code>
          </p>
        </motion.div>

        {/* Key Metrics Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {keyMetrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="group relative overflow-hidden rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 hover:bg-slate-800/70 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-400">{metric.label}</p>
                  {metric.trend && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                    >
                      {metric.trend === "up" ? (
                        <ArrowTrendingUpIcon className="h-4 w-4 text-green-400" />
                      ) : (
                        <ArrowTrendingDownIcon className="h-4 w-4 text-red-400" />
                      )}
                    </motion.div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-bold text-white">{metric.value}</div>
                  <p className="text-xs text-slate-500">{metric.subtext}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};