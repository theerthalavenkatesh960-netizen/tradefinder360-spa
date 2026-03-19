import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';
import { api } from '../services/api';
import { useMarketStore } from '../store/market';
import { motion } from 'framer-motion';
import { formatPrice, formatPercent, getBiasColor } from '../utils/formatters';

export const Dashboard = () => {
  const { setSentiment } = useMarketStore();

  const { data: sentiment } = useQuery({
    queryKey: ['market-sentiment'],
    queryFn: api.market.getSentiment,
    onSuccess: (data) => setSentiment(data.overall),
  });

  const { data: topSetups = [] } = useQuery({
    queryKey: ['radar-top'],
    queryFn: () => api.radar.getTop(70, 10),
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations-top'],
    queryFn: () => api.recommendations.getTop(5),
  });

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'BULLISH':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'BEARISH':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Market Dashboard</h1>

        {sentiment && (
          <div className={`inline-flex items-center px-4 py-2 rounded-lg border ${getSentimentColor(sentiment.overall)}`}>
            <Activity className="w-5 h-5 mr-2" />
            <span className="font-semibold">Market: {sentiment.overall}</span>
            <span className="mx-4">|</span>
            <span>Advancers: {sentiment.advancers}</span>
            <span className="mx-2">|</span>
            <span>Decliners: {sentiment.decliners}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-indigo-500/10 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-1">Top Setups</p>
          <p className="text-3xl font-bold text-white">{topSetups.length}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-500/10 p-3 rounded-lg">
              <Target className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-1">Active Signals</p>
          <p className="text-3xl font-bold text-white">{recommendations.length}</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-indigo-500" />
            Top Market Setups
          </h2>
          <div className="space-y-3">
            {topSetups.slice(0, 5).map((setup) => (
              <a
                key={setup.symbol}
                href={`/stocks/${setup.symbol}`}
                className="flex items-center justify-between p-3 bg-[#0a0a0f]/50 hover:bg-[#0a0a0f] rounded-lg transition group"
              >
                <div>
                  <p className="font-semibold group-hover:text-indigo-400 transition">
                    {setup.symbol}
                  </p>
                  <p className="text-sm text-gray-400">{setup.marketState}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatPrice(setup.lastClose)}</p>
                  <span className={`text-xs px-2 py-1 rounded ${getBiasColor(setup.bias)}`}>
                    {setup.bias}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-6">Recommended Trades</h2>
          <div className="space-y-3">
            {recommendations.slice(0, 5).map((rec, idx) => (
              <div
                key={idx}
                className="p-4 bg-[#0a0a0f]/50 rounded-lg border border-gray-800"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">{rec.symbol || 'Stock'}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    rec.direction === 'BUY' ? 'bg-green-500/10 text-green-400' :
                    rec.direction === 'SELL' ? 'bg-red-500/10 text-red-400' :
                    'bg-gray-500/10 text-gray-400'
                  }`}>
                    {rec.direction}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Entry</p>
                    <p className="font-semibold">{formatPrice(rec.entryPrice)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Target</p>
                    <p className="font-semibold text-green-400">{formatPrice(rec.target)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Confidence</p>
                    <p className="font-semibold">{rec.confidence}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
