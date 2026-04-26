import { useState, useCallback } from 'react';

export interface LearningResult {
  iterationNumber: number;
  triggeredAt: string;
  triggerSource?: string;
  status: 'PENDING_ACTIVATION' | 'APPLIED' | 'REJECTED' | 'ROLLED_BACK';
  completedAt?: string;
  currentMetrics?: PortfolioPerformanceMetrics;
  priorConfig?: FusionConfigSnapshot;
  proposedConfig?: FusionConfigSnapshot;
  changes: TuningChange[];
  reasoningText?: string;
  riskAssessment?: string;
  aiModelInsights?: string;
  sessionsAnalyzed?: number;
}

export interface PortfolioPerformanceMetrics {
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  averageHoldDays: number;
  averageHoldEfficiency: number;
  averageFusionScore: number;
  vetoRejectionRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  computedAt: string;
}

export interface FusionConfigSnapshot {
  iteration: number;
  technicalWeight: number;
  newsWeight: number;
  sectorWeight: number;
  minimumFusionScore: number;
  newsNegativeBoundary: number;
  newsPositiveBoundary: number;
  appliedAt?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ROLLED_BACK' | 'REJECTED';
}

export interface TuningChange {
  parameter: string;
  oldValue: number;
  newValue: number;
  justification?: string;
}

export interface LearningState {
  isLoading: boolean;
  error?: string;
  lastResult?: LearningResult;
  history: LearningResult[];
  currentConfig?: FusionConfigSnapshot;
}

interface UseLearningHook {
  state: LearningState;
  triggerLearning: (options?: TriggerOptions) => Promise<LearningResult>;
  approveConfig: (configId: number) => Promise<LearningResult>;
  rejectConfig: (configId: number) => Promise<LearningResult>;
  rollbackConfig: () => Promise<LearningResult>;
  fetchHistory: (limit?: number) => Promise<void>;
  fetchCurrentConfig: () => Promise<void>;
  clearError: () => void;
}

export interface TriggerOptions {
  userId?: string;
  triggerSource?: 'USER_MANUAL' | 'AUTO_THRESHOLD' | 'SCHEDULED';
  sessionsToAnalyze?: number;
}

/**
 * useLearning hook - manages portfolio learning workflow
 * Handles API calls, state management, and error handling
 */
export const useLearning = (apiBaseUrl: string = '/api'): UseLearningHook => {
  const [state, setState] = useState<LearningState>({
    isLoading: false,
    history: [],
  });

  const setError = useCallback((error: string | undefined) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  const triggerLearning = useCallback(
    async (options?: TriggerOptions): Promise<LearningResult> => {
      setLoading(true);
      setError(undefined);

      try {
        const response = await fetch(`${apiBaseUrl}/portfolio/learning/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: options?.userId,
            triggerSource: options?.triggerSource ?? 'USER_MANUAL',
            sessionsToAnalyze: options?.sessionsToAnalyze ?? 5,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result: LearningResult = await response.json();
        setState(prev => ({
          ...prev,
          lastResult: result,
          history: [result, ...prev.history],
        }));

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const approveConfig = useCallback(
    async (configId: number): Promise<LearningResult> => {
      setLoading(true);
      setError(undefined);

      try {
        const response = await fetch(
          `${apiBaseUrl}/portfolio/learning/approve/${configId}`,
          { method: 'POST' }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result: LearningResult = await response.json();
        setState(prev => ({
          ...prev,
          lastResult: result,
          currentConfig: result.proposedConfig,
        }));

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const rejectConfig = useCallback(
    async (configId: number): Promise<LearningResult> => {
      setLoading(true);
      setError(undefined);

      try {
        const response = await fetch(
          `${apiBaseUrl}/portfolio/learning/reject/${configId}`,
          { method: 'POST' }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result: LearningResult = await response.json();
        setState(prev => ({
          ...prev,
          lastResult: result,
        }));

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const rollbackConfig = useCallback(async (): Promise<LearningResult> => {
    setLoading(true);
    setError(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/portfolio/learning/rollback`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: LearningResult = await response.json();
      setState(prev => ({
        ...prev,
        lastResult: result,
        currentConfig: result.proposedConfig,
      }));

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const fetchHistory = useCallback(
    async (limit: number = 10): Promise<void> => {
      setLoading(true);
      setError(undefined);

      try {
        const response = await fetch(
          `${apiBaseUrl}/portfolio/learning/history?limit=${limit}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const history: LearningResult[] = await response.json();
        setState(prev => ({ ...prev, history }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const fetchCurrentConfig = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/portfolio/learning/current-config`);

      if (response.status === 404) {
        setState(prev => ({ ...prev, currentConfig: undefined }));
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const config: FusionConfigSnapshot = await response.json();
      setState(prev => ({ ...prev, currentConfig: config }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const clearError = useCallback(() => {
    setError(undefined);
  }, []);

  return {
    state,
    triggerLearning,
    approveConfig,
    rejectConfig,
    rollbackConfig,
    fetchHistory,
    fetchCurrentConfig,
    clearError,
  };
};
