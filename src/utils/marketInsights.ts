import type {
  InstrumentSearchItem,
  MarketSentimentOverview,
  RadarItem,
  Recommendation,
} from '../services/api';

export type SuggestedAction = 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
export type MarketRegime = 'BULL' | 'BEAR' | 'SIDEWAYS';

export interface MarketInsightInput {
  sentiment?: MarketSentimentOverview;
  gainers: InstrumentSearchItem[];
  losers: InstrumentSearchItem[];
  opportunities: RadarItem[];
  recommendations: Recommendation[];
  buySellThreshold?: number;
}

export interface MarketInsightOutput {
  summary: string;
  action: SuggestedAction;
  confidence: number;
  explanation: string;
  riskWarnings: string[];
  marketRegime: MarketRegime;
}

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const average = (values: number[]): number => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getVolatilityPenalty = (volatilityLevel?: string): number => {
  switch (volatilityLevel) {
    case 'LOW':
      return 0;
    case 'MODERATE':
      return 0.06;
    case 'HIGH':
      return 0.16;
    case 'EXTREME':
      return 0.26;
    default:
      return 0.1;
  }
};

const getRegime = (marketScore: number): MarketRegime => {
  if (marketScore >= 0.2) return 'BULL';
  if (marketScore <= -0.2) return 'BEAR';
  return 'SIDEWAYS';
};

export const deriveMarketInsight = (input: MarketInsightInput): MarketInsightOutput => {
  const {
    sentiment,
    gainers,
    losers,
    opportunities,
    recommendations,
    buySellThreshold = 65,
  } = input;

  const sentimentScore = clamp((sentiment?.sentimentScore ?? 0) / 100, -1, 1);
  const indexMomentum = average((sentiment?.majorIndices ?? []).map((index) => index.changePercent / 3));
  const sectorMomentum = average((sentiment?.sectors ?? []).map((sector) => sector.changePercent / 3));

  const gainerMomentum = average(gainers.map((item) => (item.changePercent ?? 0) / 5));
  const loserMomentum = average(losers.map((item) => Math.abs(item.changePercent ?? 0) / 5));
  const moversBias = gainerMomentum - loserMomentum;

  const bullishSetups = opportunities.filter((item) => item.bias === 'UP').length;
  const bearishSetups = opportunities.filter((item) => item.bias === 'DOWN').length;
  const setupBias = opportunities.length
    ? (bullishSetups - bearishSetups) / opportunities.length
    : 0;

  const recommendationBiasRaw = recommendations.reduce((score, rec) => {
    if (rec.direction === 'BUY') return score + 1;
    if (rec.direction === 'SELL') return score - 1;
    return score;
  }, 0);
  const recommendationBias = recommendations.length
    ? recommendationBiasRaw / recommendations.length
    : 0;

  const rawMarketScore =
    sentimentScore * 0.35 +
    clamp(indexMomentum, -1, 1) * 0.15 +
    clamp(sectorMomentum, -1, 1) * 0.15 +
    clamp(moversBias, -1, 1) * 0.12 +
    clamp(setupBias, -1, 1) * 0.13 +
    clamp(recommendationBias, -1, 1) * 0.1;

  const volatilityPenalty = getVolatilityPenalty(sentiment?.volatility.level);
  const marketScore = clamp(rawMarketScore - Math.sign(rawMarketScore || 1) * volatilityPenalty, -1, 1);

  const confidence = clamp(
    Math.round(Math.abs(marketScore) * 70 + opportunities.length * 2 + recommendations.length),
    35,
    95
  );

  let action: SuggestedAction = 'HOLD';
  if (confidence < buySellThreshold) {
    action = sentiment?.volatility.level === 'HIGH' || sentiment?.volatility.level === 'EXTREME'
      ? 'WAIT'
      : 'HOLD';
  } else if (marketScore >= 0.25) {
    action = 'BUY';
  } else if (marketScore <= -0.25) {
    action = 'SELL';
  }

  const strongestSector = [...(sentiment?.sectors ?? [])].sort((a, b) => b.changePercent - a.changePercent)[0];
  const weakestSector = [...(sentiment?.sectors ?? [])].sort((a, b) => a.changePercent - b.changePercent)[0];
  const marketRegime = getRegime(marketScore);

  const summary = marketRegime === 'BULL'
    ? `Market is leaning bullish today${strongestSector ? `, with ${strongestSector.name} leading` : ''}.`
    : marketRegime === 'BEAR'
      ? `Market is leaning bearish today${weakestSector ? `, with pressure in ${weakestSector.name}` : ''}.`
      : 'Market is moving sideways today with mixed signals across sectors.';

  const explanation = action === 'BUY'
    ? 'Buying opportunities exist in stronger setups with supportive breadth and momentum.'
    : action === 'SELL'
      ? 'Protect capital and prioritize short-side or defensive setups until momentum stabilizes.'
      : action === 'WAIT'
        ? 'High uncertainty is present. Waiting for cleaner confirmation can reduce avoidable risk.'
        : 'Signals are mixed. Hold existing quality positions and avoid aggressive new entries.';

  const riskWarnings: string[] = [];

  if (sentiment?.volatility.level === 'HIGH' || sentiment?.volatility.level === 'EXTREME') {
    riskWarnings.push('High volatility detected. Trade with smaller size and tighter risk controls.');
  }

  if ((sentiment?.breadth.advanceDeclineRatio ?? 1) < 0.8) {
    riskWarnings.push('Market breadth is weak. Broad participation is missing in the current move.');
  }

  if (losers.length > gainers.length + 2) {
    riskWarnings.push('Losers are dominating gainers today. Avoid chasing weak breakouts.');
  }

  if (!riskWarnings.length) {
    riskWarnings.push('No major risk spike detected, but continue to use stop losses on every trade.');
  }

  return {
    summary,
    action,
    confidence,
    explanation,
    riskWarnings,
    marketRegime,
  };
};
