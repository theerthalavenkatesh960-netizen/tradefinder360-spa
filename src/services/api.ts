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
  candles?: Candle[];
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

export interface MoverItem {
  symbol: string;
  exchange: string;
  lastClose: number;
  changePercent: number;
  atr: number;
  bias: string;
  setupScore: number;
  scannedAt: string;
  trendCandles: Candle[]; // Last 5 days of daily candles for mini-chart
  aiAnalysis: string; // Placeholder for AI insights
}

export interface SectorLeaderItem {
  symbol: string;
  exchange: string;
  lastClose: number;
  changePercent: number;
  setupScore: number;
  bias: string;
  scannedAt: string;
}

export interface BreakoutItem {
  symbol: string;
  exchange: string;
  lastClose: number;
  openRangeHigh: number;
  openRangeLow: number;
  breakoutPercent: number;
  direction: 'LONG' | 'SHORT';
  setupScore: number;
  scannedAt: string;
}

export interface SRProximityItem {
  symbol: string;
  exchange: string;
  lastClose: number;
  level: number;
  distancePercent: number;
  levelType: 'SUPPORT' | 'RESISTANCE';
  bias: string;
  setupScore: number;
  scannedAt: string;
}

export interface PatternItem {
  symbol: string;
  exchange: string;
  lastClose: number;
  patternName: string;
  patternDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  setupScore: number;
  scannedAt: string;
}

