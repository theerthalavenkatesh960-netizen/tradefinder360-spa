import { useQuery } from '@tanstack/react-query';
import { List } from 'lucide-react';
import { api } from '../services/api';
import { formatPrice, getSignalColor, formatDateIST } from '../utils/formatters';

export const Recommendations = () => {
  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: api.recommendations.getAll,
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <List className="w-8 h-8 mr-3 text-indigo-500" />
          Active Recommendations
        </h1>
        <p className="text-gray-400">All active trading recommendations</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0a0a0f]/50 border-b border-gray-800">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Symbol</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Direction</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Entry</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Stop Loss</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Target</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">R:R</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Confidence</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recommendations.map((rec, idx) => (
                <tr key={idx} className="hover:bg-[#0a0a0f]/50 transition">
                  <td className="px-6 py-4 font-semibold">{rec.symbol || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded border ${getSignalColor(rec.direction)}`}>
                      {rec.direction}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold">{formatPrice(rec.entryPrice)}</td>
                  <td className="px-6 py-4 text-red-400 font-semibold">{formatPrice(rec.stopLoss)}</td>
                  <td className="px-6 py-4 text-green-400 font-semibold">{formatPrice(rec.target)}</td>
                  <td className="px-6 py-4 font-semibold">1:{rec.riskRewardRatio.toFixed(2)}</td>
                  <td className="px-6 py-4 font-semibold">{rec.confidence}%</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{formatDateIST(rec.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
