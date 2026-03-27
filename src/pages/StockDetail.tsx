import { useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Star, BarChart2, FlaskConical, Check, ChevronDown, XCircle, Play, Pause, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import type { Analysis, BacktestRequest, BacktestTrade, Candle, EquityPoint, Stock } from '../services/api';
import { useWatchlistStore } from '../store/watchlist';
import { useBacktestStore } from '../store/backtest';
import { CandleChart } from '../components/CandleChart';
import { BacktestControls } from '../components/backtest/BacktestControls';
import { BacktestMetricsBar } from '../components/backtest/BacktestMetrics';
import { BacktestChart } from '../components/backtest/BacktestChart';
import { TradeListPanel } from '../components/backtest/TradeListPanel';
import { EquityCurve } from '../components/backtest/EquityCurve';
import { formatPrice, formatPercent, getSignalColor } from '../utils/formatters';

type Tab = 'analysis' | 'backtest';
type IndicatorKey = 'ema' | 'bollinger' | 'rsi' | 'macd';
type CandleEnvelope = { data?: Candle[]; candles?: Candle[] };
type ReplaySpeed = 0.5 | 1 | 2 | 5;

interface ReplayEvent {
  id: string;
  type: 'trade_placed' | 'trade_exited';
  message: string;
  at: string;
  tradeId: string;
}

const CANDLE_CACHE_KEY = 'tradefinder360:candles:v1';
const MAX_CACHED_INSTRUMENTS = 5;

type CandleCacheRecord = {
  order: string[];
  entries: Record<
    string,
    {
      updatedAt: number;
      timeframes: Record<string, Candle[]>;
    }
  >;
};

const getDefaultCandleCache = (): CandleCacheRecord => ({
  order: [],
  entries: {},
});

const readCandleCache = (): CandleCacheRecord => {
  if (typeof window === 'undefined') return getDefaultCandleCache();

  try {
    const raw = window.localStorage.getItem(CANDLE_CACHE_KEY);
    if (!raw) return getDefaultCandleCache();

    const parsed = JSON.parse(raw) as CandleCacheRecord;
    if (!parsed?.entries || !Array.isArray(parsed.order)) {
      return getDefaultCandleCache();
    }

    return parsed;
  } catch {
    return getDefaultCandleCache();
  }
};

const writeCandleCache = (cache: CandleCacheRecord) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CANDLE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota/storage errors to avoid breaking chart rendering.
  }
};

const getCachedCandles = (symbol: string, timeframe: number): Candle[] => {
  const cache = readCandleCache();
  return cache.entries[symbol]?.timeframes?.[String(timeframe)] ?? [];
};

const setCachedCandles = (symbol: string, timeframe: number, candles: Candle[]) => {
  if (!candles.length) return;

  const cache = readCandleCache();
  const existing = cache.entries[symbol] ?? { updatedAt: Date.now(), timeframes: {} };

  cache.entries[symbol] = {
    ...existing,
    updatedAt: Date.now(),
    timeframes: {
      ...existing.timeframes,
      [String(timeframe)]: candles,
    },
  };

  cache.order = [symbol, ...cache.order.filter((s) => s !== symbol)];

  while (cache.order.length > MAX_CACHED_INSTRUMENTS) {
    const evicted = cache.order.pop();
    if (evicted) {
      delete cache.entries[evicted];
    }
  }

  writeCandleCache(cache);
};

interface StockDetailInnerProps {
  stock: Stock;
  symbol: string;
}

type WhyNoTradeCode =
  | 'NOT_PULLBACK_READY'
  | 'LOW_VOLUME'
  | 'WEAK_TREND'
  | 'RISK_TOO_HIGH'
  | 'CONFLICTING_SIGNALS'
  | 'OUTSIDE_TRADING_WINDOW'
  | 'OTHER';

interface ExtendedEntryGuidance {
  direction: 'BUY' | 'SELL' | 'NONE';
  entryPrice: number;
  stopLoss: number;
  target: number;
  riskRewardRatio: number;
  optionType?: 'CE' | 'PE';
  optionStrike?: number;
  confidenceBreakdown?: {
    trend: number;
    momentum: number;
    volume: number;
    structure: number;
    volatility: number;
    total: number;
  };
  expectedHoldingMinutes?: number | null;
  maxAdverseExcursionPct?: number | null;
  maxFavorableExcursionPct?: number | null;
}

type ExtendedAnalysis = Omit<Analysis, 'entryGuidance'> & {
  entryGuidance: ExtendedEntryGuidance | null;
  noTradeContext?: {
    whyNoTradeCode: WhyNoTradeCode;
    whyNoTradeMessage: string;
    nextTriggerPrice: number | null;
    nextTriggerCondition: string | null;
    estimatedRecheckMinutes: number | null;
    invalidatesAt: string | null;
  } | null;
  volumeContext?: {
    currentVolume: number;
    volume20Avg: number;
    relativeVolume: number;
    deliveryVolumeRatio: number | null;
    isAboveAverage: boolean;
  } | null;
  structureLevels?: {
    sessionHigh: number | null;
    sessionLow: number | null;
    previousDayHigh: number | null;
    previousDayLow: number | null;
    nearestSupport: number | null;
    nearestResistance: number | null;
    pivot: number | null;
    r1: number | null;
    s1: number | null;
  } | null;
  signalTiming?: {
    signalAgeBars: number | null;
    barsSinceMacdCross: number | null;
    barsSinceRsiZoneExit: number | null;
    signalFreshnessScore: number;
  } | null;
  marketRegime?: {
    volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH';
    trendStrengthScore: number;
    rangeCompressionScore: number;
    momentumQualityScore: number;
  } | null;
};

const getTrendDisplayState = (
  analysis: { trendState: Analysis['trendState'] }
): 'STRONG_UP' | 'WEAK_UP' | 'SIDEWAYS' | 'WEAK_DOWN' | 'STRONG_DOWN' => {
  const score = analysis.trendState.setupScore;
  if (analysis.trendState.state === 'TRENDING_BULLISH') {
    return score >= 70 ? 'STRONG_UP' : 'WEAK_UP';
  }
  if (analysis.trendState.state === 'TRENDING_BEARISH') {
    return score >= 70 ? 'STRONG_DOWN' : 'WEAK_DOWN';
  }
  if (analysis.trendState.state === 'PULLBACK_READY') {
    return score >= 70 ? 'STRONG_UP' : 'WEAK_UP';
  }
  return 'SIDEWAYS';
};

