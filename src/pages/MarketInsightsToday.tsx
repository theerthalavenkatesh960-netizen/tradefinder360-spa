import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CandlestickChart,
  Gauge,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { api, type InstrumentSearchItem } from '../services/api';
import { formatPercent, formatPrice } from '../utils/formatters';
import { useMarketStore } from '../store/market';
import { deriveMarketInsight } from '../utils/marketInsights';
import { RecommendationCard } from '../components/insights/RecommendationCard';
import { InsightBanner } from '../components/insights/InsightBanner';

const mapSentimentToStore = (sentiment: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' => {
  if (sentiment.includes('BULLISH')) return 'BULLISH';
  if (sentiment.includes('BEARISH')) return 'BEARISH';
  return 'NEUTRAL';
};

const getVolumeSpikeLabel = (item: InstrumentSearchItem, baselineVolume: number): string => {
  const volume = item.volume ?? 0;
  if (!baselineVolume || !volume) return 'Normal Volume';
  if (volume >= baselineVolume * 1.6) return 'High Volume';
  if (volume >= baselineVolume * 1.25) return 'Volume Build-up';
  return 'Normal Volume';
};

const getMoverTag = (item: InstrumentSearchItem, type: 'gainer' | 'loser'): string => {
  const change = item.changePercent ?? 0;
  if (type === 'gainer') {
    if (change >= 3) return 'Breakout';
    if (change >= 1.25) return 'Momentum';
    return 'Steady Up';
  }

  if (change <= -3) return 'Oversold Watch';
  if (change <= -1.25) return 'Reversal Watch';
  return 'Weakness';
};

const getOpportunityTag = (marketState: string, bias: string): string => {
  if (marketState.toUpperCase().includes('BREAK')) return 'Breakout';
  if (marketState.toUpperCase().includes('PULLBACK')) return 'Reversal';
  if (bias === 'UP') return 'Momentum';
  if (bias === 'DOWN') return 'Pullback Risk';
  return 'High Activity';
};

