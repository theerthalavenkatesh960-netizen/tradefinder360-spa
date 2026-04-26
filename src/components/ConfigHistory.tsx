import React, { useEffect } from 'react';
import { LearningResult, useLearning, FusionConfigSnapshot } from '../hooks/useLearning';

interface ConfigHistoryProps {
  compact?: boolean;
  limit?: number;
}

/**
 * ConfigHistory - displays audit trail of all learning iterations
 * Shows status (applied, rejected, rolled_back), metrics, and proposed changes
 */
export const ConfigHistory: React.FC<ConfigHistoryProps> = ({
  compact = false,
  limit = 10,
}) => {
  const { state, fetchHistory, rollbackConfig } = useLearning();

  useEffect(() => {
    fetchHistory(limit);
  }, [limit, fetchHistory]);

  if (state.isLoading && state.history.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Loading history...</p>
      </div>
    );
  }

  if (state.history.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No learning history available</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {state.history.slice(0, 5).map((result) => (
          <CompactHistoryRow key={result.iterationNumber} result={result} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6 bg-white rounded-lg shadow">
      <h3 className="text-xl font-bold text-gray-900">Fusion Learning Audit Trail</h3>

      <div className="space-y-3">
        {state.history.map((result) => (
          <HistoryCard key={result.iterationNumber} result={result} onRollback={rollbackConfig} />
        ))}
      </div>

      {state.history.length >= limit && (
        <p className="text-sm text-gray-500 text-center">
          Showing latest {limit} iterations
        </p>
      )}
    </div>
  );
};

/**
 * Compact history row (for dashboard)
 */
const CompactHistoryRow: React.FC<{ result: LearningResult }> = ({ result }) => {
  const statusColorMap = {
    PENDING_ACTIVATION: 'bg-yellow-50 border-yellow-200',
    APPLIED: 'bg-green-50 border-green-200',
    REJECTED: 'bg-red-50 border-red-200',
    ROLLED_BACK: 'bg-orange-50 border-orange-200',
  };

  const statusBadgeColorMap = {
    PENDING_ACTIVATION: 'bg-yellow-200 text-yellow-900',
    APPLIED: 'bg-green-200 text-green-900',
    REJECTED: 'bg-red-200 text-red-900',
    ROLLED_BACK: 'bg-orange-200 text-orange-900',
  };

  const colorClass = statusColorMap[result.status as keyof typeof statusColorMap] || '';
  const badgeColorClass =
    statusBadgeColorMap[result.status as keyof typeof statusBadgeColorMap] || '';

  return (
    <div className={`p-3 border rounded flex justify-between items-center ${colorClass}`}>
      <div>
        <span className="font-medium text-gray-900">Iteration #{result.iterationNumber}</span>
        <p className="text-xs text-gray-600">
          {new Date(result.triggeredAt).toLocaleDateString()}
        </p>
      </div>
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeColorClass}`}>
        {result.status}
      </span>
    </div>
  );
};

/**
 * Full history card with all details
 */
const HistoryCard: React.FC<{ result: LearningResult; onRollback: () => Promise<LearningResult> }> = ({
  result,
  onRollback,
}) => {
  const [isRollingBack, setIsRollingBack] = React.useState(false);

  const handleRollback = async () => {
    setIsRollingBack(true);
    try {
      await onRollback();
    } finally {
      setIsRollingBack(false);
    }
  };

  const statusColorMap = {
    PENDING_ACTIVATION: 'bg-yellow-50 border-yellow-200',
    APPLIED: 'bg-green-50 border-green-200',
    REJECTED: 'bg-red-50 border-red-200',
    ROLLED_BACK: 'bg-orange-50 border-orange-200',
  };

  const statusBadgeColorMap = {
    PENDING_ACTIVATION: 'bg-yellow-200 text-yellow-900',
    APPLIED: 'bg-green-200 text-green-900',
    REJECTED: 'bg-red-200 text-red-900',
    ROLLED_BACK: 'bg-orange-200 text-orange-900',
  };

  const colorClass = statusColorMap[result.status as keyof typeof statusColorMap] || '';
  const badgeColorClass =
    statusBadgeColorMap[result.status as keyof typeof statusBadgeColorMap] || '';

  return (
    <div className={`p-4 border rounded-lg ${colorClass}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-bold text-gray-900">Iteration #{result.iterationNumber}</h4>
          <p className="text-xs text-gray-600">Triggered: {new Date(result.triggeredAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeColorClass}`}>
            {result.status}
          </span>
          {result.status === 'APPLIED' && (
            <button
              onClick={handleRollback}
              disabled={isRollingBack}
              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              {isRollingBack ? 'Rolling back...' : 'Rollback'}
            </button>
          )}
        </div>
      </div>

      {/* Source */}
      <p className="text-xs text-gray-600 mb-3">
        Source: {result.triggerSource} | Sessions analyzed: {result.sessionsAnalyzed ?? '—'}
      </p>

      {/* Metrics Summary */}
      {result.currentMetrics && (
        <div className="mb-3 p-2 bg-white rounded border border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-2">Performance</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-gray-600">Win Rate:</span>{' '}
              <span className="font-semibold">
                {(result.currentMetrics.winRate * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-600">Sharpe:</span>{' '}
              <span className="font-semibold">{result.currentMetrics.sharpeRatio.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">Drawdown:</span>{' '}
              <span className="font-semibold">
                {(result.currentMetrics.maxDrawdown * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-600">Trades:</span>{' '}
              <span className="font-semibold">{result.currentMetrics.totalTrades}</span>
            </div>
            <div>
              <span className="text-gray-600">PnL:</span>{' '}
              <span className="font-semibold text-green-700">
                ₹{result.currentMetrics.totalPnL.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Config Changes */}
      {result.changes && result.changes.length > 0 && (
        <div className="mb-3 p-2 bg-white rounded border border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-2">
            Changes ({result.changes.length})
          </p>
          <div className="space-y-1">
            {result.changes.map((change, idx) => (
              <div key={idx} className="text-xs text-gray-700">
                <span className="font-semibold">{change.parameter}:</span>{' '}
                {change.oldValue.toFixed(3)} → {change.newValue.toFixed(3)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reasoning */}
      {result.reasoningText && (
        <div className="text-xs text-gray-700 italic">
          <strong>Reasoning:</strong> {result.reasoningText}
        </div>
      )}
    </div>
  );
};
