import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Radar as RadarIcon, TrendingUp, TrendingDown, Zap, Layers, ArrowUpCircle, ArrowDownCircle, Activity, RefreshCw } from 'lucide-react';
import { api, MoverItem, SectorLeaderItem, BreakoutItem, SRProximityItem, PatternItem } from '../services/api';
import { TrendCandles } from '../components/TrendCandles';
import { formatPrice, getBiasColor } from '../utils/formatters';

// ---- Shared formatters (instantiated once, never recreated per render) ----
const pctFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });

// ---- Skeleton ----
const SectionSkeleton = memo(({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2 animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center justify-between bg-[#12121a]/50 border border-gray-800/30 rounded-lg px-4 py-3">
        <div className="space-y-1.5">
          <div className="h-4 w-20 bg-gray-700/40 rounded" />
          <div className="h-3 w-14 bg-gray-700/20 rounded" />
        </div>
        <div className="flex gap-4">
          <div className="h-4 w-16 bg-gray-700/30 rounded" />
          <div className="h-4 w-12 bg-gray-700/20 rounded" />
        </div>
      </div>
    ))}
  </div>
));

// ---- Section wrapper ----
const Section = memo(({ title, icon, children, count, isLoading, accent = 'indigo' }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  count?: number;
  isLoading?: boolean;
  accent?: string;
}) => (
  <div className="bg-[#12121a]/60 backdrop-blur-xl border border-gray-800/50 rounded-xl overflow-hidden">
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/50">
      <div className="flex items-center gap-2.5">
        <span className={`text-${accent}-400`}>{icon}</span>
        <h2 className="font-semibold text-white text-sm">{title}</h2>
        {count !== undefined && (
          <span className="text-xs text-gray-500 font-medium">({count})</span>
        )}
      </div>
    </div>
    <div className="p-4">
      {isLoading ? <SectionSkeleton /> : children}
    </div>
  </div>
));

const EmptyState = memo(({ label }: { label: string }) => (
  <div className="text-center py-8 text-gray-600 text-sm">{label}</div>
));

// ---- Enhanced Row cards with trend context ----
const MoverRow = memo(({ item, isGainer }: { item: MoverItem; isGainer: boolean }) => (
  <Link
    to={`/stocks/${item.symbol}`}
    className="flex flex-col lg:flex-row lg:items-start gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition group border border-gray-800/30 hover:border-gray-700/50"
  >
    {/* Left: Symbol & Price Info */}
    <div className="flex items-start justify-between lg:flex-col lg:min-w-max gap-2">
      <div>
        <p className="font-semibold text-white group-hover:text-indigo-300 transition text-sm">{item.symbol}</p>
        <p className="text-xs text-gray-500">{item.exchange}</p>
      </div>
      <div className="text-right lg:text-left">
        <p className="text-gray-300 text-sm font-medium">{formatPrice(item.lastClose)}</p>
        <p className={`text-sm font-bold ${item.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {pctFmt.format(item.changePercent)}%
        </p>
      </div>
    </div>

    {/* Middle: Trend Chart */}
    <div className="lg:flex-1 min-w-fit">
      <TrendCandles candles={item.trendCandles} symbol={item.symbol} isPositive={isGainer} />
    </div>

    {/* Right: Score, Bias & AI Insight */}
    <div className="flex items-center justify-between lg:flex-col lg:items-end gap-3 lg:gap-2 text-sm">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${getBiasColor(item.bias)}`}>{item.bias}</span>
        <span className="text-indigo-300 font-bold text-xs bg-indigo-900/30 px-2 py-0.5 rounded">{item.setupScore}%</span>
      </div>
      
      {/* AI Analysis Placeholder */}
      <div className="text-xs text-gray-400 italic max-w-xs text-right hidden lg:block">
        {item.aiAnalysis && item.aiAnalysis !== 'Ready' ? (
          <span className="text-amber-400">{item.aiAnalysis}</span>
        ) : (
          <span className="text-gray-500">AI insights pending...</span>
        )}
      </div>
    </div>
  </Link>
));

