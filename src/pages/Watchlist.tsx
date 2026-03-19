import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { api } from '../services/api';
import { useWatchlistStore } from '../store/watchlist';
import { formatPrice, formatPercent, getTrendStateColor } from '../utils/formatters';

export const Watchlist = () => {
  const { symbols, remove } = useWatchlistStore();

  const { data: allStocks = [] } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.instruments.getList(),
  });

  const watchlistStocks = allStocks.filter((stock) => symbols.includes(stock.symbol));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <Star className="w-8 h-8 mr-3 text-yellow-500" />
          Watchlist
        </h1>
        <p className="text-gray-400">Track your favorite stocks</p>
      </div>

      {watchlistStocks.length === 0 ? (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-12 text-center">
          <Star className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Your Watchlist is Empty</h3>
          <p className="text-gray-400 mb-6">
            Add stocks from the Stock Explorer or Stock Detail pages
          </p>
          <a
            href="/stocks"
            className="inline-block bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg transition"
          >
            Explore Stocks
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {watchlistStocks.map((stock) => (
            <div
              key={stock.symbol}
              className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 hover:border-indigo-500/30 rounded-xl p-6 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <a
                    href={`/stocks/${stock.symbol}`}
                    className="text-xl font-bold hover:text-indigo-400 transition"
                  >
                    {stock.symbol}
                  </a>
                  <p className="text-sm text-gray-400 mt-1">{stock.name}</p>
                </div>
                <button
                  onClick={() => remove(stock.symbol)}
                  className="p-2 hover:bg-red-500/10 rounded-lg transition group"
                >
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 group-hover:text-red-400 group-hover:fill-transparent transition" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-3xl font-bold mb-1">{formatPrice(stock.lastClose)}</p>
                <p className={`text-sm font-semibold ${stock.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercent(stock.changePercent)}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">State</span>
                  <span className={`text-xs px-2 py-1 rounded border ${getTrendStateColor(stock.state)}`}>
                    {stock.state}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Setup Score</span>
                  <span className="font-semibold">{stock.setupScore}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
