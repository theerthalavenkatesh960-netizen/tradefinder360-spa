import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatPrice, formatCompactNumber } from '../utils/formatters';
import { Briefcase } from 'lucide-react';

export const PortfolioBuilder = () => {
  const [capital, setCapital] = useState(1000000);
  const [riskProfile, setRiskProfile] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');

  const { mutate, data, isLoading } = useMutation({
    mutationFn: () => {
      switch (riskProfile) {
        case 'conservative':
          return api.portfolio.getConservative(capital);
        case 'aggressive':
          return api.portfolio.getAggressive(capital);
        default:
          return api.portfolio.getBalanced(capital);
      }
    },
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <Briefcase className="w-8 h-8 mr-3 text-indigo-500" />
          Portfolio Builder
        </h1>
        <p className="text-gray-400">Build an optimized portfolio based on your risk profile</p>
      </div>

      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Capital (₹)
            </label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              className="w-full bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Risk Profile
            </label>
            <select
              value={riskProfile}
              onChange={(e) => setRiskProfile(e.target.value as any)}
              className="w-full bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => mutate()}
          disabled={isLoading}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50"
        >
          {isLoading ? 'Generating...' : 'Generate Portfolio'}
        </button>
      </div>

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">Total Capital</p>
              <p className="text-2xl font-bold">{formatPrice(data.totalCapital)}</p>
            </div>
            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">Expected Return</p>
              <p className="text-2xl font-bold text-green-400">{data.expectedReturn}%</p>
            </div>
            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">Risk Score</p>
              <p className="text-2xl font-bold">{data.portfolioRisk}%</p>
            </div>
            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">Positions</p>
              <p className="text-2xl font-bold">{data.positions.length}</p>
            </div>
          </div>

          <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#0a0a0f]/50 border-b border-gray-800">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Symbol</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Allocation</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Quantity</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Entry</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Expected Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.positions.map((position) => (
                  <tr key={position.symbol} className="hover:bg-[#0a0a0f]/50">
                    <td className="px-6 py-4 font-semibold">{position.symbol}</td>
                    <td className="px-6 py-4">{position.allocationPercent}%</td>
                    <td className="px-6 py-4">{position.quantity}</td>
                    <td className="px-6 py-4">{formatPrice(position.entryPrice)}</td>
                    <td className="px-6 py-4 text-green-400 font-semibold">{position.expectedReturn}%</td>
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
