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

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  icon: React.ElementType;
  iconClass: string;
  delay: number;
}

const MetricCard = ({ label, value, sub, icon: Icon, iconClass, delay }: MetricCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-[#12121a]/60 border border-gray-800/50 rounded-xl p-4"
  >
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs text-gray-500 uppercase tracking-widest">{label}</span>
      <div className={`p-1.5 rounded-lg ${iconClass}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
    </div>
    <p className="text-xl font-bold text-white leading-tight">{value}</p>
    {sub && <div className="mt-1">{sub}</div>}
  </motion.div>
);

export const BacktestMetricsBar = ({ metrics }: Props) => {
  const winRatePct = (metrics.winRate * 100).toFixed(1);
  const isProfitable = metrics.totalPnl >= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
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
    </div>
  );
};
