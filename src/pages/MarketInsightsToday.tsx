import { useEffect, useMemo, useState } from 'react';
import { Activity, CandlestickChart, Info, RefreshCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { api, type MarketSentimentOverview } from '../services/api';
import { formatPercent } from '../utils/formatters';
import { useMarketStore } from '../store/market';

const fallbackData: MarketSentimentOverview = {
  timestamp: new Date().toISOString(),
  sentiment: 'NEUTRAL',
  sentimentScore: 8,
  sentimentDescription: 'Neutral setup with selective pockets of momentum.',
  volatility: { index: 15.8, level: 'MODERATE', impact: 'Normal trading conditions' },
  breadth: {
    advanceDeclineRatio: 1.16,
    stocksAdvancing: 103,
    stocksDeclining: 89,
    stocksUnchanged: 8,
    interpretation: 'Mixed breadth with slight positive bias',
  },
  majorIndices: [],
  sectors: [
    { name: 'Nifty Bank', changePercent: 1.25, stocksAdvancing: 7, stocksDeclining: 5, relativeStrength: 0.58, performance: 'OUTPERFORMING' },
    { name: 'Nifty IT', changePercent: -0.76, stocksAdvancing: 4, stocksDeclining: 8, relativeStrength: 0.33, performance: 'UNDERPERFORMING' },
    { name: 'Nifty Pharma', changePercent: 0.44, stocksAdvancing: 6, stocksDeclining: 6, relativeStrength: 0.5, performance: 'INLINE' },
    { name: 'Nifty Auto', changePercent: -0.21, stocksAdvancing: 5, stocksDeclining: 7, relativeStrength: 0.42, performance: 'INLINE' },
    { name: 'Nifty Defense', changePercent: 1.82, stocksAdvancing: 8, stocksDeclining: 3, relativeStrength: 0.73, performance: 'OUTPERFORMING' },
    { name: 'Nifty FMCG', changePercent: 0.18, stocksAdvancing: 6, stocksDeclining: 5, relativeStrength: 0.55, performance: 'INLINE' },
  ],
  globalMacro: {
    giftNifty: { price: 22782.45, change: 82.31, changePct: 0.36 },
    brentCrude: { price: 88.26, change: -0.35, changePct: -0.4 },
    usdInr: { price: 83.11, change: 0.14, changePct: 0.17 },
    us10yYield: { price: 4.22, change: 0.02, changePct: 0.48 },
  },
  institutionalFlows: {
    fii: { buy: 4375, sell: 4832, net: -457 },
    dii: { buy: 4558, sell: 4210, net: 348 },
  },
  keyFactors: ['Selective buying in defense and banking', 'Rupee stable but cautious global cues'],
  summary: 'Balanced market tone with stock-specific action.',
};

const infoNotes: Record<string, string> = {
  giftNifty: 'Predicts Nifty 50 opening. Premium = Gap-Up. Discount = Gap-Down vs last close.',
  brentCrude: 'India imports 85% of its oil. Above $90/bbl is bearish for inflation-sensitive pockets.',
  usdInr: 'Rupee weakening may signal capital caution but can support export-heavy sectors.',
  us10yYield: 'Rising US yields can pull foreign risk capital toward US debt.',
  flows: 'FIIs are fast money while DIIs provide domestic cushion. Combined net flow drives trend strength.',
  breadth: 'If index rises while breadth weakens, the rally is narrow and fragile.',
  vix: 'Fear index: <15 calm, 15-20 caution, >20 fear, >25 panic.',
  sectors: 'Sector rotation helps identify where institutional conviction is building or fading.',
};

const mapSentimentToStore = (sentiment: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' => {
  if (sentiment.includes('BULLISH')) return 'BULLISH';
  if (sentiment.includes('BEARISH')) return 'BEARISH';
  return 'NEUTRAL';
};

const formatISTTime = (value: Date): string => {
  return value.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatPrice = (value: number, prefix = ''): string => {
  return `${prefix}${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatCrore = (value: number): string => {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
};

const getGapLabel = (value: number): string => {
  if (value > 0.05) return 'GAP-UP';
  if (value < -0.05) return 'GAP-DOWN';
  return 'FLAT';
};

const getVixLabel = (value: number): 'CALM' | 'CAUTION' | 'FEAR' | 'PANIC' => {
  if (value < 15) return 'CALM';
  if (value < 20) return 'CAUTION';
  if (value < 25) return 'FEAR';
  return 'PANIC';
};

const getBreadthLabel = (ratio: number): 'STRONG BREADTH' | 'MIXED' | 'WEAK' => {
  if (ratio >= 1.3) return 'STRONG BREADTH';
  if (ratio >= 0.9) return 'MIXED';
  return 'WEAK';
};

const getHeatColor = (changePct: number): string => {
  if (changePct > 1.5) return '#16A34A';
  if (changePct >= 0) return 'rgba(74, 222, 128, 0.6)';
  if (changePct >= -1.5) return 'rgba(248, 113, 113, 0.6)';
  return '#DC2626';
};

const normalizeSectorWeights = (sectors: MarketSentimentOverview['sectors']) => {
  const total = sectors.reduce((sum, sector) => sum + Math.max(1, Math.abs(sector.relativeStrength) * 100), 0);
  return sectors.map((sector) => ({
    ...sector,
    weight: Math.max(1, Math.abs(sector.relativeStrength) * 100) / (total || 1),
  }));
};

const InfoTip = ({ content }: { content: string }) => {
  return (
    <div className="group relative">
      <Info className="w-4 h-4 text-gray-400 hover:text-indigo-300 cursor-help" />
      <div className="pointer-events-none absolute right-0 top-6 z-30 w-64 rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-xs text-white opacity-0 shadow-xl backdrop-blur-xl transition-opacity duration-200 group-hover:opacity-100">
        {content}
      </div>
    </div>
  );
};

const MacroCard = ({
  title,
  value,
  change,
  changePct,
  info,
  prefix,
  extraBadge,
  delay,
}: {
  title: string;
  value: number;
  change: number;
  changePct: number;
  info: string;
  prefix?: string;
  extraBadge?: string;
  delay: number;
}) => {
  const isPositive = changePct >= 0;
  return (
    <div
      className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-5"
      style={{ animation: `fadeInCard 0.45s ease ${delay}ms both` }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-400 text-sm">{title}</p>
        <InfoTip content={info} />
      </div>
      <p className="text-2xl font-bold mb-3">{formatPrice(value, prefix)}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={isPositive ? 'text-green-400 text-sm font-semibold' : 'text-red-400 text-sm font-semibold'}>
          {formatPrice(change, prefix)}
        </span>
        <span className={`text-xs px-2 py-1 rounded border ${isPositive ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {formatPercent(changePct)}
        </span>
        {extraBadge && (
          <span className={`text-xs px-2 py-1 rounded border ${extraBadge === 'GAP-UP' ? 'bg-green-500/10 text-green-400 border-green-500/20' : extraBadge === 'GAP-DOWN' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
            {extraBadge}
          </span>
        )}
      </div>
    </div>
  );
};

export const MarketInsightsToday = () => {
  const { setSentiment } = useMarketStore();
  const [data, setData] = useState<MarketSentimentOverview>(fallbackData);
  const [cachedData, setCachedData] = useState<MarketSentimentOverview>(fallbackData);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [now, setNow] = useState(new Date());

  const loadData = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const result = await api.market.getSentimentOverview();
      setData(result);
      setCachedData(result);
      setSentiment(mapSentimentToStore(result.sentiment));
    } catch {
      setHasError(true);
      setData(cachedData);
      setSentiment(mapSentimentToStore(cachedData.sentiment));
    } finally {
      setTimeout(() => setIsLoading(false), 350);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const breadth = data.breadth;
  const breadthTotal = Math.max(1, breadth.stocksAdvancing + breadth.stocksDeclining + breadth.stocksUnchanged);
  const advWidth = (breadth.stocksAdvancing / breadthTotal) * 100;
  const uncWidth = (breadth.stocksUnchanged / breadthTotal) * 100;
  const decWidth = (breadth.stocksDeclining / breadthTotal) * 100;
  const breadthLabel = getBreadthLabel(breadth.advanceDeclineRatio);
  const vixValue = data.volatility.index;
  const vixLabel = getVixLabel(vixValue);
  const vixAngle = -180 + (Math.max(0, Math.min(30, vixValue)) / 30) * 180;

  const sectors = useMemo(() => normalizeSectorWeights(data.sectors).slice(0, 6), [data.sectors]);
  const combinedNet = data.institutionalFlows.fii.net + data.institutionalFlows.dii.net;
  const maxFlow = Math.max(
    1,
    data.institutionalFlows.fii.buy,
    data.institutionalFlows.fii.sell,
    Math.abs(data.institutionalFlows.fii.net),
    data.institutionalFlows.dii.buy,
    data.institutionalFlows.dii.sell,
    Math.abs(data.institutionalFlows.dii.net)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <style>{`@keyframes fadeInCard { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: translateY(0);} }`}</style>

      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center">
              <CandlestickChart className="w-7 h-7 mr-3 text-indigo-500" />
              Indian Market Analysis Cockpit
            </h1>
            <p className="text-sm text-gray-400 mt-1">Assess market health in under 30 seconds</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-300">IST: {formatISTTime(now)}</div>
            <button
              onClick={loadData}
              className="inline-flex items-center px-3 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {hasError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
          ⚠ Data fetch failed. Showing cached data.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="h-36 bg-[#12121a]/60 rounded-xl border border-gray-800/50"></div>
            <div className="h-36 bg-[#12121a]/60 rounded-xl border border-gray-800/50"></div>
            <div className="h-36 bg-[#12121a]/60 rounded-xl border border-gray-800/50"></div>
            <div className="h-36 bg-[#12121a]/60 rounded-xl border border-gray-800/50"></div>
          </div>
          <div className="h-64 bg-[#12121a]/60 rounded-xl border border-gray-800/50"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-56 bg-[#12121a]/60 rounded-xl border border-gray-800/50"></div>
            <div className="h-56 bg-[#12121a]/60 rounded-xl border border-gray-800/50"></div>
          </div>
          <div className="h-52 bg-[#12121a]/60 rounded-xl border border-gray-800/50"></div>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MacroCard title="GIFT Nifty" value={data.globalMacro.giftNifty.price} change={data.globalMacro.giftNifty.change} changePct={data.globalMacro.giftNifty.changePct} info={infoNotes.giftNifty} extraBadge={getGapLabel(data.globalMacro.giftNifty.changePct)} delay={0} />
            <MacroCard title="Brent Crude" value={data.globalMacro.brentCrude.price} change={data.globalMacro.brentCrude.change} changePct={data.globalMacro.brentCrude.changePct} info={infoNotes.brentCrude} prefix="$" delay={100} />
            <MacroCard title="USD/INR" value={data.globalMacro.usdInr.price} change={data.globalMacro.usdInr.change} changePct={data.globalMacro.usdInr.changePct} info={infoNotes.usdInr} delay={200} />
            <MacroCard title="US 10Y Yield" value={data.globalMacro.us10yYield.price} change={data.globalMacro.us10yYield.change} changePct={data.globalMacro.us10yYield.changePct} info={infoNotes.us10yYield} delay={300} />
          </section>

          <section className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6" style={{ animation: 'fadeInCard 0.45s ease 400ms both' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center"><Activity className="w-5 h-5 mr-2 text-indigo-500" />Institutional Flows</h2>
              <InfoTip content={infoNotes.flows} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {([
                { label: 'FII', data: data.institutionalFlows.fii },
                { label: 'DII', data: data.institutionalFlows.dii },
              ] as const).map((flow) => (
                <div key={flow.label} className="rounded-lg border border-gray-800 bg-[#0a0a0f]/50 p-4">
                  <p className="text-sm text-gray-300 mb-4">{flow.label} Flows (₹ Cr)</p>
                  <div className="h-40 flex items-end justify-around gap-4">
                    <div className="flex flex-col items-center gap-2 w-1/3">
                      <div className="w-full max-w-[44px] bg-green-500 rounded-t" style={{ height: `${(flow.data.buy / maxFlow) * 120}px` }}></div>
                      <span className="text-xs text-gray-300">Buy</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 w-1/3">
                      <div className="w-full max-w-[44px] bg-red-500 rounded-t" style={{ height: `${(flow.data.sell / maxFlow) * 120}px` }}></div>
                      <span className="text-xs text-gray-300">Sell</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 w-1/3">
                      <div className={`w-full max-w-[44px] rounded-t ${flow.data.net >= 0 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ height: `${(Math.abs(flow.data.net) / maxFlow) * 120}px` }}></div>
                      <span className="text-xs text-gray-300">Net</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
              <div className={`rounded-lg border px-3 py-2 ${data.institutionalFlows.fii.net >= 0 ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                FII Net: {data.institutionalFlows.fii.net >= 0 ? '▲' : '▼'} {formatCrore(Math.abs(data.institutionalFlows.fii.net))}
              </div>
              <div className={`rounded-lg border px-3 py-2 ${data.institutionalFlows.dii.net >= 0 ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                DII Net: {data.institutionalFlows.dii.net >= 0 ? '▲' : '▼'} {formatCrore(Math.abs(data.institutionalFlows.dii.net))}
              </div>
              <div className={`rounded-lg border px-3 py-2 ${combinedNet >= 0 ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                Combined: {combinedNet >= 0 ? '▲' : '▼'} {formatCrore(Math.abs(combinedNet))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6" style={{ animation: 'fadeInCard 0.45s ease 500ms both' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Advance / Decline</h2>
                <InfoTip content={infoNotes.breadth} />
              </div>
              <div className="rounded-lg overflow-hidden border border-gray-800 bg-[#0a0a0f]/50 h-10 flex">
                <div className="bg-green-500 text-xs text-white flex items-center justify-center" style={{ width: `${advWidth}%` }}>{breadth.stocksAdvancing}</div>
                <div className="bg-gray-500 text-xs text-white flex items-center justify-center" style={{ width: `${uncWidth}%` }}>{breadth.stocksUnchanged}</div>
                <div className="bg-red-500 text-xs text-white flex items-center justify-center" style={{ width: `${decWidth}%` }}>{breadth.stocksDeclining}</div>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <p className="text-gray-300">A/D Ratio: <span className="font-semibold">{breadth.advanceDeclineRatio.toFixed(2)}:1</span></p>
                <span className={`text-xs px-2 py-1 rounded border ${breadthLabel === 'STRONG BREADTH' ? 'text-green-400 border-green-500/20 bg-green-500/10' : breadthLabel === 'WEAK' ? 'text-red-400 border-red-500/20 bg-red-500/10' : 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10'}`}>{breadthLabel}</span>
              </div>
            </div>

            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6" style={{ animation: 'fadeInCard 0.45s ease 600ms both' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">India VIX Gauge</h2>
                <InfoTip content={infoNotes.vix} />
              </div>
              <div className="flex justify-center">
                <svg viewBox="0 0 240 140" className="w-full max-w-[320px]">
                  <path d="M20 120 A100 100 0 0 1 120 20" fill="none" stroke="#22c55e" strokeWidth="14" />
                  <path d="M120 20 A100 100 0 0 1 170 33" fill="none" stroke="#f59e0b" strokeWidth="14" />
                  <path d="M170 33 A100 100 0 0 1 220 120" fill="none" stroke="#ef4444" strokeWidth="14" />
                  <g style={{ transform: `translate(120px,120px) rotate(${vixAngle}deg)`, transformOrigin: 'center', transition: 'transform 1s ease' }}>
                    <line x1="0" y1="0" x2="-82" y2="0" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
                  </g>
                  <circle cx="120" cy="120" r="5" fill="#f8fafc" />
                </svg>
              </div>
              <div className="mt-2 text-center">
                <p className="text-2xl font-bold">{vixValue.toFixed(2)}</p>
                <p className={`text-sm font-semibold ${vixLabel === 'CALM' ? 'text-green-400' : vixLabel === 'CAUTION' ? 'text-yellow-400' : 'text-red-400'}`}>{vixLabel}</p>
              </div>
            </div>
          </section>

          <section className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6" style={{ animation: 'fadeInCard 0.45s ease 700ms both' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Sector Rotation Heatmap</h2>
              <InfoTip content={infoNotes.sectors} />
            </div>
            <div className="flex flex-wrap gap-3">
              {sectors.map((sector) => {
                const simulatedBuy = Math.round(900 + sector.weight * 4500 + Math.max(sector.changePercent, 0) * 300);
                const simulatedSell = Math.round(800 + sector.weight * 4200 + Math.max(-sector.changePercent, 0) * 280);
                const simulatedNet = simulatedBuy - simulatedSell;

                return (
                  <div
                    key={sector.name}
                    className="group relative min-h-[120px] rounded-lg border border-white/10 text-white flex items-center justify-center text-center px-3"
                    style={{ backgroundColor: getHeatColor(sector.changePercent), flex: `${Math.max(1, Math.round(sector.weight * 100))} 1 0%` }}
                  >
                    <div>
                      <p className="font-semibold">{sector.name}</p>
                      <p className="text-sm font-bold mt-1">{formatPercent(sector.changePercent)}</p>
                    </div>
                    <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-xs text-white opacity-0 shadow-xl backdrop-blur-xl transition-opacity duration-200 group-hover:opacity-100">
                      <p className="mb-1">Buy: {formatCrore(simulatedBuy)}</p>
                      <p className="mb-1">Sell: {formatCrore(simulatedSell)}</p>
                      <p className={simulatedNet >= 0 ? 'text-green-300' : 'text-red-300'}>Net: {simulatedNet >= 0 ? '+' : '-'}{formatCrore(Math.abs(simulatedNet))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4 text-sm text-gray-300 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="flex items-center gap-2">
              {data.sentimentScore >= 0 ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
              <span>{data.summary}</span>
            </div>
            <span className="text-gray-400">Data simulated for educational purposes. Not investment advice.</span>
          </section>
        </>
      )}
    </div>
  );
};
