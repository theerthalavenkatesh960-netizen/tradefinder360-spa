import { ShieldAlert, Target, TrendingDown, TrendingUp, PauseCircle } from 'lucide-react';
import type { SuggestedAction } from '../../utils/marketInsights';

interface RecommendationCardProps {
  action: SuggestedAction;
  confidence: number;
  explanation: string;
}

const getActionStyle = (action: SuggestedAction): string => {
  switch (action) {
    case 'BUY':
      return 'text-green-300 bg-green-500/10 border-green-500/30';
    case 'SELL':
      return 'text-red-300 bg-red-500/10 border-red-500/30';
    case 'WAIT':
      return 'text-amber-200 bg-amber-500/10 border-amber-500/30';
    default:
      return 'text-blue-200 bg-blue-500/10 border-blue-500/30';
  }
};

const getActionIcon = (action: SuggestedAction) => {
  switch (action) {
    case 'BUY':
      return TrendingUp;
    case 'SELL':
      return TrendingDown;
    case 'WAIT':
      return ShieldAlert;
    default:
      return PauseCircle;
  }
};

export const RecommendationCard = ({ action, confidence, explanation }: RecommendationCardProps) => {
  const ActionIcon = getActionIcon(action);

  return (
    <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-gray-400 text-sm mb-2">Action Recommendation</p>
          <div className={`inline-flex items-center px-3 py-1 rounded-lg border text-sm font-semibold ${getActionStyle(action)}`}>
            <ActionIcon className="w-4 h-4 mr-2" />
            {action}
          </div>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs">Confidence</p>
          <p className="text-2xl font-bold">{confidence}%</p>
        </div>
      </div>

      <p className="text-gray-300 mt-4 text-sm leading-relaxed">{explanation}</p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span className="inline-flex items-center">
            <Target className="w-3 h-3 mr-1" />
            Decision confidence
          </span>
          <span>{confidence}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#0a0a0f] overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>
    </div>
  );
};
