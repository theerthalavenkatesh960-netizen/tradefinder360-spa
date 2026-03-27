import { useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Star, BarChart2, FlaskConical, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import type { BacktestRequest, Candle } from '../services/api';
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
import { formatPrice, formatPercent, getSignalColor, getTrendStateColor } from '../utils/formatters';

type Tab = 'analysis' | 'backtest';
type IndicatorKey = 'ema' | 'bollinger' | 'rsi' | 'macd';

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

export const StockDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
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

  const { data: stock } = useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => api.instruments.getDetail(symbol!),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const normalizeCandleResponse = (res: unknown): Candle[] => {
    if (Array.isArray(res)) return res as Candle[];
    if (Array.isArray((res as any)?.data)) return (res as any).data as Candle[];
    if (Array.isArray((res as any)?.candles)) return (res as any).candles as Candle[];
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

  if (!stock) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

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
                  <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4">Analysis</h3>
                    <div className="space-y-4">
                      <div>
                        <span className={`text-xs px-2 py-1 rounded border ${getTrendStateColor(analysis.trendState.state)}`}>
                          {analysis.trendState.state}
                        </span>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-400 text-sm">Setup Score</span>
                          <span className="font-semibold">{analysis.trendState.setupScore}</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-indigo-500 h-2 rounded-full"
                            style={{ width: `${analysis.trendState.setupScore}%` }}
                          />
                        </div>
                      </div>
                      {analysis.entryGuidance && analysis.entryGuidance.direction !== 'NONE' && (
                        <div className="bg-[#0a0a0f]/50 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Direction</span>
                            <span className={`text-xs px-2 py-1 rounded border ${getSignalColor(analysis.entryGuidance.direction)}`}>
                              {analysis.entryGuidance.direction}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Entry</span>
                            <span className="font-semibold">{formatPrice(analysis.entryGuidance.entryPrice)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Stop Loss</span>
                            <span className="font-semibold text-red-400">{formatPrice(analysis.entryGuidance.stopLoss)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Target</span>
                            <span className="font-semibold text-green-400">{formatPrice(analysis.entryGuidance.target)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">R:R</span>
                            <span className="font-semibold">1:{analysis.entryGuidance.riskRewardRatio.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
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