const SectorRow = memo(({ item }: { item: SectorLeaderItem }) => (
  <Link
    to={`/stocks/${item.symbol}`}
    className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/5 transition group"
  >
    <div>
      <p className="font-semibold text-white group-hover:text-purple-300 transition text-sm">{item.symbol}</p>
      <p className="text-xs text-gray-500">{item.exchange}</p>
    </div>
    <div className="flex items-center gap-4 text-sm">
      <span className="text-gray-300">{formatPrice(item.lastClose)}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded ${getBiasColor(item.bias)}`}>{item.bias}</span>
      <span className="text-indigo-300 font-bold">{item.setupScore}</span>
    </div>
  </Link>
));

const BreakoutRow = memo(({ item }: { item: BreakoutItem }) => (
  <Link
    to={`/stocks/${item.symbol}`}
    className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/5 transition group"
  >
    <div>
      <p className="font-semibold text-white group-hover:text-yellow-300 transition text-sm">{item.symbol}</p>
      <p className="text-xs text-gray-500">
        OR {formatPrice(item.openRangeLow)}–{formatPrice(item.openRangeHigh)}
      </p>
    </div>
    <div className="flex items-center gap-4 text-sm">
      <span className={`text-xs font-bold px-2 py-0.5 rounded ${item.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
        {item.direction}
      </span>
      <span className="text-yellow-400 font-bold">+{item.breakoutPercent.toFixed(2)}%</span>
    </div>
  </Link>
));

const SRRow = memo(({ item }: { item: SRProximityItem }) => (
  <Link
    to={`/stocks/${item.symbol}`}
    className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/5 transition group"
  >
    <div>
      <p className="font-semibold text-white group-hover:text-cyan-300 transition text-sm">{item.symbol}</p>
      <p className="text-xs text-gray-500">Level: {formatPrice(item.level)}</p>
    </div>
    <div className="flex items-center gap-4 text-sm">
      <span className="text-gray-300">{formatPrice(item.lastClose)}</span>
      <span className="text-cyan-400 font-bold">{item.distancePercent.toFixed(2)}% away</span>
    </div>
  </Link>
));

const PatternRow = memo(({ item }: { item: PatternItem }) => (
  <Link
    to={`/stocks/${item.symbol}`}
    className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/5 transition group"
  >
    <div>
      <p className="font-semibold text-white group-hover:text-pink-300 transition text-sm">{item.symbol}</p>
      <p className="text-xs text-gray-500">{item.patternName}</p>
    </div>
    <div className="flex items-center gap-4 text-sm">
      <span className={`text-xs font-medium px-2 py-0.5 rounded ${item.patternDirection === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-400' : item.patternDirection === 'BEARISH' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
        {item.patternDirection}
      </span>
      <span className="text-pink-400 font-bold">{item.confidence}%</span>
    </div>
  </Link>
));

// ---- Main Page ----
export const Radar = () => {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['radar-sections'],
    queryFn: () => api.radar.getSections(15, 10, 1.5),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const updatedTime = useMemo(
    () => (dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN') : null),
    [dataUpdatedAt]
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <RadarIcon className="w-8 h-8 text-indigo-500" />
            Market Radar
          </h1>
          <p className="text-gray-400 text-sm">Live intraday scanning across all instruments</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {updatedTime && (
        <p className="text-xs text-gray-600">Last updated: {updatedTime}</p>
      )}

      {/* Row 1: Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Top Gainers" icon={<TrendingUp className="w-4 h-4" />} count={data?.topGainers.length} isLoading={isLoading} accent="emerald">
          {data?.topGainers.length ? data.topGainers.map(item => <MoverRow key={item.symbol} item={item} isGainer={true} />) : <EmptyState label="No gainers found" />}
        </Section>

        <Section title="Top Losers" icon={<TrendingDown className="w-4 h-4" />} count={data?.topLosers.length} isLoading={isLoading} accent="red">
          {data?.topLosers.length ? data.topLosers.map(item => <MoverRow key={item.symbol} item={item} isGainer={false} />) : <EmptyState label="No losers found" />}
        </Section>
      </div>

      {/* Row 2: Breakouts + Sector Leaders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="30-Min Breakouts" icon={<Zap className="w-4 h-4" />} count={data?.breakouts30Min.length} isLoading={isLoading} accent="yellow">
          {data?.breakouts30Min.length ? data.breakouts30Min.map(item => <BreakoutRow key={item.symbol} item={item} />) : <EmptyState label="No breakouts detected" />}
        </Section>

        <Section title="Sector Leaders" icon={<Layers className="w-4 h-4" />} count={data?.sectorLeaders.length} isLoading={isLoading} accent="purple">
          {data?.sectorLeaders.length ? data.sectorLeaders.map(item => <SectorRow key={`${item.exchange}-${item.symbol}`} item={item} />) : <EmptyState label="No sector leaders found" />}
        </Section>
      </div>

      {/* Row 3: Near S/R */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Near Support" icon={<ArrowUpCircle className="w-4 h-4" />} count={data?.nearSupport.length} isLoading={isLoading} accent="cyan">
          {data?.nearSupport.length ? data.nearSupport.map(item => <SRRow key={`${item.symbol}-S`} item={item} />) : <EmptyState label="None near support" />}
        </Section>

        <Section title="Near Resistance" icon={<ArrowDownCircle className="w-4 h-4" />} count={data?.nearResistance.length} isLoading={isLoading} accent="orange">
          {data?.nearResistance.length ? data.nearResistance.map(item => <SRRow key={`${item.symbol}-R`} item={item} />) : <EmptyState label="None near resistance" />}
        </Section>
      </div>

      {/* Row 4: Patterns (full width) */}
      <Section title="Pattern Formations" icon={<Activity className="w-4 h-4" />} count={data?.patterns.length} isLoading={isLoading} accent="pink">
        {data?.patterns.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {data.patterns.map(item => <PatternRow key={`${item.symbol}-${item.patternName}`} item={item} />)}
          </div>
        ) : (
          <EmptyState label="No patterns detected" />
        )}
      </Section>
    </div>
  );
};
