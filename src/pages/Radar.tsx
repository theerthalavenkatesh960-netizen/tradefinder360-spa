import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radar as RadarIcon } from 'lucide-react';
import { api } from '../services/api';
import { formatPrice, getTrendStateColor, getBiasColor } from '../utils/formatters';

export const Radar = () => {
  const [minScore, setMinScore] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['radar', minScore],
    queryFn: () => api.radar.scan(minScore),
  });

  const highQuality = data?.items.filter((i) => i.qualityLabel === 'HIGH') || [];
  const watchlist = data?.items.filter((i) => i.qualityLabel === 'WATCHLIST') || [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <RadarIcon className="w-8 h-8 mr-3 text-indigo-500" />
          Market Radar
        </h1>
        <p className="text-gray-400">Real-time market scanning for trading opportunities</p>
      </div>

      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <label className="text-gray-300 font-medium">Min Score:</label>
          <input
            type="range"
            min="0"
            max="100"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-white font-bold">{minScore}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-4">High Quality Setups ({highQuality.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {highQuality.map((item) => (
                <a
                  key={item.symbol}
                  href={`/stocks/${item.symbol}`}
                  className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 hover:border-indigo-500/30 rounded-xl p-6 transition"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold">{item.symbol}</h3>
                      <p className="text-sm text-gray-400">{item.marketState}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getBiasColor(item.bias)}`}>
                      {item.bias}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Score</span>
                      <span className="font-bold text-indigo-400">{item.setupScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price</span>
                      <span className="font-semibold">{formatPrice(item.lastClose)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">ATR</span>
                      <span className="font-semibold">{item.atr.toFixed(2)}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">Watchlist ({watchlist.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchlist.map((item) => (
                <a
                  key={item.symbol}
                  href={`/stocks/${item.symbol}`}
                  className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 hover:border-yellow-500/30 rounded-xl p-6 transition"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold">{item.symbol}</h3>
                      <p className="text-sm text-gray-400">{item.marketState}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getBiasColor(item.bias)}`}>
                      {item.bias}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Score</span>
                      <span className="font-bold">{item.setupScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price</span>
                      <span className="font-semibold">{formatPrice(item.lastClose)}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
