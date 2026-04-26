import React, { useState } from 'react';
import {
  LearningResult,
  PortfolioPerformanceMetrics,
  TuningChange,
  useLearning,
} from '../hooks/useLearning';

interface LearningPanelProps {
  onRefresh?: () => void;
}

/**
 * LearningPanel - displays learning results, proposed configs, and user actions
 * Shows performance metrics, tuning changes, and reasoning
 */
export const LearningPanel: React.FC<LearningPanelProps> = ({ onRefresh }) => {
  const { state, triggerLearning, approveConfig, rejectConfig, clearError } =
    useLearning();
  const [isTriggering, setIsTriggering] = useState(false);

  const handleTriggerLearning = async () => {
    setIsTriggering(true);
    try {
      await triggerLearning({ triggerSource: 'USER_MANUAL' });
      onRefresh?.();
    } finally {
      setIsTriggering(false);
    }
  };

  const handleApprove = async () => {
    if (!state.lastResult?.proposedConfig?.iteration) return;
    try {
      await approveConfig(state.lastResult.proposedConfig.iteration);
      onRefresh?.();
    } catch (err) {
      console.error('Approval failed:', err);
    }
  };

  const handleReject = async () => {
    if (!state.lastResult?.proposedConfig?.iteration) return;
    try {
      await rejectConfig(state.lastResult.proposedConfig.iteration);
      onRefresh?.();
    } catch (err) {
      console.error('Rejection failed:', err);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      {/* Header & trigger button */}
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">Portfolio Fusion Learning</h2>
        <button
          onClick={handleTriggerLearning}
          disabled={isTriggering || state.isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {state.isLoading ? 'Analyzing...' : 'Trigger Learning Cycle'}
        </button>
      </div>

      {/* Error message */}
      {state.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800 font-medium">Error: {state.error}</p>
          <button
            onClick={clearError}
            className="mt-2 text-red-600 hover:text-red-800 text-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Last result */}
      {state.lastResult && <LearningResultSection result={state.lastResult} />}

      {/* Action buttons (conditional on status) */}
      {state.lastResult?.status === 'PENDING_ACTIVATION' && (
        <div className="flex gap-4 pt-4 border-t">
          <button
            onClick={handleApprove}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            ✓ Approve Config
          </button>
          <button
            onClick={handleReject}
            className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            ✗ Reject Config
          </button>
        </div>
      )}

      {state.lastResult?.status === 'APPLIED' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800 font-medium">
            ✓ Config applied successfully
          </p>
          <p className="text-green-700 text-sm mt-1">
            Applied at: {new Date(state.lastResult.completedAt || '').toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Displays a single learning result with all metadata
 */
const LearningResultSection: React.FC<{ result: LearningResult }> = ({
  result,
}) => {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm text-gray-600">Iteration</p>
          <p className="text-xl font-bold text-blue-900">#{result.iterationNumber}</p>
        </div>
        <div className="p-4 bg-purple-50 rounded border border-purple-200">
          <p className="text-sm text-gray-600">Triggered</p>
          <p className="text-sm text-purple-900">
            {new Date(result.triggeredAt).toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-indigo-50 rounded border border-indigo-200">
          <p className="text-sm text-gray-600">Status</p>
          <p className="text-sm font-bold text-indigo-900">{result.status}</p>
        </div>
      </div>

      {/* Current Performance Metrics */}
      {result.currentMetrics && (
        <MetricsSection metrics={result.currentMetrics} />
      )}

      {/* Config Comparison */}
      {result.priorConfig && result.proposedConfig && (
        <ConfigComparisonSection prior={result.priorConfig} proposed={result.proposedConfig} />
      )}

      {/* Changes */}
      {result.changes && result.changes.length > 0 && (
        <ChangesSection changes={result.changes} />
      )}

      {/* Reasoning & Insights */}
      {(result.reasoningText || result.aiModelInsights || result.riskAssessment) && (
        <InsightsSection result={result} />
      )}
    </div>
  );
};

/**
 * Metrics section
 */
const MetricsSection: React.FC<{ metrics: PortfolioPerformanceMetrics }> = ({
  metrics,
}) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Metrics</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Win Rate"
          value={`${(metrics.winRate * 100).toFixed(1)}%`}
          color="blue"
        />
        <MetricCard
          label="Sharpe Ratio"
          value={metrics.sharpeRatio.toFixed(2)}
          color="green"
        />
        <MetricCard
          label="Max Drawdown"
          value={`${(metrics.maxDrawdown * 100).toFixed(1)}%`}
          color="red"
        />
        <MetricCard
          label="Profit Factor"
          value={metrics.profitFactor.toFixed(2)}
          color="purple"
        />
        <MetricCard
          label="Fusion Score"
          value={metrics.averageFusionScore.toFixed(2)}
          color="indigo"
        />
        <MetricCard
          label="Hold Efficiency"
          value={`${(metrics.averageHoldEfficiency * 100).toFixed(1)}%`}
          color="cyan"
        />
        <MetricCard label="Total Trades" value={metrics.totalTrades.toString()} color="yellow" />
        <MetricCard label="Win Trades" value={metrics.winningTrades.toString()} color="green" />
      </div>
    </div>
  );
};

/**
 * Single metric card
 */
const MetricCard: React.FC<{
  label: string;
  value: string;
  color: string;
}> = ({ label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  };

  return (
    <div className={`p-3 rounded border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
};

/**
 * Config comparison section
 */
const ConfigComparisonSection: React.FC<{ prior: any; proposed: any }> = ({
  prior,
  proposed,
}) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Config Comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Parameter</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">Prior</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">Proposed</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">Change</th>
            </tr>
          </thead>
          <tbody>
            <ConfigRow
              param="Technical Weight"
              prior={prior.technicalWeight}
              proposed={proposed.technicalWeight}
            />
            <ConfigRow
              param="News Weight"
              prior={prior.newsWeight}
              proposed={proposed.newsWeight}
            />
            <ConfigRow
              param="Sector Weight"
              prior={prior.sectorWeight}
              proposed={proposed.sectorWeight}
            />
            <ConfigRow
              param="Min Fusion Score"
              prior={prior.minimumFusionScore}
              proposed={proposed.minimumFusionScore}
            />
            <ConfigRow
              param="News Negative Boundary"
              prior={prior.newsNegativeBoundary}
              proposed={proposed.newsNegativeBoundary}
            />
            <ConfigRow
              param="News Positive Boundary"
              prior={prior.newsPositiveBoundary}
              proposed={proposed.newsPositiveBoundary}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Single config row
 */
const ConfigRow: React.FC<{ param: string; prior: number; proposed: number }> = ({
  param,
  prior,
  proposed,
}) => {
  const change = proposed - prior;
  const changePercent = prior !== 0 ? ((change / prior) * 100).toFixed(1) : '—';
  const isIncrease = change > 0;

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-2 text-gray-700">{param}</td>
      <td className="px-4 py-2 text-right text-gray-600">{prior.toFixed(3)}</td>
      <td className="px-4 py-2 text-right font-semibold text-gray-900">{proposed.toFixed(3)}</td>
      <td
        className={`px-4 py-2 text-right font-semibold ${
          isIncrease ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {isIncrease ? '+' : ''}{changePercent}%
      </td>
    </tr>
  );
};

/**
 * Changes section
 */
const ChangesSection: React.FC<{ changes: TuningChange[] }> = ({ changes }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Proposed Changes</h3>
      <div className="space-y-2">
        {changes.map((change, idx) => (
          <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex justify-between items-start">
              <span className="font-medium text-blue-900">{change.parameter}</span>
              <span className="text-blue-700 text-sm">
                {change.oldValue.toFixed(3)} → {change.newValue.toFixed(3)}
              </span>
            </div>
            {change.justification && (
              <p className="text-sm text-blue-700 mt-1">{change.justification}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Insights section
 */
const InsightsSection: React.FC<{ result: LearningResult }> = ({ result }) => {
  return (
    <div className="space-y-4">
      {result.reasoningText && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">Reasoning</h4>
          <p className="text-gray-700 text-sm leading-relaxed">{result.reasoningText}</p>
        </div>
      )}

      {result.aiModelInsights && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">AI Insights</h4>
          <p className="text-gray-700 text-sm leading-relaxed">{result.aiModelInsights}</p>
        </div>
      )}

      {result.riskAssessment && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
          <h4 className="font-semibold text-yellow-900 mb-2">Risk Assessment</h4>
          <p className="text-yellow-800 text-sm">{result.riskAssessment}</p>
        </div>
      )}
    </div>
  );
};
