const API_BASE_URL = 'https://localhost:61577/api';

const getHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface Stock {
  symbol: string;
  name: string;
  lastClose: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  sector: string;
  bias: 'BULLISH' | 'BEARISH' | 'NONE';
  state: string;
  setupScore: number;
  qualityLabel: 'HIGH' | 'WATCHLIST' | string;
}

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  emaFast: number;
  emaSlow: number;
  rsi: number;
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
  adx: number;
  plusDI: number;
  minusDI: number;
  atr: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  vwap: number;
  timestamp: string;
}

export interface TrendState {
  state: 'PULLBACK_READY' | 'TRENDING_BEARISH' | 'SIDEWAYS' | 'TRENDING_BULLISH';
  bias: 'BULLISH' | 'BEARISH' | 'NONE';
  setupScore: number;
  qualityLabel: 'HIGH' | 'WATCHLIST' | string;
  scoreBreakdown: {
    adx: number;
    rsi: number;
    emaVwap: number;
    volume: number;
    bollinger: number;
    structure: number;
    total: number;
  };
}

export interface Analysis {
  symbol: string;
  indicators: Indicators;
  trendState: TrendState;
  entryGuidance: {
    direction: 'BUY' | 'SELL' | 'NONE';
    entryPrice: number;
    stopLoss: number;
    target: number;
    riskRewardRatio: number;
  };
  confidence: number;
  explanation: string;
  reasoningPoints: string[];
}

export interface Recommendation {
  direction: 'BUY' | 'SELL' | 'NONE';
  entryPrice: number;
  stopLoss: number;
  target: number;
  riskRewardRatio: number;
  confidence: number;
  explanationText: string;
  reasoningPoints: string[];
  timestamp: string;
  expiresAt: string;
  symbol?: string;
}

export interface RadarItem {
  symbol: string;
  marketState: string;
  setupScore: number;
  qualityLabel: string;
  bias: string;
  lastClose: number;
  atr: number;
}

export interface RadarResponse {
  items: RadarItem[];
  totalScanned: number;
  highQuality: number;
  watchlist: number;
}

export interface MarketSentiment {
  overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  advancers: number;
  decliners: number;
  unchanged: number;
  breadth: number;
  indices: Array<{
    name: string;
    value: number;
    change: number;
    changePercent: number;
  }>;
}

export interface PortfolioPosition {
  symbol: string;
  allocationPercent: number;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  target: number;
  expectedReturn: number;
  riskAmount: number;
}

export interface BacktestTrade {
  id: string;
  entryTime: string;
  entryPrice: number;
  exitTime: string;
  exitPrice: number;
  stopLoss: number;
  target: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  tradeType: 'LONG' | 'SHORT';
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  dailyPnl?: number;
}

export interface BacktestMetrics {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  maxDrawdown: number;
  avgRR: number;
  winningTrades: number;
  losingTrades: number;
  totalReturn?: number;
  profitFactor?: number;
  equityCurve: EquityPoint[];
}

export interface BacktestResult {
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
}

export interface BacktestRequest {
  symbol: string;
  from: string;
  to: string;
  strategy: {
    name: 'ORB' | 'RSI_REVERSAL' | 'EMA_CROSSOVER';
    params: {
      timeframe: number;
      riskPercent: number;
      stopLossType: 'FIXED_PERCENT' | 'ATR' | 'CANDLE';
      targetType: 'RR_RATIO' | 'TRAILING';
      rrRatio?: number;
      slPercent?: number;
      fastEMA?: number;
      slowEMA?: number;
      rsiOverbought?: number;
      rsiOversold?: number;
    };
  };
}

