import { useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Star, BarChart2, FlaskConical, Check, ChevronDown, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import type { Analysis, BacktestRequest, Candle, Stock } from '../services/api';
import { useWatchlistStore } from '../store/watchlist';
import { useBacktestStore } from '../store/backtest';
import { CandleChart } from '../components/CandleChart';
import { RSIPanel } from '../components/RSIPanel';
import { MACDPanel } from '../components/MACDPanel';
import { BacktestControls } from '../components/backtest/BacktestControls';
import { BacktestMetricsBar } from '../components/backtest/BacktestMetrics';
import { BacktestChart } from '../components/backtest/BacktestChart';
import { TradeListPanel } from '../components/backtest/TradeListPanel';
import { EquityCurve } from '../components/backtest/EquityCurve';
import { formatPrice, formatPercent, getSignalColor } from '../utils/formatters';

type Tab = 'analysis' | 'backtest';
type IndicatorKey = 'ema' | 'bollinger' | 'rsi' | 'macd';
type CandleEnvelope = { data?: Candle[]; candles?: Candle[] };

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

const getTrendDisplayState = (analysis: Analysis): 'STRONG_UP' | 'WEAK_UP' | 'SIDEWAYS' | 'WEAK_DOWN' | 'STRONG_DOWN' => {
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
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [backtestRequest, setBacktestRequest] = useState<BacktestRequest | null>(null);
  const indicatorMenuRef = useRef<HTMLDivElement>(null);

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

  const { data: analysis } = useQuery({
    queryKey: ['analysis', symbol, timeframe],
    queryFn: () => api.instruments.getAnalysis(symbol!, timeframe),
    enabled: !!symbol && activeTab === 'analysis' && showAnalysis,
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
    setBacktestRequest(req);
  };

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
    setSelectedIndicators((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const hasIndicator = (key: IndicatorKey) => selectedIndicators.includes(key);

  const latestIndicator = indicators.length ? indicators[indicators.length - 1] : null;
  const previousIndicator = indicators.length > 1 ? indicators[indicators.length - 2] : null;
  const recentRsi = indicators.slice(-3).map((item) => item.rsi);

  const trendDisplayState = analysis ? getTrendDisplayState(analysis) : 'SIDEWAYS';
  const setupScore = analysis?.trendState.setupScore ?? 0;

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
  const avgVolume20 = candles.slice(-20).reduce((acc, c) => acc + c.volume, 0) / Math.max(Math.min(candles.length, 20), 1);
  const volumeState = currentVolume >= avgVolume20 ? 'Above 20-period avg' : 'Below 20-period avg';

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
  const signalStrength = clamp(trendPoints + rsiPoints + macdPoints + emaPoints, 0, 10);
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
    <div className="max-w-[1600px] mx-auto">
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
      <div className="flex space-x-1 bg-[#12121a]/60 border border-gray-800/50 rounded-xl p-1 mb-5 w-fit">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
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
                        onClick={() => setIsIndicatorMenuOpen((prev) => !prev)}
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
                      <button
                        onClick={() => setShowAnalysis((prev) => !prev)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                          showAnalysis
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        {showAnalysis ? 'Analysis On' : 'Show Analysis'}
                      </button>

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
                  />
                </div>

                {(hasIndicator('rsi') || hasIndicator('macd')) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {hasIndicator('rsi') && <RSIPanel indicators={indicators} />}
                    {hasIndicator('macd') && <MACDPanel indicators={indicators} />}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {showAnalysis && analysis && (
                  <div className="space-y-5">
                    <div className={`${analysisCardClass} p-4`}>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg border border-gray-700/50 bg-[#0a0a0f]/60 px-2 py-2">
                          <p className="text-gray-500 mb-0.5">Trend</p>
                          <p className="text-gray-100 font-semibold leading-tight">{trendDisplayState.replace('_', ' ')}</p>
                        </div>
                        <div className="rounded-lg border border-gray-700/50 bg-[#0a0a0f]/60 px-2 py-2">
                          <p className="text-gray-500 mb-0.5">Signal Score</p>
                          <p className="font-semibold" style={{ color: ringHue }}>{signalStrength.toFixed(1)} / 10</p>
                        </div>
                        <div className="rounded-lg border border-gray-700/50 bg-[#0a0a0f]/60 px-2 py-2">
                          <p className="text-gray-500 mb-0.5">Bias</p>
                          <p className={`font-semibold ${analysis.entryGuidance.direction === 'BUY' ? 'text-green-300' : analysis.entryGuidance.direction === 'SELL' ? 'text-red-300' : 'text-gray-300'}`}>
                            {analysis.entryGuidance.direction === 'BUY' ? 'LONG' : analysis.entryGuidance.direction === 'SELL' ? 'SHORT' : 'NEUTRAL'}
                          </p>
                        </div>
                      </div>
                    </div>

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

                    {analysis.entryGuidance && analysis.entryGuidance.direction !== 'NONE' && (() => {
                      const entry = analysis.entryGuidance.entryPrice;
                      const stop = analysis.entryGuidance.stopLoss;
                      const target = analysis.entryGuidance.target;
                      const ladderMin = Math.min(entry, stop, target);
                      const ladderMax = Math.max(entry, stop, target);
                      const range = Math.max(ladderMax - ladderMin, 0.0001);
                      const entryPct = ((entry - ladderMin) / range) * 100;
                      const stopPct = ((stop - ladderMin) / range) * 100;
                      const targetPct = ((target - ladderMin) / range) * 100;
                      const riskPct = Math.abs((entry - stop) / entry) * 100;
                      const directionText = analysis.entryGuidance.direction === 'BUY' ? 'LONG' : 'SHORT';

                      return (
                        <div className={analysisCardClass}>
                          <h3 className={analysisTitleClass}>Entry Guidance</h3>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs px-3 py-1 rounded border font-semibold ${getSignalColor(analysis.entryGuidance.direction)}`}>
                                {directionText}
                              </span>
                              <span className="text-xs text-gray-400">Confidence {analysis.confidence.toFixed(1)}%</span>
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
                              <span className="text-white font-semibold">1 : {analysis.entryGuidance.riskRewardRatio.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Risk to Stop</span>
                              <span className="text-red-300 font-semibold">{riskPct.toFixed(2)}%</span>
                            </div>

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
                          <span className={currentVolume >= avgVolume20 ? 'text-green-300' : 'text-amber-300'}>{volumeState}</span>
                        </div>
                      </div>
                    </div>

                    <div className={analysisCardClass}>
                      <h3 className={analysisTitleClass}>Key Levels</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-400">Bollinger Upper</span><span className="text-white">{formatPrice(bollUpper)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Bollinger Middle</span><span className="text-white">{formatPrice(bollMid)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Bollinger Lower</span><span className="text-white">{formatPrice(bollLower)}</span></div>
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
                          <p className="text-xs text-gray-400">Trend + RSI + MACD + EMA structure</p>
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
                  </div>
                )}

                {!showAnalysis && (
                  <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6 text-sm text-gray-400">
                    Enable <span className="text-white font-medium">Show Analysis</span> to fetch trend and trade guidance.
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
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 min-w-0">
                      <BacktestChart
                        candles={candles}
                        indicators={indicators}
                        trades={backtestResult.trades}
                        selectedTradeId={selectedTradeId}
                        hoveredTradeId={hoveredTradeId}
                        onTradeSelect={setSelectedTrade}
                        onTradeHover={setHoveredTrade}
                      />
                    </div>
                    <div className="w-full lg:w-80 xl:w-96 lg:h-[540px]">
                      <TradeListPanel
                        trades={backtestResult.trades}
                        selectedTradeId={selectedTradeId}
                        hoveredTradeId={hoveredTradeId}
                        onSelectTrade={setSelectedTrade}
                        onHoverTrade={setHoveredTrade}
                      />
                    </div>
                  </div>
                )}

                {backtestResult.metrics.equityCurve?.length > 0 && (
                  <EquityCurve equityCurve={backtestResult.metrics.equityCurve} />
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