export const MarketInsightsToday = () => {
  const { setSentiment } = useMarketStore();

  const {
    data: sentiment,
    isLoading: isSentimentLoading,
    isError: isSentimentError,
  } = useQuery({
    queryKey: ['market-sentiment-overview'],
    queryFn: api.market.getSentimentOverview,
  });

  useEffect(() => {
    if (sentiment?.sentiment) {
      setSentiment(mapSentimentToStore(sentiment.sentiment));
    }
  }, [sentiment, setSentiment]);

  const {
    data: opportunities = [],
    isLoading: isOpportunitiesLoading,
    isError: isOpportunitiesError,
  } = useQuery({
    queryKey: ['radar-top-insights'],
    queryFn: () => api.radar.getTop(60, 8),
  });

  const {
    data: recommendations = [],
    isLoading: isRecommendationsLoading,
    isError: isRecommendationsError,
  } = useQuery({
    queryKey: ['recommendations-top-insights'],
    queryFn: () => api.recommendations.getTop(6, 1.2, 55),
  });

  const {
    data: gainersResponse,
    isLoading: isGainersLoading,
    isError: isGainersError,
  } = useQuery({
    queryKey: ['movers-gainers'],
    queryFn: () =>
      api.instruments.search({
        minChangePercent: 0.5,
        sortBy: 'change',
        sortDirection: 'desc',
        page: 1,
        pageSize: 6,
        priceTimeframe: '1D',
      }),
  });

  const {
    data: losersResponse,
    isLoading: isLosersLoading,
    isError: isLosersError,
  } = useQuery({
    queryKey: ['movers-losers'],
    queryFn: () =>
      api.instruments.search({
        maxChangePercent: -0.5,
        sortBy: 'change',
        sortDirection: 'asc',
        page: 1,
        pageSize: 6,
        priceTimeframe: '1D',
      }),
  });

  const gainers = gainersResponse?.items ?? [];
  const losers = losersResponse?.items ?? [];
  const isMoversError = isGainersError || isLosersError;

  const marketInsight = useMemo(
    () =>
      deriveMarketInsight({
        sentiment,
        gainers,
        losers,
        opportunities,
        recommendations,
        buySellThreshold: 65,
      }),
    [sentiment, gainers, losers, opportunities, recommendations]
  );

  const isPageLoading =
    isSentimentLoading ||
    isOpportunitiesLoading ||
    isRecommendationsLoading ||
    isGainersLoading ||
    isLosersLoading;

  const moversForVolume = [...gainers, ...losers];
  const baselineVolume = useMemo(() => {
    if (!moversForVolume.length) return 0;
    const sortedVolumes = moversForVolume
      .map((item) => item.volume ?? 0)
      .filter((volume) => volume > 0)
      .sort((a, b) => a - b);
    if (!sortedVolumes.length) return 0;
    const middle = Math.floor(sortedVolumes.length / 2);
    return sortedVolumes[middle];
  }, [moversForVolume]);

  const topSectors = [...(sentiment?.sectors ?? [])]
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 8);
  const bestSector = topSectors[0];
  const worstSector = [...(sentiment?.sectors ?? [])].sort((a, b) => a.changePercent - b.changePercent)[0];
  const maxSectorMove = Math.max(...topSectors.map((sector) => Math.abs(sector.changePercent)), 1);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <CandlestickChart className="w-8 h-8 mr-3 text-indigo-500" />
          Market Insights - Today
        </h1>
        <p className="text-gray-400">
          Beginner-friendly view of where the market is moving and what to focus on now.
        </p>
      </div>

      {isPageLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <>
          <section className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="inline-flex items-center px-3 py-1 rounded-lg border border-gray-700 text-sm text-gray-300 mb-3">
                  <Activity className="w-4 h-4 mr-2 text-indigo-400" />
                  Market Regime: <span className="ml-1 font-semibold">{marketInsight.marketRegime}</span>
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  {sentiment?.sentimentDescription ?? 'Market snapshot is currently unavailable'}
                </h2>
                <p className="text-gray-300">{marketInsight.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 min-w-[280px]">
                <div className="bg-[#0a0a0f]/50 rounded-lg p-4 border border-gray-800">
                  <p className="text-xs text-gray-400 mb-1">Sentiment Score</p>
                  <p className="text-xl font-bold">{Math.round(sentiment?.sentimentScore ?? 0)}</p>
                </div>
                <div className="bg-[#0a0a0f]/50 rounded-lg p-4 border border-gray-800">
                  <p className="text-xs text-gray-400 mb-1">Volatility</p>
                  <p className="text-xl font-bold">{sentiment?.volatility.level ?? 'N/A'}</p>
                </div>
                <div className="bg-[#0a0a0f]/50 rounded-lg p-4 border border-gray-800">
                  <p className="text-xs text-gray-400 mb-1">Adv/Dec Ratio</p>
                  <p className="text-xl font-bold">{(sentiment?.breadth.advanceDeclineRatio ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-[#0a0a0f]/50 rounded-lg p-4 border border-gray-800">
                  <p className="text-xs text-gray-400 mb-1">Top Index Move</p>
                  <p className="text-xl font-bold">
                    {formatPercent(
                      sentiment?.majorIndices.length
                        ? Math.max(...sentiment.majorIndices.map((index) => index.changePercent))
                        : 0
                    )}
                  </p>
                </div>
              </div>
            </div>

            {isSentimentError && (
              <div className="mt-4">
                <InsightBanner
                  title="Market feed is partially unavailable"
                  message="Some metrics may be delayed. Recommendations are still computed from available data."
                  tone="warning"
                />
              </div>
            )}
          </section>

          <section>
            <RecommendationCard
              action={marketInsight.action}
              confidence={marketInsight.confidence}
              explanation={marketInsight.explanation}
            />
            {isRecommendationsError && (
              <div className="mt-3">
                <InsightBanner
                  title="Recommendation feed unavailable"
                  message="Action guidance is using fallback market logic because recommendation data could not be fetched."
                  tone="warning"
                />
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <ArrowUpRight className="w-5 h-5 mr-2 text-green-400" />
                Top Gainers
              </h3>
              <div className="space-y-3">
                {gainers.map((item) => (
                  <a
                    key={item.symbol}
                    href={`/stocks/${item.symbol}`}
                    className="block p-3 rounded-lg bg-[#0a0a0f]/50 hover:bg-[#0a0a0f] border border-gray-800 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.symbol}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {getVolumeSpikeLabel(item, baselineVolume)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-semibold">{formatPercent(item.changePercent)}</p>
                        <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-300 border border-green-500/20">
                          {getMoverTag(item, 'gainer')}
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
                {!gainers.length && <p className="text-sm text-gray-400">No gainers available right now.</p>}
              </div>
            </div>

            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <ArrowDownRight className="w-5 h-5 mr-2 text-red-400" />
                Top Losers
              </h3>
              <div className="space-y-3">
                {losers.map((item) => (
                  <a
                    key={item.symbol}
                    href={`/stocks/${item.symbol}`}
                    className="block p-3 rounded-lg bg-[#0a0a0f]/50 hover:bg-[#0a0a0f] border border-gray-800 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.symbol}</p>
                        <p className="text-xs text-gray-400 mt-1">Potential oversold watchlist candidate</p>
                      </div>
                      <div className="text-right">
                        <p className="text-red-400 font-semibold">{formatPercent(item.changePercent)}</p>
                        <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-300 border border-red-500/20">
                          {getMoverTag(item, 'loser')}
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
                {!losers.length && <p className="text-sm text-gray-400">No losers available right now.</p>}
              </div>
            </div>
            {isMoversError && (
              <div className="lg:col-span-2">
                <InsightBanner
                  title="Movers feed unavailable"
                  message="Top gainers or losers could not be loaded. Market summary and action recommendation are still available."
                  tone="warning"
                />
              </div>
            )}
          </section>

          <section className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-indigo-400" />
              Sector Performance
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                {topSectors.map((sector) => {
                  const widthPercent = Math.max(
                    10,
                    Math.round((Math.abs(sector.changePercent) / maxSectorMove) * 100)
                  );
                  const isPositive = sector.changePercent >= 0;

                  return (
                    <div key={sector.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-300">{sector.name}</span>
                        <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                          {formatPercent(sector.changePercent)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#0a0a0f] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {!topSectors.length && <p className="text-sm text-gray-400">Sector data is currently unavailable.</p>}
              </div>

              <div className="space-y-3">
                <InsightBanner
                  title="Best Performing Sector"
                  message={
                    bestSector
                      ? `${bestSector.name} is leading gains today. Consider scanning leaders from this sector.`
                      : 'Sector leadership data is unavailable right now.'
                  }
                  tone="positive"
                />
                <InsightBanner
                  title="Weakest Sector"
                  message={
                    worstSector
                      ? `${worstSector.name} is under pressure today. Avoid weak setups unless risk is tightly managed.`
                      : 'No clear lagging sector detected.'
                  }
                  tone="warning"
                />
              </div>
            </div>
          </section>

          <section className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-indigo-400" />
              Trending Opportunities
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {opportunities.map((item) => (
                <a
                  key={item.symbol}
                  href={`/stocks/${item.symbol}`}
                  className="rounded-lg p-4 bg-[#0a0a0f]/50 border border-gray-800 hover:border-indigo-500/30 transition"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold">{item.symbol}</p>
                      <p className="text-xs text-gray-400">{item.marketState}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded border border-indigo-500/30 text-indigo-300 bg-indigo-500/10">
                      {getOpportunityTag(item.marketState, item.bias)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs">Setup Score</p>
                      <p className="font-semibold">{item.setupScore}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Last Price</p>
                      <p className="font-semibold">{formatPrice(item.lastClose)}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
            {isOpportunitiesError && (
              <div className="mt-3">
                <InsightBanner
                  title="Opportunities feed unavailable"
                  message="Trending opportunities could not be fetched right now. Try refreshing after a minute."
                  tone="warning"
                />
              </div>
            )}
            {!opportunities.length && (
              <p className="text-sm text-gray-400 mt-3">No opportunities passed the current quality threshold.</p>
            )}
          </section>

          <section className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <ShieldAlert className="w-5 h-5 mr-2 text-amber-400" />
              Risk Indicators
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {marketInsight.riskWarnings.map((warning) => (
                <InsightBanner
                  key={warning}
                  title="Risk Alert"
                  message={warning}
                  tone="warning"
                />
              ))}
            </div>
          </section>

          <section className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <Gauge className="w-5 h-5 mr-2 text-indigo-400" />
              Sentiment & Regime Snapshot
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-gray-800 bg-[#0a0a0f]/50 p-4">
                <p className="text-xs text-gray-400">Sentiment</p>
                <p className="text-lg font-semibold mt-1">{sentiment?.sentiment ?? 'N/A'}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0a0a0f]/50 p-4">
                <p className="text-xs text-gray-400">Regime</p>
                <p className="text-lg font-semibold mt-1">{marketInsight.marketRegime}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0a0a0f]/50 p-4">
                <p className="text-xs text-gray-400">Volatility Impact</p>
                <p className="text-sm font-medium mt-1 text-gray-300">
                  {sentiment?.volatility.impact ?? 'N/A'}
                </p>
              </div>
            </div>
          </section>

          {sentiment?.keyFactors.length ? (
            <section className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-indigo-400" />
                Key Market Factors Today
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sentiment.keyFactors.slice(0, 6).map((factor) => (
                  <div key={factor} className="rounded-lg border border-gray-800 bg-[#0a0a0f]/50 p-3 text-sm text-gray-300">
                    {factor}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
};