export interface RadarSections {
  topGainers: MoverItem[];
  topLosers: MoverItem[];
  sectorLeaders: SectorLeaderItem[];
  breakouts30Min: BreakoutItem[];
  nearSupport: SRProximityItem[];
  nearResistance: SRProximityItem[];
  patterns: PatternItem[];
  generatedAt: string;
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

export interface MarketSentimentOverview {
  timestamp: string;
  sentiment: 'STRONGLY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONGLY_BEARISH';
  sentimentScore: number;
  sentimentDescription: string;
  volatility: {
    index: number;
    level: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
    impact: string;
  };
  breadth: {
    advanceDeclineRatio: number;
    stocksAdvancing: number;
    stocksDeclining: number;
    stocksUnchanged: number;
    interpretation: string;
  };
  majorIndices: Array<{
    name: string;
    symbol: string;
    currentValue: number;
    changePercent: number;
    dayHigh: number;
    dayLow: number;
    trend: string;
  }>;
  sectors: Array<{
    name: string;
    changePercent: number;
    stocksAdvancing: number;
    stocksDeclining: number;
    relativeStrength: number;
    performance: string;
  }>;
  globalMacro: {
    giftNifty: {
      price: number;
      change: number;
      changePct: number;
    };
    brentCrude: {
      price: number;
      change: number;
      changePct: number;
    };
    usdInr: {
      price: number;
      change: number;
      changePct: number;
    };
    us10yYield: {
      price: number;
      change: number;
      changePct: number;
    };
  };
  institutionalFlows: {
    fii: {
      buy: number;
      sell: number;
      net: number;
    };
    dii: {
      buy: number;
      sell: number;
      net: number;
    };
  };
  keyFactors: string[];
  summary: string;
}

export interface InstrumentSearchRequest {
  search?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  instrumentType?: string;
  derivativesEnabled?: boolean;
  trend?: string;
  minSetupScore?: number;
  maxSetupScore?: number;
  minAdx?: number;
  rsiBelow?: number;
  rsiAbove?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  minChangePercent?: number;
  maxChangePercent?: number;
  hasRecommendation?: boolean;
  priceTimeframe?: string;
  scanTimeframe?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface InstrumentSearchItem {
  id: number;
  name: string;
  symbol: string;
  exchange: string;
  instrumentKey: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  instrumentType?: string;
  isDerivativesEnabled: boolean;
  price?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  trend?: string;
  setupScore?: number;
  marketState?: string;
  entryPrice?: number;
  exitPrice?: number;
  stopLoss?: number;
  expectedProfit?: number;
  confidence?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
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
  initialCapital?: number;
  finalCapital?: number;
  avgWinPnl?: number;
  avgLossPnl?: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  annotations?: BacktestAnnotations;
  comparison?: BacktestComparison;
}

export interface BacktestComparisonProfile {
  mode: 'INTRADAY' | 'SWING';
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  annotations?: BacktestAnnotations;
}

export interface BacktestComparison {
  intraday: BacktestComparisonProfile;
  swing: BacktestComparisonProfile;
}

export interface BacktestAnnotations {
  // One OrbZone per trading day
  orbZones?: OrbZone[];
  fvgZones?: FvgZone[];
  obZones?: OrderBlockZone[];
  retraceEvent?: ReplayEvent;
  engulfingEvent?: ReplayEvent;
  orbs?: OrbAnnotation[];
  fvgs?: FvgAnnotation[];
  orderBlocks?: OrderBlockAnnotation[];
  events?: SignalEventAnnotation[];
}

export interface OrbZone {
  orbStartIdx: number;
  orbEndIdx: number;
  orbHigh: number;
  orbLow: number;
  /** Non-null when no trade was entered that day — reason why */
  tradeNotTakenReason?: string | null;
}

export interface FvgZone {
  fvgStartIdx: number;
  fvgEndIdx: number;
  fvgHigh: number;
  fvgLow: number;
  direction?: string | null;  // 'BULLISH' | 'BEARISH'
}

export interface OrderBlockZone {
  obStartIdx: number;
  obEndIdx: number;
  obHigh: number;
  obLow: number;
}

export interface ReplayEvent {
  candleIdx: number;
  price: number;
}

export interface OrbAnnotation {
  timestamp: string;
  high: number;
  low: number;
}

export interface FvgAnnotation {
  formedAt: string;
  gapLow: number;
  gapHigh: number;
  direction: string;
}

export interface OrderBlockAnnotation {
  timestamp: string;
  high: number;
  low: number;
  direction: string;
}

export interface SignalEventAnnotation {
  timestamp: string;
  eventType: string;
  description: string;
}

export interface BacktestRequest {
  symbol: string;
  from: string;
  to: string;
  initialCapital?: number;
  strategy: {
    name: 'ORB' | 'RSI_REVERSAL' | 'EMA' | 'SMC';
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
      includeOrderBlocks?: boolean;
      emaFilterType?: 'RSI' | 'VOLUME' | 'SUPPORT_RESISTANCE' | 'PRICE_ACTION';
      useTripleEma?: boolean;
      middleEma?: number;
      emaRsiPeriod?: number;
      emaRsiMidline?: number;
      volumeAvgPeriod?: number;
      volumeMultiplier?: number;
      srLookbackPeriod?: number;
      srBuffer?: number;
      allowedPatterns?: ('Engulfing' | 'Hammer' | 'Doji' | 'MorningStar')[];
      candleLookback?: number;
      emaSlType?: 'FIXED_PERCENT' | 'BELOW_EMA' | 'ATR_BASED';
      emaSlValue?: number;
      emaAtrPeriod?: number;
      targetRRR?: number;
      maxHoldingPeriods?: number;
      tradeDirection?: 'LONG_ONLY' | 'SHORT_ONLY' | 'BOTH';
      emaTimeframeMode?: 'INTRADAY' | 'SWING' | 'BOTH';
      emaMode?: 'CROSSOVER' | 'PULLBACK' | 'SPEED' | 'PULLBACK_SPEED';
      orbMode?: 'CLASSIC' | 'FVG_RETEST';
      smcMode?: 'FVG_OB';
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

export interface AiAnalyzeRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
}

export interface AiAnalyzeResponse {
  text: string;
  model: string;
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

    search: async (
      request: InstrumentSearchRequest
    ): Promise<PaginatedResult<InstrumentSearchItem>> => {
      const response = await fetch(`${API_BASE_URL}/instrument/search`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error('Failed to search instruments');
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

    getSentimentOverview: async (): Promise<MarketSentimentOverview> => {
      const response = await fetch(`${API_BASE_URL}/market/sentiment`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch market sentiment overview');
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

    getSections: async (
      timeframe = 15,
      sectionLimit = 10,
      srThresholdPct = 1.5
    ): Promise<RadarSections> => {
      const params = new URLSearchParams({
        timeframe: timeframe.toString(),
        sectionLimit: sectionLimit.toString(),
        srThresholdPct: srThresholdPct.toString(),
      });
      const response = await fetch(`${API_BASE_URL}/radar/sections?${params}`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch radar sections');
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

  ai: {
    analyze: async (request: AiAnalyzeRequest): Promise<AiAnalyzeResponse> => {
      const response = await fetch(`${API_BASE_URL}/ai/anthropic/analyze`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`AI analyze request failed: ${response.status} - ${details}`);
      }

      return response.json();
    },
  },
};