export interface PortfolioOptimization {
  positions: PortfolioPosition[];
  totalCapital: number;
  allocatedCapital: number;
  expectedReturn: number;
  portfolioRisk: number;
  sharpeRatio: number;
  sectorDistribution: Record<string, number>;
  rejectedOpportunities: string[];
  healthScore: number;
}

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error('Login failed');
      return response.json();
    },

    register: async (email: string, password: string, name: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      if (!response.ok) throw new Error('Registration failed');
      return response.json();
    },

    resetPassword: async (email: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error('Password reset failed');
      return response.json();
    },
  },

  instruments: {
    getList: async (priceTimeframe = '1D', scanTimeframe = 15): Promise<Stock[]> => {
      const response = await fetch(
        `${API_BASE_URL}/instrument?priceTimeframe=${priceTimeframe}&scanTimeframe=${scanTimeframe}`,
        { headers: getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch stocks');
      return response.json();
    },

    getDetail: async (symbol: string): Promise<Stock> => {
      const response = await fetch(`${API_BASE_URL}/instrument/${symbol}`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch stock detail');
      return response.json();
    },

    getAnalysis: async (symbol: string, timeframe = 15): Promise<Analysis> => {
      const response = await fetch(
        `${API_BASE_URL}/instrumentanalysis/${symbol}/analysis?timeframe=${timeframe}`,
        { headers: getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch analysis');
      return response.json();
    },

    getRecommendation: async (symbol: string, timeframe = 15): Promise<Recommendation> => {
      const response = await fetch(
        `${API_BASE_URL}/instrumentanalysis/${symbol}/recommend?timeframe=${timeframe}`,
        { method: 'POST', headers: getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch recommendation');
      return response.json();
    },

    getIndicators: async (symbol: string, timeframe = 15, limit = 50): Promise<Indicators[]> => {
      const response = await fetch(
        `${API_BASE_URL}/instrumentanalysis/${symbol}/indicators?timeframe=${timeframe}&limit=${limit}`,
        { headers: getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch indicators');
      return response.json();
    },
  },

  candles: {
    get: async (symbol: string, timeframe = 15): Promise<Candle[]> => {
      const response = await fetch(
        `${API_BASE_URL}/candles/${symbol}?timeframe=${timeframe}`,
        { headers: getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch candles');
      return response.json();
    },

    getRange: async (
      symbol: string,
      timeframe: number,
      fromDate: string,
      toDate: string
    ): Promise<Candle[]> => {
      const response = await fetch(
        `${API_BASE_URL}/candles/${symbol}/range?timeframe=${timeframe}&fromDate=${fromDate}&toDate=${toDate}`,
        { headers: getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch candles');
      return response.json();
    },

    getLatest: async (symbol: string): Promise<Candle> => {
      const response = await fetch(`${API_BASE_URL}/candles/${symbol}/latest`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch latest candle');
      return response.json();
    },
  },

  market: {
    getSentiment: async (): Promise<MarketSentiment> => {
      const response = await fetch(`${API_BASE_URL}/market/sentiment`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch market sentiment');
      return response.json();
    },
  },

  radar: {
    scan: async (minScore = 0, timeframe = 15): Promise<RadarResponse> => {
      const response = await fetch(
        `${API_BASE_URL}/radar?minScore=${minScore}&timeframe=${timeframe}`,
        { headers: getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch radar');
      return response.json();
    },

    getTop: async (minScore = 70, limit = 10): Promise<RadarItem[]> => {
      const response = await fetch(
        `${API_BASE_URL}/radar/top?minScore=${minScore}&limit=${limit}`,
        { headers: getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch top setups');
      return response.json();
    },
  },

  recommendations: {
    getAll: async (): Promise<Recommendation[]> => {
      const response = await fetch(`${API_BASE_URL}/recommendations`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      return response.json();
    },

    getTop: async (
      count = 5,
      minRiskReward?: number,
      minConfidence?: number
    ): Promise<Recommendation[]> => {
      const params = new URLSearchParams({ count: count.toString() });
      if (minRiskReward) params.append('minRiskReward', minRiskReward.toString());
      if (minConfidence) params.append('minConfidence', minConfidence.toString());

      const response = await fetch(`${API_BASE_URL}/recommendations/top?${params}`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch top recommendations');
      return response.json();
    },

    getRanked: async (params: {
      targetReturnPercentage?: number;
      riskTolerance?: number;
      minRiskRewardRatio?: number;
      topCount?: number;
      timeframeMinutes?: number;
    }): Promise<Recommendation[]> => {
      const response = await fetch(`${API_BASE_URL}/recommendations`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to fetch ranked recommendations');
      return response.json();
    },
  },

  portfolio: {
    optimize: async (params: {
      totalCapital: number;
      maxRiskPerTradePercent?: number;
      maxPortfolioRiskPercent?: number;
      maxPositions?: number;
      enableSectorDiversification?: boolean;
      maxSectorAllocationPercent?: number;
      minPositionSizePercent?: number;
      allowedStrategies?: string[];
      timeframeMinutes?: number;
      minConfidence?: number;
    }): Promise<PortfolioOptimization> => {
      const response = await fetch(`${API_BASE_URL}/portfolio/optimize`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to optimize portfolio');
      return response.json();
    },

    getConservative: async (capital = 1000000): Promise<PortfolioOptimization> => {
      const response = await fetch(
        `${API_BASE_URL}/portfolio/optimize/conservative?capital=${capital}`,
        { headers: getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch conservative portfolio');
      return response.json();
    },

    getBalanced: async (capital = 1000000): Promise<PortfolioOptimization> => {
      const response = await fetch(
        `${API_BASE_URL}/portfolio/optimize/balanced?capital=${capital}`,
        { headers: getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch balanced portfolio');
      return response.json();
    },

    getAggressive: async (capital = 1000000): Promise<PortfolioOptimization> => {
      const response = await fetch(
        `${API_BASE_URL}/portfolio/optimize/aggressive?capital=${capital}`,
        { headers: getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch aggressive portfolio');
      return response.json();
    },
  },

  strategies: {
    getAll: async (): Promise<string[]> => {
      const response = await fetch(`${API_BASE_URL}/strategies`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch strategies');
      return response.json();
    },

    evaluate: async (symbol: string): Promise<any> => {
      const response = await fetch(`${API_BASE_URL}/strategies/${symbol}/evaluate`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to evaluate strategies');
      return response.json();
    },

    getRecommendations: async (params: {
      strategy: string;
      timeframe?: number;
      minConfidence?: number;
      topCount?: number;
    }): Promise<Recommendation[]> => {
      const response = await fetch(`${API_BASE_URL}/strategies/recommendations`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to fetch strategy recommendations');
      return response.json();
    },

    backtest: async (params: {

      strategy: string;
      instrumentId: string;
      timeframeMinutes: number;
      startDate: string;
      endDate: string;
      initialCapital: number;
      positionSizePercent: number;
      commissionPercent: number;
      useStopLoss: boolean;
      useTarget: boolean;
    }): Promise<any> => {
      const response = await fetch(`${API_BASE_URL}/strategies/backtest`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to backtest strategy');
      return response.json();
    },
  },

  backtest: {
    run: async (request: BacktestRequest): Promise<BacktestResult> => {
      const response = await fetch(`${API_BASE_URL}/backtest`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error('Backtest failed');
      return response.json();
    },
  },
};