const getTrendBadgeClass = (trend: ReturnType<typeof getTrendDisplayState>) => {
  switch (trend) {
    case 'STRONG_UP':
      return 'text-green-300 bg-green-500/20 border-green-500/40';
    case 'WEAK_UP':
      return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30';
    case 'STRONG_DOWN':
      return 'text-red-300 bg-red-500/20 border-red-500/40';
    case 'WEAK_DOWN':
      return 'text-orange-300 bg-orange-500/20 border-orange-500/35';
    default:
      return 'text-gray-300 bg-gray-500/15 border-gray-500/35';
  }
};

const getScoreBarClass = (score: number) => {
  if (score > 70) return 'bg-green-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const isCandleEnvelope = (value: unknown): value is CandleEnvelope => {
  if (!value || typeof value !== 'object') return false;
  return 'data' in value || 'candles' in value;
};

export const StockDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();

  const { data: stock } = useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => api.instruments.getDetail(symbol!),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  if (!stock || !symbol) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return <StockDetailInner stock={stock} symbol={symbol} />;
};

const StockDetailInner = ({ stock, symbol }: StockDetailInnerProps) => {
  const [timeframe, setTimeframe] = useState(15);
  const [hasChangedTimeframe, setHasChangedTimeframe] = useState(false);
  const [isIndicatorMenuOpen, setIsIndicatorMenuOpen] = useState(false);
  const [selectedIndicators, setSelectedIndicators] = useState<IndicatorKey[]>(['rsi', 'macd']);
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [backtestRequest, setBacktestRequest] = useState<BacktestRequest | null>(null);
  const [isReplayMode, setIsReplayMode] = useState(true);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<ReplaySpeed>(1);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayEvents, setReplayEvents] = useState<ReplayEvent[]>([]);
  const [activeReplayEvent, setActiveReplayEvent] = useState<ReplayEvent | null>(null);
  const indicatorMenuRef = useRef<HTMLDivElement>(null);
  const replayFrameRef = useRef<number | null>(null);
  const replayLastTsRef = useRef<number | null>(null);
  const replayAccumulatorRef = useRef(0);
  const replayEntrySeenRef = useRef<Set<string>>(new Set());
  const replayExitSeenRef = useRef<Set<string>>(new Set());
  const replayEventClearRef = useRef<number | null>(null);

  const { toggle, isWatched } = useWatchlistStore();
  const { selectedTradeId, hoveredTradeId, setSelectedTrade, setHoveredTrade } =
    useBacktestStore();

  const normalizeCandleResponse = (res: Candle[] | CandleEnvelope | unknown): Candle[] => {
    if (Array.isArray(res)) return res as Candle[];
    if (!isCandleEnvelope(res)) return [];
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.candles)) return res.candles;
    return [];
  };

  const instrumentCandles = useMemo(() => {
    if (!stock) return [];
    return normalizeCandleResponse(stock.candles);
  }, [stock]);

  const cachedCandles = useMemo(() => {
    if (!symbol) return [];
    return getCachedCandles(symbol, timeframe);
  }, [symbol, timeframe]);

  const shouldFetchCandles =
    !!symbol && !cachedCandles.length && (hasChangedTimeframe || instrumentCandles.length === 0);

  const { data: fetchedCandles = [] } = useQuery({
    queryKey: ['candles', symbol, timeframe],
    queryFn: async () => {
      const res = await api.candles.get(symbol!, timeframe);
      const normalized = normalizeCandleResponse(res);
      if (!normalized.length) {
        console.error('Invalid candles response:', res);
      }
      return normalized;
    },
    enabled: shouldFetchCandles,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const candleSource: 'cache' | 'instrument' | 'api' | 'empty' = useMemo(() => {
    if (cachedCandles.length) return 'cache';
    if (!hasChangedTimeframe && instrumentCandles.length) return 'instrument';
    if (fetchedCandles.length) return 'api';
    return 'empty';
  }, [cachedCandles, fetchedCandles, hasChangedTimeframe, instrumentCandles]);

  const candleSourceStyle: Record<typeof candleSource, string> = {
    cache: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
    instrument: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
    api: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
    empty: 'text-gray-300 border-gray-600 bg-gray-800/60',
  };

  const candles = useMemo(() => {
    if (cachedCandles.length) return cachedCandles;
    if (!hasChangedTimeframe && instrumentCandles.length) return instrumentCandles;
    return fetchedCandles;
  }, [cachedCandles, fetchedCandles, hasChangedTimeframe, instrumentCandles]);

  useEffect(() => {
    if (!symbol || !instrumentCandles.length || hasChangedTimeframe) return;
    setCachedCandles(symbol, timeframe, instrumentCandles);
  }, [symbol, timeframe, instrumentCandles, hasChangedTimeframe]);

  useEffect(() => {
    if (!symbol || !fetchedCandles.length) return;
    setCachedCandles(symbol, timeframe, fetchedCandles);
  }, [symbol, timeframe, fetchedCandles]);

  const shouldFetchIndicators =
    !!symbol &&
    (activeTab === 'analysis' || activeTab === 'backtest') &&
    selectedIndicators.length > 0;

  const { data: analysis, isLoading: isAnalysisLoading } = useQuery({
    queryKey: ['analysis', symbol, timeframe],
    queryFn: () => api.instruments.getAnalysis(symbol!, timeframe),
    enabled: !!symbol && activeTab === 'analysis',
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: indicators = [] } = useQuery({
    queryKey: ['indicators', symbol, timeframe],
    queryFn: () => api.instruments.getIndicators(symbol!, timeframe),
    enabled: shouldFetchIndicators,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const analysisData = analysis as ExtendedAnalysis | undefined;

  // Backtest query — only runs when a request is submitted
  const {
    data: backtestResult,
    isLoading: backtestLoading,
    error: backtestError,
  } = useQuery({
    queryKey: ['backtest', symbol, backtestRequest],
    queryFn: () => api.backtest.run(backtestRequest!),
    enabled: !!backtestRequest,
    staleTime: Infinity,
    retry: false,
  });

  const timeframes = [
    { label: '1M', value: 1 },
    { label: '15M', value: 15 },
    { label: '1D', value: 1440 },
  ];

  const handleRunBacktest = (req: BacktestRequest) => {
    setSelectedTrade(null);
    setIsReplayMode(true);
    setIsReplayPlaying(false);
    setReplayIndex(0);
    setReplayEvents([]);
    setActiveReplayEvent(null);
    replayEntrySeenRef.current.clear();
    replayExitSeenRef.current.clear();
    setBacktestRequest(req);
  };

  const replaySourceCandles = candles;
  const replayTotalCandles = replaySourceCandles.length;

  const replayNowMs = useMemo(() => {
    if (!isReplayMode || !backtestResult || replayTotalCandles === 0) return null;
    const safeIndex = Math.min(Math.max(replayIndex, 0), replayTotalCandles - 1);
    return new Date(replaySourceCandles[safeIndex].timestamp).getTime();
  }, [isReplayMode, backtestResult, replayIndex, replaySourceCandles, replayTotalCandles]);

  const visibleReplayCandles = useMemo(() => {
    if (!isReplayMode || !backtestResult || replayTotalCandles === 0) return replaySourceCandles;
    const count = Math.max(1, Math.min(replayIndex + 1, replayTotalCandles));
    return replaySourceCandles.slice(0, count);
  }, [isReplayMode, backtestResult, replayIndex, replaySourceCandles, replayTotalCandles]);

  const allBacktestTrades = backtestResult?.trades ?? [];

  const visibleTrades = useMemo(() => {
    if (!isReplayMode || replayNowMs === null) return allBacktestTrades;
    return allBacktestTrades.filter((trade) => new Date(trade.entryTime).getTime() <= replayNowMs);
  }, [allBacktestTrades, isReplayMode, replayNowMs]);

  const exitedTrades = useMemo(() => {
    if (!isReplayMode || replayNowMs === null) return allBacktestTrades;
    return allBacktestTrades.filter((trade) => new Date(trade.exitTime).getTime() <= replayNowMs);
  }, [allBacktestTrades, isReplayMode, replayNowMs]);

  const runningPnl = useMemo(
    () => exitedTrades.reduce((sum: number, trade: BacktestTrade) => sum + trade.pnl, 0),
    [exitedTrades]
  );

  const visibleEquityCurve = useMemo(() => {
    const fullCurve = backtestResult?.metrics.equityCurve ?? [];
    if (!isReplayMode || replayNowMs === null || !fullCurve.length) return fullCurve;

    const filtered = fullCurve.filter((point: EquityPoint) => new Date(point.timestamp).getTime() <= replayNowMs);
    return filtered.length ? filtered : [fullCurve[0]];
  }, [backtestResult?.metrics.equityCurve, isReplayMode, replayNowMs]);

  const resetReplay = () => {
    setIsReplayPlaying(false);
    setReplayIndex(0);
    setReplayEvents([]);
    setActiveReplayEvent(null);
    replayEntrySeenRef.current.clear();
    replayExitSeenRef.current.clear();
  };

  useEffect(() => {
    if (!backtestResult || replayTotalCandles === 0) return;
    setIsReplayMode(true);
    setIsReplayPlaying(false);
    setReplayIndex(0);
    setReplayEvents([]);
    setActiveReplayEvent(null);
    replayEntrySeenRef.current.clear();
    replayExitSeenRef.current.clear();
  }, [backtestResult, replayTotalCandles]);

  useEffect(() => {
    if (!isReplayMode || !isReplayPlaying || replayTotalCandles <= 1) return;

    const STEP_MS = 450;
    const tick = (ts: number) => {
      if (!isReplayPlaying) return;

      if (replayLastTsRef.current === null) {
        replayLastTsRef.current = ts;
      }

      const delta = ts - (replayLastTsRef.current ?? ts);
      replayLastTsRef.current = ts;
      replayAccumulatorRef.current += delta * replaySpeed;

      let steps = 0;
      while (replayAccumulatorRef.current >= STEP_MS) {
        replayAccumulatorRef.current -= STEP_MS;
        steps += 1;
      }

      if (steps > 0) {
        let reachedEnd = false;
        setReplayIndex((prev) => {
          const next = Math.min(prev + steps, replayTotalCandles - 1);
          reachedEnd = next >= replayTotalCandles - 1;
          return next;
        });

        if (reachedEnd) {
          setIsReplayPlaying(false);
          return;
        }
      }

      replayFrameRef.current = window.requestAnimationFrame(tick);
    };

    replayFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (replayFrameRef.current !== null) {
        window.cancelAnimationFrame(replayFrameRef.current);
        replayFrameRef.current = null;
      }
    };
  }, [isReplayMode, isReplayPlaying, replaySpeed, replayTotalCandles]);

  useEffect(() => {
    if (isReplayPlaying) return;
    replayLastTsRef.current = null;
    replayAccumulatorRef.current = 0;
    if (replayFrameRef.current !== null) {
      window.cancelAnimationFrame(replayFrameRef.current);
      replayFrameRef.current = null;
    }
  }, [isReplayPlaying]);

  useEffect(() => {
    if (!isReplayMode || replayNowMs === null || !backtestResult) return;

    const nextEvents: ReplayEvent[] = [];

    for (const trade of backtestResult.trades) {
      const entryMs = new Date(trade.entryTime).getTime();
      const exitMs = new Date(trade.exitTime).getTime();

      if (entryMs <= replayNowMs && !replayEntrySeenRef.current.has(trade.id)) {
        replayEntrySeenRef.current.add(trade.id);
        const riskReward = trade.riskRewardRatio ? formatPrice(trade.riskRewardRatio, 2) : 'N/A';
        const qty = trade.quantity ? ` @ ${trade.quantity} qty` : '';
        nextEvents.push({
          id: `${trade.id}:entry`,
          type: 'trade_placed',
          tradeId: trade.id,
          at: trade.entryTime,
          message: `Entry: ${trade.tradeType} @ ${formatPrice(trade.entryPrice)} | RR: ${riskReward}${qty}`,
        });
      }

      if (exitMs <= replayNowMs && !replayExitSeenRef.current.has(trade.id)) {
        replayExitSeenRef.current.add(trade.id);
        const pnlText = `${trade.pnl >= 0 ? '+' : ''}${formatPrice(trade.pnl)}`;
        const rrRealized = trade.maxProfit ? formatPrice(trade.maxProfit / Math.max(1, trade.totalRisk || 1), 2) : 'N/A';
        nextEvents.push({
          id: `${trade.id}:exit`,
          type: 'trade_exited',
          tradeId: trade.id,
          at: trade.exitTime,
          message: `Exit @ ${formatPrice(trade.exitPrice)} | ${trade.pnl >= 0 ? 'Profit' : 'Loss'}: ${pnlText} | Realized RR: ${rrRealized}`,
        });
      }
    }

    if (!nextEvents.length) return;

    nextEvents.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const latest = nextEvents[nextEvents.length - 1];

    setReplayEvents((prev) => [...nextEvents.reverse(), ...prev].slice(0, 20));
    setActiveReplayEvent(latest);

    if (replayEventClearRef.current !== null) {
      window.clearTimeout(replayEventClearRef.current);
    }
    replayEventClearRef.current = window.setTimeout(() => setActiveReplayEvent(null), 1800);
  }, [isReplayMode, replayNowMs, backtestResult]);

  useEffect(() => {
    if (!selectedTradeId || !isReplayMode) return;
    if (visibleTrades.some((trade) => trade.id === selectedTradeId)) return;
    setSelectedTrade(null);
  }, [isReplayMode, selectedTradeId, setSelectedTrade, visibleTrades]);

  useEffect(() => {
    return () => {
      if (replayEventClearRef.current !== null) {
        window.clearTimeout(replayEventClearRef.current);
      }
      if (replayFrameRef.current !== null) {
        window.cancelAnimationFrame(replayFrameRef.current);
      }
    };
  }, []);

  const TABS: { id: Tab; label: string; icon: ElementType }[] = [
    { id: 'analysis', label: 'Chart Analysis', icon: BarChart2 },
    { id: 'backtest', label: 'Backtesting', icon: FlaskConical },
  ];

  const indicatorOptions: Array<{ key: IndicatorKey; label: string }> = [
    { key: 'ema', label: 'EMA' },
    { key: 'bollinger', label: 'Bollinger Bands' },
    { key: 'rsi', label: 'RSI Panel' },
    { key: 'macd', label: 'MACD Panel' },
  ];

  const toggleIndicator = (key: IndicatorKey) => {
    setSelectedIndicators((prev: IndicatorKey[]) =>
      prev.includes(key) ? prev.filter((item: IndicatorKey) => item !== key) : [...prev, key]
    );
  };

  const hasIndicator = (key: IndicatorKey) => selectedIndicators.includes(key);

  const indicatorSeries = indicators.length
    ? indicators
    : analysisData?.indicators
    ? [analysisData.indicators]
    : [];

  const latestIndicator = indicatorSeries.length ? indicatorSeries[indicatorSeries.length - 1] : null;
  const previousIndicator = indicatorSeries.length > 1 ? indicatorSeries[indicatorSeries.length - 2] : null;
  const recentRsi = indicatorSeries.slice(-3).map((item: { rsi: number }) => item.rsi);

  const trendDisplayState = analysisData ? getTrendDisplayState(analysisData) : 'SIDEWAYS';
  const guidanceDirection = analysisData?.entryGuidance?.direction ?? 'NONE';
  const biasDirection =
    guidanceDirection !== 'NONE'
      ? guidanceDirection === 'BUY'
        ? 'LONG'
        : 'SHORT'
      : analysisData?.trendState.bias === 'BULLISH'
      ? 'LONG'
      : analysisData?.trendState.bias === 'BEARISH'
      ? 'SHORT'
      : 'NEUTRAL';
  const setupScore = analysisData?.trendState.setupScore ?? 0;

  const latestClose = candles.length ? candles[candles.length - 1].close : stock.lastClose;
  const emaFast = latestIndicator?.emaFast ?? 0;
  const emaSlow = latestIndicator?.emaSlow ?? 0;

  const emaAlignment =
    emaFast > emaSlow ? 'Bullish Fast > Slow' : emaFast < emaSlow ? 'Bearish Fast < Slow' : 'Flat EMA Alignment';

  const priceVsEma =
    latestClose > emaFast && latestClose > emaSlow
      ? 'Price above both EMAs'
      : latestClose < emaFast && latestClose < emaSlow
      ? 'Price below both EMAs'
      : 'Price between EMAs';

  const rsiValue = latestIndicator?.rsi ?? 50;
  const rsiColor = rsiValue < 40 ? 'text-green-400' : rsiValue > 70 ? 'text-red-400' : 'text-gray-300';
  const rsiTrend =
    recentRsi.length >= 3
      ? recentRsi[2] > recentRsi[1] && recentRsi[1] > recentRsi[0]
        ? 'Rising'
        : recentRsi[2] < recentRsi[1] && recentRsi[1] < recentRsi[0]
        ? 'Falling'
        : 'Mixed'
      : 'Insufficient data';

  const macdHistogram = latestIndicator?.macdHistogram ?? 0;
  const macdBias = macdHistogram >= 0 ? 'Positive' : 'Negative';
  const macdCross =
    previousIndicator && latestIndicator
      ? previousIndicator.macdHistogram <= 0 && latestIndicator.macdHistogram > 0
        ? 'Bullish cross'
        : previousIndicator.macdHistogram >= 0 && latestIndicator.macdHistogram < 0
        ? 'Bearish cross'
        : 'No fresh cross'
      : 'Insufficient data';

  const currentVolume = candles.length ? candles[candles.length - 1].volume : 0;
  const avgVolume20 =
    candles.slice(-20).reduce((acc: number, candle: Candle) => acc + candle.volume, 0) /
    Math.max(Math.min(candles.length, 20), 1);
  const volumeCurrent = analysisData?.volumeContext?.currentVolume ?? currentVolume;
  const volumeAvg = analysisData?.volumeContext?.volume20Avg ?? avgVolume20;
  const relativeVolume = analysisData?.volumeContext?.relativeVolume ?? (volumeAvg ? volumeCurrent / volumeAvg : 0);
  const volumeState = relativeVolume >= 1 ? 'Above 20-period avg' : 'Below 20-period avg';

  const bollUpper = latestIndicator?.bollingerUpper ?? latestClose;
  const bollMid = latestIndicator?.bollingerMiddle ?? latestClose;
  const bollLower = latestIndicator?.bollingerLower ?? latestClose;
  const distanceToUpper = bollUpper ? ((bollUpper - latestClose) / latestClose) * 100 : 0;
  const distanceToMiddle = bollMid ? ((bollMid - latestClose) / latestClose) * 100 : 0;
  const distanceToLower = bollLower ? ((latestClose - bollLower) / latestClose) * 100 : 0;
  const outsideBands = latestClose > bollUpper || latestClose < bollLower;

  const trendPoints = trendDisplayState.includes('UP') ? 2.5 : trendDisplayState.includes('DOWN') ? 0.5 : 1.2;
  const rsiPoints = rsiValue < 40 ? 2.2 : rsiValue > 70 ? 0.8 : 1.6;
  const macdPoints = macdHistogram > 0 ? 2.2 : 1.0;
  const emaPoints = latestClose > emaFast && latestClose > emaSlow ? 2.1 : latestClose < emaFast && latestClose < emaSlow ? 0.8 : 1.4;
  const regimeBoost = analysisData?.marketRegime ? analysisData.marketRegime.momentumQualityScore / 100 : 0;
  const freshnessBoost = analysisData?.signalTiming ? analysisData.signalTiming.signalFreshnessScore / 100 : 0;
  const signalStrength = clamp(trendPoints + rsiPoints + macdPoints + emaPoints + regimeBoost + freshnessBoost, 0, 10);
  const ringHue = signalStrength >= 7 ? '#22c55e' : signalStrength >= 4 ? '#f59e0b' : '#ef4444';

  const bullishSignals: string[] = [];
  const bearishSignals: string[] = [];
  if (emaFast > emaSlow) bullishSignals.push('Fast EMA above Slow EMA');
  else bearishSignals.push('Fast EMA below Slow EMA');
  if (latestClose > emaFast && latestClose > emaSlow) bullishSignals.push('Price above EMA structure');
  if (latestClose < emaFast && latestClose < emaSlow) bearishSignals.push('Price below EMA structure');
  if (rsiValue < 40) bullishSignals.push('RSI in oversold recovery zone');
  if (rsiValue > 70) bearishSignals.push('RSI in overbought zone');
  if (macdHistogram >= 0) bullishSignals.push('MACD histogram positive');
  else bearishSignals.push('MACD histogram negative');

  const analysisCardClass =
    'bg-gradient-to-b from-[#12121a]/75 to-[#0f1017]/70 backdrop-blur-xl border border-gray-800/60 rounded-xl p-5 shadow-[0_8px_24px_rgba(0,0,0,0.28)]';
  const analysisTitleClass = 'text-[11px] uppercase tracking-[0.14em] text-gray-400 mb-4';

  useEffect(() => {
    if (!isIndicatorMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!indicatorMenuRef.current) return;
      if (!indicatorMenuRef.current.contains(event.target as Node)) {
        setIsIndicatorMenuOpen(false);
      }
    };

    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isIndicatorMenuOpen]);

  return (
    <div className="w-full max-w-none">
      {/* Top Bar */}
      <div className="mb-5 flex items-center justify-between">
        <Link to="/stocks" className="flex items-center text-gray-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Explorer
        </Link>
        <button
          onClick={() => toggle(symbol!)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
            isWatched(symbol!)
              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          <Star className={`w-4 h-4 ${isWatched(symbol!) ? 'fill-yellow-400' : ''}`} />
          <span>{isWatched(symbol!) ? 'In Watchlist' : 'Add to Watchlist'}</span>
        </button>
      </div>

      {/* Symbol Header */}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">{stock.symbol}</h1>
          <p className="text-gray-400 text-sm mt-0.5">{stock.name}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{formatPrice(stock.lastClose)}</p>
          <p className={`text-sm font-semibold ${stock.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(stock.changePercent)}
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex space-x-1 bg-[#12121a]/60 border border-gray-800/50 rounded-xl p-1 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === id
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {analysisData && activeTab === 'analysis' && (
          <div className="bg-[#12121a]/60 border border-gray-800/50 rounded-lg px-4 py-2 flex items-center gap-3 w-fit">
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">Trend</p>
              <p className="text-gray-100 font-semibold text-xs">{trendDisplayState.replace('_', ' ')}</p>
            </div>
            <div className="w-px h-6 bg-gray-700/40"></div>
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">Signal</p>
              <p className="font-semibold text-xs" style={{ color: ringHue }}>{signalStrength.toFixed(1)}</p>
            </div>
            <div className="w-px h-6 bg-gray-700/40"></div>
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">Bias</p>
              <p className={`font-semibold text-xs ${biasDirection === 'LONG' ? 'text-green-300' : biasDirection === 'SHORT' ? 'text-red-300' : 'text-gray-300'}`}>
                {biasDirection}
              </p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* ── ANALYSIS TAB ──────────────────────────────────────────────── */}
        {activeTab === 'analysis' && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <div className="space-y-6">
              <div className="space-y-6">
                <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4 md:p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-md border ${candleSourceStyle[candleSource]}`}
                        title="Candles data source"
                      >
                        Cache: {candleSource.toUpperCase()}
                      </span>

                      <div ref={indicatorMenuRef} className="relative">
                      <button
                        onClick={() => setIsIndicatorMenuOpen((prev: boolean) => !prev)}
                        className="flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:text-white transition"
                      >
                        <span>Indicators</span>
                        {selectedIndicators.length > 0 && (
                          <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full">
                            {selectedIndicators.length}
                          </span>
                        )}
                        <ChevronDown className={`w-4 h-4 transition ${isIndicatorMenuOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isIndicatorMenuOpen && (
                        <div className="absolute z-20 mt-2 w-56 rounded-lg border border-gray-700 bg-[#0f0f16] shadow-xl p-2">
                          {indicatorOptions.map((option) => (
                            <button
                              key={option.key}
                              onClick={() => toggleIndicator(option.key)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
                            >
                              <span>{option.label}</span>
                              {hasIndicator(option.key) && <Check className="w-4 h-4 text-indigo-400" />}
                            </button>
                          ))}
                        </div>
                      )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 rounded-lg text-sm font-medium bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
                        Analysis On
                      </span>

                      {timeframes.map((tf) => (
                        <button
                          key={tf.value}
                          onClick={() => {
                            if (tf.value !== timeframe) {
                              setHasChangedTimeframe(true);
                              setTimeframe(tf.value);
                            }
                          }}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                            timeframe === tf.value
                              ? 'bg-indigo-500 text-white'
                              : 'bg-gray-800 text-gray-400 hover:text-white'
                          }`}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <CandleChart
                    candles={candles}
                    indicators={indicators}
                    showEMA={hasIndicator('ema')}
                    showBollinger={hasIndicator('bollinger')}
                    showRSI={hasIndicator('rsi')}
                    showMACD={hasIndicator('macd')}
                  />
                </div>
              </div>

              <div className="space-y-6">
                {analysisData && (
                  <div className="grid grid-cols-3 gap-5">
                    <div className={analysisCardClass}>
                      <h3 className={analysisTitleClass}>Trend Summary</h3>
                      <div className="space-y-3">
                        <div className={`text-sm font-bold px-3 py-2 rounded-lg border w-fit ${getTrendBadgeClass(trendDisplayState)}`}>
                          {trendDisplayState}
                        </div>
                        <div>
                          <div className="flex justify-between mb-1 text-sm">
                            <span className="text-gray-400">Setup Score</span>
                            <span className="text-white font-semibold">{setupScore}</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2.5">
                            <div
                              className={`h-2.5 rounded-full ${getScoreBarClass(setupScore)}`}
                              style={{ width: `${clamp(setupScore, 0, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex justify-between bg-[#0a0a0f]/50 rounded px-3 py-2">
                            <span className="text-gray-400">EMA Alignment</span>
                            <span className={emaFast >= emaSlow ? 'text-green-300' : 'text-red-300'}>{emaAlignment}</span>
                          </div>
                          <div className="flex justify-between bg-[#0a0a0f]/50 rounded px-3 py-2">
                            <span className="text-gray-400">Price vs EMA</span>
                            <span className="text-gray-200">{priceVsEma}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {analysisData.entryGuidance && analysisData.entryGuidance.direction !== 'NONE' && (() => {
                      const entry = analysisData.entryGuidance.entryPrice;
                      const stop = analysisData.entryGuidance.stopLoss;
                      const target = analysisData.entryGuidance.target;
                      const ladderMin = Math.min(entry, stop, target);
                      const ladderMax = Math.max(entry, stop, target);
                      const range = Math.max(ladderMax - ladderMin, 0.0001);
                      const entryPct = ((entry - ladderMin) / range) * 100;
                      const stopPct = ((stop - ladderMin) / range) * 100;
                      const targetPct = ((target - ladderMin) / range) * 100;
                      const riskPct = Math.abs((entry - stop) / entry) * 100;
                      const directionText = analysisData.entryGuidance.direction === 'BUY' ? 'LONG' : 'SHORT';

                      return (
                        <div className={analysisCardClass}>
                          <h3 className={analysisTitleClass}>Entry Guidance</h3>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs px-3 py-1 rounded border font-semibold ${getSignalColor(analysisData.entryGuidance.direction)}`}>
                                {directionText}
                              </span>
                              <span className="text-xs text-gray-400">Confidence {analysisData.confidence.toFixed(1)}%</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="bg-[#0a0a0f]/60 border border-gray-800/60 rounded p-2">
                                <p className="text-gray-400 mb-1">Entry</p>
                                <p className="text-white font-semibold tabular-nums">{formatPrice(entry)}</p>
                              </div>
                              <div className="bg-[#0a0a0f]/60 border border-gray-800/60 rounded p-2">
                                <p className="text-gray-400 mb-1">Stop Loss</p>
                                <p className="text-red-400 font-semibold tabular-nums">{formatPrice(stop)}</p>
                              </div>
                              <div className="bg-[#0a0a0f]/60 border border-gray-800/60 rounded p-2">
                                <p className="text-gray-400 mb-1">Target</p>
                                <p className="text-green-400 font-semibold tabular-nums">{formatPrice(target)}</p>
                              </div>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Risk : Reward</span>
                              <span className="text-white font-semibold">1 : {analysisData.entryGuidance.riskRewardRatio.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Risk to Stop</span>
                              <span className="text-red-300 font-semibold">{riskPct.toFixed(2)}%</span>
                            </div>

                            {(analysisData.entryGuidance.optionType || analysisData.entryGuidance.optionStrike !== undefined) && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Option Hint</span>
                                <span className="text-indigo-300 font-semibold">
                                  {analysisData.entryGuidance.optionType ?? 'NA'} {analysisData.entryGuidance.optionStrike ?? ''}
                                </span>
                              </div>
                            )}

                            {analysisData.entryGuidance.expectedHoldingMinutes !== undefined && analysisData.entryGuidance.expectedHoldingMinutes !== null && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Expected Hold</span>
                                <span className="text-gray-200">{analysisData.entryGuidance.expectedHoldingMinutes} min</span>
                              </div>
                            )}

                            {analysisData.entryGuidance.confidenceBreakdown && (
                              <div className="grid grid-cols-3 gap-2 text-[11px]">
                                <div className="bg-[#0a0a0f]/60 rounded p-2 text-gray-300">Trend {analysisData.entryGuidance.confidenceBreakdown.trend}</div>
                                <div className="bg-[#0a0a0f]/60 rounded p-2 text-gray-300">Momentum {analysisData.entryGuidance.confidenceBreakdown.momentum}</div>
                                <div className="bg-[#0a0a0f]/60 rounded p-2 text-gray-300">Volume {analysisData.entryGuidance.confidenceBreakdown.volume}</div>
                              </div>
                            )}

                            <div className="mt-2 bg-[#0a0a0f]/50 rounded-lg p-3">
                              <div className="relative h-14">
                                <div className="absolute top-2 left-0 right-0 h-0.5 bg-gray-700" />
                                <div className="absolute top-0 -translate-x-1/2" style={{ left: `${clamp(stopPct, 0, 100)}%` }}>
                                  <div className="w-2 h-2 rounded-full bg-red-400" />
                                  <p className="text-[10px] text-red-300 mt-1">SL</p>
                                </div>
                                <div className="absolute top-0 -translate-x-1/2" style={{ left: `${clamp(entryPct, 0, 100)}%` }}>
                                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                  <p className="text-[10px] text-indigo-300 mt-1">ENTRY</p>
                                </div>
                                <div className="absolute top-0 -translate-x-1/2" style={{ left: `${clamp(targetPct, 0, 100)}%` }}>
                                  <div className="w-2 h-2 rounded-full bg-green-400" />
                                  <p className="text-[10px] text-green-300 mt-1">TARGET</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className={analysisCardClass}>
                      <h3 className={analysisTitleClass}>Momentum</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between bg-[#0a0a0f]/50 rounded px-3 py-2">
                          <span className="text-gray-400">RSI</span>
                          <span className={`${rsiColor} font-semibold`}>{rsiValue.toFixed(2)} ({rsiTrend})</span>
                        </div>
                        <div className="flex justify-between bg-[#0a0a0f]/50 rounded px-3 py-2">
                          <span className="text-gray-400">MACD</span>
                          <span className={macdHistogram >= 0 ? 'text-green-300' : 'text-red-300'}>{macdBias} | {macdCross}</span>
                        </div>
                        <div className="flex justify-between bg-[#0a0a0f]/50 rounded px-3 py-2">
                          <span className="text-gray-400">Volume</span>
                          <span className={relativeVolume >= 1 ? 'text-green-300' : 'text-amber-300'}>{volumeState} ({relativeVolume.toFixed(2)}x)</span>
                        </div>
                      </div>
                    </div>

                    <div className={analysisCardClass}>
                      <h3 className={analysisTitleClass}>Key Levels</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-400">Bollinger Upper</span><span className="text-white">{formatPrice(bollUpper)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Bollinger Middle</span><span className="text-white">{formatPrice(bollMid)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Bollinger Lower</span><span className="text-white">{formatPrice(bollLower)}</span></div>
                        {analysisData.structureLevels && (
                          <>
                            <div className="flex justify-between"><span className="text-gray-400">Nearest Support</span><span className="text-green-300">{analysisData.structureLevels.nearestSupport !== null ? formatPrice(analysisData.structureLevels.nearestSupport) : 'NA'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Nearest Resistance</span><span className="text-red-300">{analysisData.structureLevels.nearestResistance !== null ? formatPrice(analysisData.structureLevels.nearestResistance) : 'NA'}</span></div>
                          </>
                        )}
                        <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                          <div className="bg-[#0a0a0f]/50 rounded p-2 text-gray-300">to Upper: {Math.abs(distanceToUpper).toFixed(2)}%</div>
                          <div className="bg-[#0a0a0f]/50 rounded p-2 text-gray-300">to Mid: {Math.abs(distanceToMiddle).toFixed(2)}%</div>
                          <div className="bg-[#0a0a0f]/50 rounded p-2 text-gray-300">to Lower: {Math.abs(distanceToLower).toFixed(2)}%</div>
                        </div>
                        <div className={`text-xs mt-1 ${outsideBands ? 'text-amber-300' : 'text-gray-400'}`}>
                          {outsideBands ? 'Price is outside bands (volatility expansion)' : 'Price is inside bands (range/squeeze context)'}
                        </div>
                      </div>
                    </div>

                    <div className={analysisCardClass}>
                      <h3 className={analysisTitleClass}>Signal Strength</h3>
                      <div className="flex items-center gap-4 mb-4">
                        <div
                          className="w-20 h-20 rounded-full grid place-items-center text-2xl font-bold"
                          style={{ border: `5px solid ${ringHue}`, color: ringHue }}
                        >
                          {signalStrength.toFixed(1)}
                        </div>
                        <div>
                          <p className="text-white font-semibold">Composite score / 10</p>
                          <p className="text-xs text-gray-400">Trend + RSI + MACD + EMA + Regime + Freshness</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {bullishSignals.map((signal) => (
                          <div key={signal} className="flex items-center gap-2 text-xs text-green-300">
                            <Check className="w-3.5 h-3.5" />
                            <span>{signal}</span>
                          </div>
                        ))}
                        {bearishSignals.map((signal) => (
                          <div key={signal} className="flex items-center gap-2 text-xs text-red-300">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{signal}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={analysisCardClass}>
                      <h3 className={analysisTitleClass}>Timing & Regime</h3>
                      <div className="space-y-2 text-sm">
                        {analysisData.signalTiming && (
                          <>
                            <div className="flex justify-between bg-[#0a0a0f]/50 rounded px-3 py-2">
                              <span className="text-gray-400">Signal Age</span>
                              <span className="text-gray-200">{analysisData.signalTiming.signalAgeBars ?? 'NA'} bars</span>
                            </div>
                            <div className="flex justify-between bg-[#0a0a0f]/50 rounded px-3 py-2">
                              <span className="text-gray-400">Freshness</span>
                              <span className="text-indigo-300">{analysisData.signalTiming.signalFreshnessScore}/100</span>
                            </div>
                          </>
                        )}
                        {analysisData.marketRegime && (
                          <div className="grid grid-cols-3 gap-2 text-[11px]">
                            <div className="bg-[#0a0a0f]/60 rounded p-2 text-gray-300">Vol {analysisData.marketRegime.volatilityRegime}</div>
                            <div className="bg-[#0a0a0f]/60 rounded p-2 text-gray-300">Trend {analysisData.marketRegime.trendStrengthScore}</div>
                            <div className="bg-[#0a0a0f]/60 rounded p-2 text-gray-300">Momentum {analysisData.marketRegime.momentumQualityScore}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {analysisData.noTradeContext && (
                      <div className={analysisCardClass}>
                        <h3 className={analysisTitleClass}>No-Trade Context</h3>
                        <div className="space-y-2 text-sm">
                          <div className="text-amber-300 font-semibold">{analysisData.noTradeContext.whyNoTradeCode}</div>
                          <p className="text-gray-300">{analysisData.noTradeContext.whyNoTradeMessage}</p>
                          {analysisData.noTradeContext.nextTriggerCondition && (
                            <div className="text-xs text-indigo-300">Trigger: {analysisData.noTradeContext.nextTriggerCondition}</div>
                          )}
                          {analysisData.noTradeContext.nextTriggerPrice !== null && (
                            <div className="text-xs text-gray-300">Next trigger price: {formatPrice(analysisData.noTradeContext.nextTriggerPrice)}</div>
                          )}
                          {analysisData.noTradeContext.estimatedRecheckMinutes !== null && (
                            <div className="text-xs text-gray-400">Recheck in ~{analysisData.noTradeContext.estimatedRecheckMinutes} min</div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className={analysisCardClass}>
                      <h3 className={analysisTitleClass}>Decision Context</h3>
                      <p className="text-sm text-gray-300 leading-relaxed">{analysisData.explanation}</p>
                      {analysisData.reasoningPoints.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs text-gray-400 list-disc list-inside">
                          {analysisData.reasoningPoints.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {isAnalysisLoading && (
                  <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6 text-sm text-gray-400">
                    Loading analysis...
                  </div>
                )}

                {!isAnalysisLoading && !analysisData && (
                  <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6 text-sm text-gray-400">
                    Analysis is currently unavailable for this symbol/timeframe.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── BACKTEST TAB ──────────────────────────────────────────────── */}
        {activeTab === 'backtest' && (
          <motion.div
            key="backtest"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <BacktestControls
              symbol={symbol!}
              onRun={handleRunBacktest}
              isLoading={backtestLoading}
            />

            {backtestError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                Backtest failed: {(backtestError as Error).message}
              </div>
            )}

            {backtestLoading && !backtestResult && (
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-[#12121a]/50 border border-gray-800/30 rounded-xl p-4 h-20 animate-pulse" />
                  ))}
                </div>
                <div className="bg-[#12121a]/50 border border-gray-800/30 rounded-xl h-[540px] animate-pulse" />
              </div>
            )}

            {!backtestRequest && !backtestLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="bg-indigo-500/10 p-5 rounded-2xl mb-4">
                  <FlaskConical className="w-10 h-10 text-indigo-400" />
                </div>
                <p className="text-white font-semibold text-lg mb-1">
                  Configure &amp; run a backtest
                </p>
                <p className="text-gray-500 text-sm max-w-xs">
                  Select a strategy, date range, and parameters above, then click "Run Backtest" to simulate trades.
                </p>
              </div>
            )}

            {backtestResult && !backtestLoading && (
              <>
                <BacktestMetricsBar metrics={backtestResult.metrics} />

                {backtestResult.trades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-[#12121a]/40 border border-gray-800/40 rounded-xl text-center">
                    <p className="text-gray-400 font-medium mb-1">No trades generated</p>
                    <p className="text-gray-600 text-sm">
                      The strategy found no signals in this period. Try adjusting the date range or parameters.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-[#12121a]/50 border border-gray-800/50 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsReplayMode(true);
                            setSelectedTrade(null);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                            isReplayMode
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                              : 'bg-gray-900/40 text-gray-400 border-gray-700/60 hover:text-white'
                          }`}
                        >
                          Replay Mode
                        </button>
                        <button
                          onClick={() => {
                            setIsReplayMode(false);
                            setIsReplayPlaying(false);
                            setActiveReplayEvent(null);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                            !isReplayMode
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                              : 'bg-gray-900/40 text-gray-400 border-gray-700/60 hover:text-white'
                          }`}
                        >
                          Static Mode
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setIsReplayPlaying((prev) => !prev)}
                          disabled={!isReplayMode || replayTotalCandles <= 1}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold border border-indigo-500/30 text-indigo-200 bg-indigo-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isReplayPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          {isReplayPlaying ? 'Pause' : 'Play'}
                        </button>

                        <button
                          onClick={resetReplay}
                          disabled={!isReplayMode}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold border border-gray-700/70 text-gray-300 bg-gray-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reset
                        </button>

                        {[0.5, 1, 2, 5].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => setReplaySpeed(speed as ReplaySpeed)}
                            disabled={!isReplayMode}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                              replaySpeed === speed
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                : 'bg-gray-900/30 text-gray-400 border-gray-700/60 hover:text-white'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}

                        {isReplayMode && (
                          <span className="text-xs text-gray-400 px-2">
                            Candle {Math.min(replayIndex + 1, Math.max(1, replayTotalCandles))} / {Math.max(1, replayTotalCandles)}
                          </span>
                        )}

                        {isReplayMode && (
                          <span className={`text-xs px-2 py-1 rounded-md border ${runningPnl >= 0 ? 'text-green-300 bg-green-500/10 border-green-500/30' : 'text-red-300 bg-red-500/10 border-red-500/30'}`}>
                            Running PnL: {formatPrice(runningPnl)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isReplayMode && replayTotalCandles > 1 && (
                      <div className="bg-[#12121a]/50 border border-gray-800/50 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-400 font-medium whitespace-nowrap">Scrub to:</label>
                          <input
                            type="range"
                            min="0"
                            max={replayTotalCandles - 1}
                            value={replayIndex}
                            onChange={(e) => {
                              setIsReplayPlaying(false);
                              setReplayIndex(parseInt(e.target.value, 10));
                            }}
                            disabled={isReplayPlaying}
                            className="flex-1 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: `linear-gradient(to right, rgb(99, 102, 241) 0%, rgb(99, 102, 241) ${
                                (replayIndex / Math.max(1, replayTotalCandles - 1)) * 100
                              }%, rgb(31, 41, 55) ${(replayIndex / Math.max(1, replayTotalCandles - 1)) * 100}%, rgb(31, 41, 55) 100%)`
                            }}
                          />
                          <span className="text-xs text-gray-500 whitespace-nowrap">{replayIndex + 1} / {replayTotalCandles}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="relative flex-1 min-w-0">
                        <BacktestChart
                          candles={isReplayMode ? visibleReplayCandles : candles}
                          indicators={indicators}
                          trades={isReplayMode ? visibleTrades : backtestResult.trades}
                          selectedTradeId={selectedTradeId}
                          hoveredTradeId={hoveredTradeId}
                          onTradeSelect={setSelectedTrade}
                          onTradeHover={setHoveredTrade}
                          replayNowMs={isReplayMode ? replayNowMs : null}
                        />

                        <AnimatePresence>
                          {isReplayMode && activeReplayEvent && (
                            <motion.div
                              key={activeReplayEvent.id}
                              initial={{ opacity: 0, y: -8, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.96 }}
                              transition={{ duration: 0.16 }}
                              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-[#101225]/90 text-xs text-indigo-100 shadow-lg"
                            >
                              {activeReplayEvent.message}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="w-full lg:w-80 xl:w-96 lg:h-[540px] flex flex-col gap-3">
                        {isReplayMode && (
                          <div className="bg-[#12121a]/60 border border-gray-800/50 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300">Replay Events</h4>
                              <span className="text-[11px] text-gray-500">{replayEvents.length} events</span>
                            </div>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                              {replayEvents.length === 0 ? (
                                <p className="text-xs text-gray-500">Press play to see trade placed/exited events.</p>
                              ) : (
                                replayEvents.map((event) => (
                                  <div
                                    key={event.id}
                                    className={`text-xs rounded-md px-2 py-1 border ${
                                      event.type === 'trade_placed'
                                        ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
                                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                                    }`}
                                  >
                                    {event.message}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex-1 min-h-0">
                          <TradeListPanel
                            trades={isReplayMode ? visibleTrades : backtestResult.trades}
                            selectedTradeId={selectedTradeId}
                            hoveredTradeId={hoveredTradeId}
                            onSelectTrade={setSelectedTrade}
                            onHoverTrade={setHoveredTrade}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(isReplayMode ? visibleEquityCurve : backtestResult.metrics.equityCurve)?.length > 0 && (
                  <EquityCurve equityCurve={isReplayMode ? visibleEquityCurve : backtestResult.metrics.equityCurve} />
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
