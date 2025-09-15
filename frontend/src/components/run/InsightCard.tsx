import { motion } from "framer-motion";
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon } from "@heroicons/react/24/outline";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface InsightCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  delay?: number;
  onClick?: () => void;
  className?: string;
}

export const InsightCard = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  delay = 0,
  onClick,
  className = "",
}: InsightCardProps) => {
  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-green-400";
      case "down":
        return "text-red-400";
      default:
        return "text-slate-400";
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <ArrowTrendingUpIcon className="h-4 w-4" />;
      case "down":
        return <ArrowTrendingDownIcon className="h-4 w-4" />;
      default:
        return <MinusIcon className="h-4 w-4" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={className}
    >
      <Card className="group relative overflow-hidden bg-slate-800/50 backdrop-blur-sm border-slate-700/50 hover:bg-slate-800/70 transition-all duration-300 cursor-pointer">
        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-700/20 via-transparent to-slate-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
              {title}
            </CardTitle>
            {icon && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: delay + 0.2 }}
                className="text-slate-500 group-hover:text-slate-400 transition-colors"
              >
                {icon}
              </motion.div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-2">
            <motion.div
              className="text-2xl font-bold text-white"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: delay + 0.1, type: "spring", stiffness: 200 }}
            >
              {value}
            </motion.div>

            {trend && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: delay + 0.3 }}
                className={`flex items-center gap-1 ${getTrendColor()}`}
              >
                {getTrendIcon()}
                {trendValue && <span className="text-sm font-medium">{trendValue}</span>}
              </motion.div>
            )}
          </div>

          {subtitle && (
            <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
              {subtitle}
            </p>
          )}
        </CardContent>

        {/* Subtle shine effect on hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
          initial={false}
        />
      </Card>
    </motion.div>
  );
};