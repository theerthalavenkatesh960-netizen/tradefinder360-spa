import type { ElementType, ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart2,
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
} from 'lucide-react';
import type { BacktestMetrics } from '../../services/api';
import { formatPrice, formatPercent } from '../../utils/formatters';

interface Props {
  metrics: BacktestMetrics;
}

type ExtendedMetrics = BacktestMetrics & {
  sharpeRatio?: number;
  avgTradeDurationMinutes?: number;
  expectancy?: number;
};

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: ReactNode;
  icon: ElementType;
  iconClass: string;
  delay: number;
  valueClassName?: string;
}

const MetricCard = ({ label, value, sub, icon: Icon, iconClass, delay, valueClassName = 'text-white' }: MetricCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-[#12121a]/60 border border-gray-800/50 rounded-xl p-3"
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</span>
      <div className={`p-1 rounded-md ${iconClass}`}>
        <Icon className="w-3 h-3" />
      </div>
    </div>
    <p className={`text-base md:text-lg font-bold leading-tight ${valueClassName}`}>{value}</p>
    {sub && <div className="mt-0.5">{sub}</div>}
  </motion.div>
);

export const BacktestMetricsBar = ({ metrics }: Props) => {
  const extMetrics = metrics as ExtendedMetrics;
  const winRatePct = (metrics.winRate * 100).toFixed(1);
  const isProfitable = metrics.totalPnl >= 0;

  const formatDuration = (minutes?: number) => {
    if (minutes === undefined || Number.isNaN(minutes)) return '—';
    const totalMinutes = Math.max(Math.round(minutes), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const sharpeClass =
    extMetrics.sharpeRatio === undefined
      ? 'text-gray-300'
      : extMetrics.sharpeRatio > 1
      ? 'text-green-400'
      : extMetrics.sharpeRatio >= 0.5
      ? 'text-amber-400'
      : 'text-red-400';

  const expectancyClass =
    extMetrics.expectancy === undefined
      ? 'text-gray-300'
      : extMetrics.expectancy >= 0
      ? 'text-green-400'
      : 'text-red-400';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mb-3">
      <MetricCard
        label="Total Trades"
        value={metrics.totalTrades}
        sub={
          <p className="text-xs text-gray-500">
            <span className="text-green-400">{metrics.winningTrades}W</span>{' '}
            <span className="text-gray-600">/</span>{' '}
            <span className="text-red-400">{metrics.losingTrades}L</span>
          </p>
        }
        icon={BarChart2}
        iconClass="bg-indigo-500/10 text-indigo-400"
        delay={0}
      />

      <MetricCard
        label="Win Rate"
        value={`${winRatePct}%`}
        sub={
          <div className="w-full bg-gray-800 rounded-full h-1 mt-1.5">
            <div
              className="bg-green-500 h-1 rounded-full transition-all duration-700"
              style={{ width: `${winRatePct}%` }}
            />
          </div>
        }
        icon={Target}
        iconClass="bg-green-500/10 text-green-400"
        delay={0.05}
      />

      <MetricCard
        label="Total PnL"
        value={formatPrice(metrics.totalPnl)}
        sub={
          <p className={`text-xs ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
            {metrics.totalReturn !== undefined
              ? formatPercent(metrics.totalReturn)
              : isProfitable
              ? 'Profitable'
              : 'Loss'}
          </p>
        }
        icon={isProfitable ? TrendingUp : TrendingDown}
        iconClass={isProfitable ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}
        delay={0.1}
      />

      <MetricCard
        label="Max Drawdown"
        value={formatPrice(Math.abs(metrics.maxDrawdown))}
        sub={<p className="text-xs text-gray-500">from peak</p>}
        icon={TrendingDown}
        iconClass="bg-red-500/10 text-red-400"
        delay={0.15}
      />

      <MetricCard
        label="Avg R:R"
        value={`1 : ${(metrics.avgRR ?? 0).toFixed(2)}`}
        sub={<p className="text-xs text-gray-500">risk / reward</p>}
        icon={Activity}
        iconClass="bg-blue-500/10 text-blue-400"
        delay={0.2}
      />

      <MetricCard
        label="Profit Factor"
        value={(metrics.profitFactor ?? 0).toFixed(2)}
        sub={<p className="text-xs text-gray-500">gross P / gross L</p>}
        icon={DollarSign}
        iconClass="bg-yellow-500/10 text-yellow-400"
        delay={0.25}
      />

      <MetricCard
        label="Sharpe Ratio"
        value={extMetrics.sharpeRatio !== undefined ? extMetrics.sharpeRatio.toFixed(2) : '—'}
        valueClassName={sharpeClass}
        sub={<p className="text-xs text-gray-500">risk-adjusted</p>}
        icon={Activity}
        iconClass="bg-cyan-500/10 text-cyan-400"
        delay={0.3}
      />

      <MetricCard
        label="Avg Trade Duration"
        value={formatDuration(extMetrics.avgTradeDurationMinutes)}
        sub={<p className="text-xs text-gray-500">per trade</p>}
        icon={BarChart2}
        iconClass="bg-violet-500/10 text-violet-400"
        delay={0.35}
      />

      <MetricCard
        label="Expectancy"
        value={extMetrics.expectancy !== undefined ? formatPrice(extMetrics.expectancy) : '—'}
        valueClassName={expectancyClass}
        sub={<p className="text-xs text-gray-500">per trade avg</p>}
        icon={Target}
        iconClass="bg-indigo-500/10 text-indigo-400"
        delay={0.4}
      />
    </div>
  );
};
