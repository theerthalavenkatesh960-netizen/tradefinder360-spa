import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Star } from 'lucide-react';
import { api } from '../services/api';
import { useWatchlistStore } from '../store/watchlist';
import { CandleChart } from '../components/CandleChart';
import { RSIPanel } from '../components/RSIPanel';
import { MACDPanel } from '../components/MACDPanel';
import { formatPrice, formatPercent, getSignalColor, getTrendStateColor } from '../utils/formatters';

export const StockDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [timeframe, setTimeframe] = useState(15);
  const { toggle, isWatched } = useWatchlistStore();

  const { data: stock } = useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => api.instruments.getDetail(symbol!),
    enabled: !!symbol,
  });

  const { data: candles = [] } = useQuery({
    queryKey: ['candles', symbol, timeframe],
    queryFn: () => api.candles.get(symbol!, timeframe),
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
            <div className="mb-4">
              <h1 className="text-3xl font-bold mb-1">{stock.symbol}</h1>
              <p className="text-gray-400">{stock.name}</p>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-3xl font-bold">{formatPrice(stock.lastClose)}</p>
                <p className={`text-lg font-semibold ${stock.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercent(stock.changePercent)}
                </p>
              </div>
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

                {analysis.entryGuidance.direction !== 'NONE' && (
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
    </div>
  );
};
