import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Star, BarChart2, FlaskConical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import type { BacktestRequest } from '../services/api';
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

export const StockDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [timeframe, setTimeframe] = useState(15);
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [backtestRequest, setBacktestRequest] = useState<BacktestRequest | null>(null);

  const { toggle, isWatched } = useWatchlistStore();
  const { selectedTradeId, hoveredTradeId, setSelectedTrade, setHoveredTrade } =
    useBacktestStore();

  const { data: stock } = useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => api.instruments.getDetail(symbol!),
    enabled: !!symbol,
  });

const { data: candles = [] } = useQuery({
  queryKey: ['candles', symbol, timeframe],
  queryFn: async () => {
    const res = await api.candles.get(symbol!, timeframe);

    // ✅ normalize response
    if (Array.isArray(res)) return res;
    if (Array.isArray((res as any)?.data)) return (res as any).data;
    if (Array.isArray((res as any)?.candles)) return (res as any).candles;

    console.error('Invalid candles response:', res);
    return [];
  },
  enabled: !!symbol,
});

  const { data: analysis } = useQuery({
    queryKey: ['analysis', symbol, timeframe],
    queryFn: () => api.instruments.getAnalysis(symbol!, timeframe),
    enabled: !!symbol,
  });

  const { data: indicators = [] } = useQuery({
    queryKey: ['indicators', symbol, timeframe],
    queryFn: () => api.instruments.getIndicators(symbol!, timeframe),
    enabled: !!symbol,
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

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'analysis', label: 'Chart Analysis', icon: BarChart2 },
    { id: 'backtest', label: 'Backtesting', icon: FlaskConical },
  ];

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
                    <div />
                    <div className="flex space-x-2">
                      {timeframes.map((tf) => (
                        <button
                          key={tf.value}
                          onClick={() => setTimeframe(tf.value)}
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
                  <CandleChart candles={candles} indicators={indicators} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <RSIPanel indicators={indicators} />
                  <MACDPanel indicators={indicators} />
                </div>
              </div>

              <div className="space-y-6">
                {analysis && (
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
