import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { analyzeStockWithClaude } from '../services/claudeService';

interface StockAnalysisPanelProps {
  symbol: string;
  timeframe: number; // in minutes
}

export function StockAnalysisPanel({ symbol, timeframe }: StockAnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const result = await analyzeStockWithClaude(symbol, timeframe);
      setAnalysis(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze stock';
      setError(errorMessage);
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 border-t border-gray-800 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">AI Analysis</h2>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Analyze with Claude
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-800 p-4 text-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Analysis Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {analysis && (
        <div className="rounded-lg bg-[#12121a]/50 border border-gray-800 p-4">
          <div className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed font-mono">
            {analysis}
          </div>
        </div>
      )}

      {!loading && !error && !analysis && (
        <div className="rounded-lg bg-[#12121a]/50 border border-dashed border-gray-700 p-8 text-center">
          <p className="text-gray-500 text-sm">
            Click "Analyze with Claude" to generate AI-powered trading insights
          </p>
        </div>
      )}
    </div>
  );
}

export default StockAnalysisPanel;
