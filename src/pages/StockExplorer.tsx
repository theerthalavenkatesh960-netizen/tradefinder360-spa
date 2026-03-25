import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../services/api';
import { formatPrice, formatPercent, getTrendStateColor } from '../utils/formatters';

export const StockExplorer = () => {
  const [search, setSearch] = useState('');

  const { data: stocks = [], isLoading } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.instruments.getList(),
  });

  const filteredStocks = stocks.filter((stock) =>
    stock.symbol.toLowerCase().includes(search.toLowerCase()) ||
    stock.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Stock Explorer</h1>
        <p className="text-gray-400">Discover and analyze trading opportunities</p>
      </div>

      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stocks..."
            className="w-full bg-[#0a0a0f]/50 border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0a0f]/50 border-b border-gray-800">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Symbol</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Price</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Change</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">State</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredStocks.map((stock) => (
                  <tr key={stock.symbol} className="hover:bg-[#0a0a0f]/50 transition">
                    <td className="px-6 py-4">
                      <a
                        href={`/stocks/${stock.symbol}`}
                        className="font-semibold text-white hover:text-indigo-400 transition"
                      >
                        {stock.symbol}
                      </a>
                    </td>
                    <td className="px-6 py-4 font-semibold">{formatPrice(stock.price)}</td>
                    <td className="px-6 py-4">
                      <span className={stock.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatPercent(stock.changePercent)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded border ${getTrendStateColor(stock.state)}`}>
                        {stock.state}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold">{stock.setupScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
