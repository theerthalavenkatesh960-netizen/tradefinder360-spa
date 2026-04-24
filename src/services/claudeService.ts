import { api, type Indicators, type Candle } from './api';

/**
 * Claude AI Integration Service
 * Fetches stock data from backend and generates AI analysis using Anthropic Claude API.
 */

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Fetch stock data from backend for Claude analysis
 */
async function fetchStockDataForAnalysis(
  symbol: string,
  timeframe: number
): Promise<{ indicators: Indicators; candles: Candle[]; summary: Record<string, unknown> }> {
  try {
    const [indicatorSeries, allCandles, summary] = await Promise.all([
      api.instruments.getIndicators(symbol, timeframe, 10),
      api.candles.get(symbol, timeframe),
      api.instruments.getDetail(symbol),
    ]);

    const indicators = indicatorSeries.length
      ? indicatorSeries[indicatorSeries.length - 1]
      : ({
          emaFast: 0,
          emaSlow: 0,
          rsi: 0,
          macdLine: 0,
          macdSignal: 0,
          macdHistogram: 0,
          adx: 0,
          plusDI: 0,
          minusDI: 0,
          atr: 0,
          bollingerUpper: 0,
          bollingerMiddle: 0,
          bollingerLower: 0,
          vwap: 0,
          timestamp: new Date().toISOString(),
        } as Indicators);

    const candles = allCandles.slice(-10);

    return { indicators, candles, summary };
  } catch (error) {
    console.error('Error fetching stock data for analysis:', error);
    throw error;
  }
}

/**
 * Build analysis prompt from stock data
 */
function buildAnalysisPrompt(
  symbol: string,
  indicators: Indicators,
  candles: Candle[],
  summary: Record<string, unknown>
): string {
  return `You are an expert stock trader analyzing technical charts. Analyze the following stock data and provide trading insights.

**Stock**: ${symbol}
**Sector**: ${summary.sector || 'N/A'}
**Current Price**: ₹${summary.lastClose || 'N/A'}

**Technical Indicators**:
- EMA Fast: ${indicators.emaFast?.toFixed(2) || 'N/A'}
- EMA Slow: ${indicators.emaSlow?.toFixed(2) || 'N/A'}
- RSI: ${indicators.rsi?.toFixed(2) || 'N/A'} (Oversold <30 / Overbought >70)
- MACD: Line=${indicators.macdLine?.toFixed(2)}, Signal=${indicators.macdSignal?.toFixed(2)}, Histogram=${indicators.macdHistogram?.toFixed(2)}
- ADX: ${indicators.adx?.toFixed(2) || 'N/A'} (Trend Strength: >25 strong)
- ATR: ${indicators.atr?.toFixed(2) || 'N/A'} (Volatility)
- Bollinger Bands: Upper=${indicators.bollingerUpper?.toFixed(2)}, Middle=${indicators.bollingerMiddle?.toFixed(2)}, Lower=${indicators.bollingerLower?.toFixed(2)}
- VWAP: ${indicators.vwap?.toFixed(2) || 'N/A'}

**Recent Candles** (last 10):
${candles
  .map(
    (c) =>
      `[${new Date(c.timestamp).toLocaleString()}] O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${(c.volume / 1000000).toFixed(1)}M`
  )
  .join('\n')}

**Your Analysis Should Include**:
1. **Trend Assessment**: Is momentum bullish, bearish, or neutral? Which indicators confirm this?
2. **Key Levels**: Identify support/resistance from recent candles and Bollinger Bands
3. **Entry Opportunity**: If conditions are favorable, suggest an entry price and direction (BUY/SELL/NONE)
4. **Risk Management**: Suggest a stop-loss level to protect against adverse moves
5. **Target**: Provide a profit target based on the ATR and recent range
6. **Confidence**: Rate your confidence (High/Medium/Low) based on indicator alignment
7. **Action**: Specific action to take NOW based on the analysis

Keep the analysis concise and actionable. Focus on high-probability setups. Don't speculate about future movements.`;
}

/**
 * Call Claude API to analyze stock data
 */
async function callClaudeAPI(prompt: string): Promise<string> {
  const messages: ClaudeMessage[] = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  const response = await api.ai.analyze({
    prompt: messages[0].content,
    maxTokens: 2000,
  });

  if (!response.text) {
    throw new Error('No text content returned from AI proxy response');
  }

  return response.text;
}

/**
 * Main function: Analyze stock with Claude
 */
export async function analyzeStockWithClaude(
  symbol: string,
  timeframe: number = 1440
): Promise<string> {
  try {
    // Fetch stock data
    const stockData = await fetchStockDataForAnalysis(symbol, timeframe);

    // Build prompt
    const prompt = buildAnalysisPrompt(symbol, stockData.indicators, stockData.candles, stockData.summary);

    // Call Claude
    const analysis = await callClaudeAPI(prompt);

    return analysis;
  } catch (error) {
    console.error('Error analyzing stock with Claude:', error);
    throw error;
  }
}

/**
 * Get all available functions for export
 */
export default {
  analyzeStockWithClaude,
};
