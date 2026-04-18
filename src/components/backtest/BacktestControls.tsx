import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays } from 'date-fns';
import { ChevronDown, Play, Settings, Calendar } from 'lucide-react';
import type { BacktestRequest } from '../../services/api';

interface BacktestControlsProps {
  symbol: string;
  onRun: (request: BacktestRequest) => void;
  isLoading: boolean;
}

const STRATEGIES = [
  { value: 'ORB', label: 'ORB', description: 'Opening Range Breakout family' },
  { value: 'RSI_REVERSAL', label: 'RSI Reversal', description: 'Overbought/oversold reversal' },
  { value: 'EMA', label: 'EMA', description: 'EMA strategy family (crossover, pullback, speed)' },
  { value: 'SMC', label: 'SMC', description: 'SMC FVG + Order Block family' },
] as const;

const TIMEFRAMES = [
  { label: '1m', value: 1 },
  { label: '5m', value: 5 },
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
];

const SL_TYPES = [
  { value: 'ATR', label: 'ATR-based' },
  { value: 'FIXED_PERCENT', label: 'Fixed %' },
  { value: 'CANDLE', label: 'Candle Low/High' },
] as const;

const TARGET_TYPES = [
  { value: 'RR_RATIO', label: 'R:R Ratio' },
  { value: 'TRAILING', label: 'Trailing SL' },
] as const;

export const BacktestControls = ({ symbol, onRun, isLoading }: BacktestControlsProps) => {
  const [expanded, setExpanded] = useState(true);
  const [strategy, setStrategy] = useState<'ORB' | 'RSI_REVERSAL' | 'EMA' | 'SMC'>('ORB');
  const [emaMode, setEmaMode] = useState<'CROSSOVER' | 'PULLBACK' | 'SPEED' | 'PULLBACK_SPEED'>('CROSSOVER');
  const [orbMode, setOrbMode] = useState<'CLASSIC' | 'FVG_RETEST'>('CLASSIC');
  const [smcMode, setSmcMode] = useState<'FVG_OB'>('FVG_OB');
  // const [from, setFrom] = useState(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
  // const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [from, setFrom] = useState('2026-01-19');
  const [to, setTo] = useState('2026-01-21');
  const [timeframe, setTimeframe] = useState(5);
  const [riskPercent, setRiskPercent] = useState(1);
  const [slType, setSlType] = useState<'FIXED_PERCENT' | 'ATR' | 'CANDLE'>('ATR');
  const [targetType, setTargetType] = useState<'RR_RATIO' | 'TRAILING'>('RR_RATIO');
  const [rrRatio, setRrRatio] = useState(2);
  const [slPercent, setSlPercent] = useState(1);
  const [fastEMA, setFastEMA] = useState(9);
  const [slowEMA, setSlowEMA] = useState(21);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [capital, setCapital] = useState(100000);
  const [includeOrderBlocks, setIncludeOrderBlocks] = useState(false);
  const [emaTimeframeMode, setEmaTimeframeMode] = useState<'INTRADAY' | 'SWING' | 'BOTH'>('INTRADAY');
  const [useTripleEma, setUseTripleEma] = useState(false);
  const [middleEma, setMiddleEma] = useState(21);
  const [emaFilterType, setEmaFilterType] = useState<'RSI' | 'VOLUME' | 'SUPPORT_RESISTANCE' | 'PRICE_ACTION'>('RSI');
  const [emaRsiPeriod, setEmaRsiPeriod] = useState(14);
  const [emaRsiMidline, setEmaRsiMidline] = useState(50);
  const [volumeAvgPeriod, setVolumeAvgPeriod] = useState(20);
  const [volumeMultiplier, setVolumeMultiplier] = useState(1.5);
  const [srLookbackPeriod, setSrLookbackPeriod] = useState(20);
  const [srBuffer, setSrBuffer] = useState(0.5);
  const [allowedPatterns, setAllowedPatterns] = useState<Array<'Engulfing' | 'Hammer' | 'Doji' | 'MorningStar'>>(['Engulfing']);
  const [candleLookback, setCandleLookback] = useState(1);
  const [emaSlType, setEmaSlType] = useState<'FIXED_PERCENT' | 'BELOW_EMA' | 'ATR_BASED'>('FIXED_PERCENT');
  const [emaSlValue, setEmaSlValue] = useState(1);
  const [emaAtrPeriod, setEmaAtrPeriod] = useState(14);
  const [targetRRR, setTargetRRR] = useState(2);
  const [maxHoldingPeriods, setMaxHoldingPeriods] = useState(10);
  const [tradeDirection, setTradeDirection] = useState<'LONG_ONLY' | 'SHORT_ONLY' | 'BOTH'>('BOTH');

  const applyEmaTimeframeDefaults = (mode: 'INTRADAY' | 'SWING' | 'BOTH') => {
    setEmaTimeframeMode(mode);
    if (mode === 'INTRADAY') {
      setFastEMA(9);
      setSlowEMA(21);
      setMiddleEma(21);
    }
    if (mode === 'SWING') {
      setFastEMA(20);
      setSlowEMA(50);
      setMiddleEma(21);
    }
  };

  const handleRun = () => {
    const request: BacktestRequest = {
      symbol,
      from,
      to,
      initialCapital: capital,
      strategy: {
        name: strategy,
        params: {
          timeframe,
          riskPercent,
          stopLossType: slType,
          targetType,
          rrRatio: targetType === 'RR_RATIO' ? rrRatio : undefined,
          slPercent: slType === 'FIXED_PERCENT' ? slPercent : undefined,
          fastEMA: strategy === 'EMA' ? fastEMA : undefined,
          slowEMA: strategy === 'EMA' ? slowEMA : undefined,
          rsiOverbought: strategy === 'RSI_REVERSAL' ? rsiOverbought : undefined,
          rsiOversold: strategy === 'RSI_REVERSAL' ? rsiOversold : undefined,
          includeOrderBlocks: strategy === 'ORB' && orbMode === 'FVG_RETEST' ? includeOrderBlocks : undefined,
          emaFilterType: strategy === 'EMA' ? emaFilterType : undefined,
          useTripleEma: strategy === 'EMA' ? useTripleEma : undefined,
          middleEma: strategy === 'EMA' ? middleEma : undefined,
          emaRsiPeriod: strategy === 'EMA' ? emaRsiPeriod : undefined,
          emaRsiMidline: strategy === 'EMA' ? emaRsiMidline : undefined,
          volumeAvgPeriod: strategy === 'EMA' ? volumeAvgPeriod : undefined,
          volumeMultiplier: strategy === 'EMA' ? volumeMultiplier : undefined,
          srLookbackPeriod: strategy === 'EMA' ? srLookbackPeriod : undefined,
          srBuffer: strategy === 'EMA' ? srBuffer : undefined,
          allowedPatterns: strategy === 'EMA' ? allowedPatterns : undefined,
          candleLookback: strategy === 'EMA' ? candleLookback : undefined,
          emaSlType: strategy === 'EMA' ? emaSlType : undefined,
          emaSlValue: strategy === 'EMA' ? emaSlValue : undefined,
          emaAtrPeriod: strategy === 'EMA' ? emaAtrPeriod : undefined,
          targetRRR: strategy === 'EMA' ? targetRRR : undefined,
          maxHoldingPeriods: strategy === 'EMA' ? maxHoldingPeriods : undefined,
          tradeDirection: strategy === 'EMA' ? tradeDirection : undefined,
          emaMode: strategy === 'EMA' ? emaMode : undefined,
          orbMode: strategy === 'ORB' ? orbMode : undefined,
          smcMode: strategy === 'SMC' ? smcMode : undefined,
        },
      },
    };
    onRun(request);
  };

  const selectedStrategy = STRATEGIES.find((s) => s.value === strategy)!;

  return (
    <div className="bg-[#12121a]/60 border border-gray-800/50 rounded-xl mb-4 overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-500/10 p-1.5 rounded-lg">
            <Settings className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">
              {selectedStrategy.label}
            </p>
            <p className="text-xs text-gray-500">
              {timeframe}m · {from} → {to}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-5 border-t border-gray-800/50 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Strategy */}
                <div className="lg:col-span-1">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                    Strategy
                  </label>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as typeof strategy)}
                    className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    {STRATEGIES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {STRATEGIES.find(s => s.value === strategy)?.description}
                  </p>
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                    Date Range
                  </label>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">From</p>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                        <input
                          type="date"
                          value={from}
                          onChange={(e) => setFrom(e.target.value)}
                          onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                          readOnly={false}
                          className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">To</p>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                        <input
                          type="date"
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                          onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                          readOnly={false}
                          className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeframe + Risk */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                    Timeframe
                  </label>
                  <div className="grid grid-cols-4 gap-1 mb-3">
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf.value}
                        onClick={() => setTimeframe(tf.value)}
                        className={`py-2 rounded-lg text-xs font-semibold transition ${
                          timeframe === tf.value
                            ? 'bg-indigo-500 text-white'
                            : 'bg-[#0a0a0f]/60 text-gray-400 border border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>

                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                    Trading Capital (₹)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max="100000000"
                    step="1000"
                    value={capital}
                    onChange={(e) => setCapital(Math.max(1000, parseInt(e.target.value) || 100000))}
                    className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 mb-3"
                  />

                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                    Risk per Trade (%)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.5"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                      className="flex-1 accent-indigo-500"
                    />
                    <span className="text-sm font-semibold text-white w-10 text-right">
                      {riskPercent}%
                    </span>
                  </div>

                  <label className="block text-xs font-medium text-gray-400 mt-3 mb-1.5 uppercase tracking-wide">
                    Stop Loss
                  </label>
                  <select
                    value={slType}
                    onChange={(e) => setSlType(e.target.value as typeof slType)}
                    className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    {SL_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>

                  {slType === 'FIXED_PERCENT' && (
                    <div className="mt-2 flex items-center space-x-2">
                      <input
                        type="number"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={slPercent}
                        onChange={(e) => setSlPercent(parseFloat(e.target.value))}
                        className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        placeholder="SL %"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  )}
                </div>

                {/* Target + Strategy Params */}
                <div className={strategy === 'EMA' ? 'lg:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                    Target Logic
                  </label>
                  <div className="grid grid-cols-2 gap-1 mb-3">
                    {TARGET_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTargetType(t.value)}
                        className={`py-2 rounded-lg text-xs font-medium transition ${
                          targetType === t.value
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-[#0a0a0f]/60 text-gray-400 border border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {targetType === 'RR_RATIO' && (
                    <>
                      <label className="block text-xs text-gray-500 mb-1">R:R Ratio</label>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">1 :</span>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="0.5"
                          value={rrRatio}
                          onChange={(e) => setRrRatio(parseFloat(e.target.value))}
                          className="flex-1 accent-green-500"
                        />
                        <span className="text-sm font-semibold text-green-400 w-6">{rrRatio}</span>
                      </div>
                    </>
                  )}

                  {strategy === 'EMA' && (
                    <div className="mt-3 space-y-3">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                        EMA Family Config
                      </label>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="bg-[#0a0a0f]/40 border border-gray-800/60 rounded-lg p-3 space-y-2">
                          <p className="text-xs text-gray-500">Step 1 - Timeframe & Mode</p>
                          <select value={emaMode} onChange={(e) => setEmaMode(e.target.value as typeof emaMode)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white">
                            <option value="CROSSOVER">Crossover</option>
                            <option value="PULLBACK">Pullback</option>
                            <option value="SPEED">Speed</option>
                            <option value="PULLBACK_SPEED">Pullback + Speed</option>
                          </select>
                          <div className="grid grid-cols-3 gap-2">
                            <button type="button" onClick={() => applyEmaTimeframeDefaults('INTRADAY')} className={`py-1.5 rounded text-xs ${emaTimeframeMode === 'INTRADAY' ? 'bg-indigo-500 text-white' : 'bg-[#0a0a0f]/60 text-gray-400 border border-gray-800'}`}>Intraday</button>
                            <button type="button" onClick={() => applyEmaTimeframeDefaults('SWING')} className={`py-1.5 rounded text-xs ${emaTimeframeMode === 'SWING' ? 'bg-indigo-500 text-white' : 'bg-[#0a0a0f]/60 text-gray-400 border border-gray-800'}`}>Swing</button>
                            <button type="button" onClick={() => applyEmaTimeframeDefaults('BOTH')} className={`py-1.5 rounded text-xs ${emaTimeframeMode === 'BOTH' ? 'bg-indigo-500 text-white' : 'bg-[#0a0a0f]/60 text-gray-400 border border-gray-800'}`}>Both</button>
                          </div>
                        </div>

                        <div className="bg-[#0a0a0f]/40 border border-gray-800/60 rounded-lg p-3 space-y-2">
                          <p className="text-xs text-gray-500">Step 2 - EMA Inputs</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="number" min={1} value={fastEMA} onChange={(e) => setFastEMA(parseInt(e.target.value) || 9)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-2 py-1.5 text-sm text-white" placeholder="Fast EMA" />
                            <input type="number" min={1} value={slowEMA} onChange={(e) => setSlowEMA(parseInt(e.target.value) || 21)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-2 py-1.5 text-sm text-white" placeholder="Slow EMA" />
                          </div>
                          <label className="flex items-center gap-2 text-xs text-gray-300">
                            <input type="checkbox" checked={useTripleEma} onChange={(e) => setUseTripleEma(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
                            Use Triple EMA
                          </label>
                          {useTripleEma && (
                            <input type="number" min={1} value={middleEma} onChange={(e) => setMiddleEma(parseInt(e.target.value) || 21)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-2 py-1.5 text-sm text-white" placeholder="Middle EMA" />
                          )}
                        </div>

                        <div className="bg-[#0a0a0f]/40 border border-gray-800/60 rounded-lg p-3 space-y-2 lg:col-span-2">
                          <p className="text-xs text-gray-500">Step 3 - Filter</p>
                          <select value={emaFilterType} onChange={(e) => setEmaFilterType(e.target.value as typeof emaFilterType)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white">
                            <option value="RSI">RSI</option>
                            <option value="VOLUME">Volume</option>
                            <option value="SUPPORT_RESISTANCE">Support & Resistance</option>
                            <option value="PRICE_ACTION">Price Action</option>
                          </select>

                          {emaFilterType === 'RSI' && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                              <input type="number" value={emaRsiPeriod} onChange={(e) => setEmaRsiPeriod(parseInt(e.target.value) || 14)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="RSI Period" />
                              <input type="number" value={emaRsiMidline} onChange={(e) => setEmaRsiMidline(parseInt(e.target.value) || 50)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="RSI Midline" />
                              <input type="number" value={rsiOverbought} onChange={(e) => setRsiOverbought(parseInt(e.target.value) || 70)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="RSI Overbought" />
                              <input type="number" value={rsiOversold} onChange={(e) => setRsiOversold(parseInt(e.target.value) || 30)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="RSI Oversold" />
                            </div>
                          )}

                          {emaFilterType === 'VOLUME' && (
                            <div className="grid grid-cols-2 gap-2">
                              <input type="number" value={volumeAvgPeriod} onChange={(e) => setVolumeAvgPeriod(parseInt(e.target.value) || 20)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="Volume Avg Period" />
                              <input type="number" step="0.1" value={volumeMultiplier} onChange={(e) => setVolumeMultiplier(parseFloat(e.target.value) || 1.5)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="Volume Multiplier" />
                            </div>
                          )}

                          {emaFilterType === 'SUPPORT_RESISTANCE' && (
                            <div className="grid grid-cols-2 gap-2">
                              <input type="number" value={srLookbackPeriod} onChange={(e) => setSrLookbackPeriod(parseInt(e.target.value) || 20)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="S/R Lookback" />
                              <input type="number" step="0.1" value={srBuffer} onChange={(e) => setSrBuffer(parseFloat(e.target.value) || 0.5)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="S/R Buffer %" />
                            </div>
                          )}

                          {emaFilterType === 'PRICE_ACTION' && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                                {['Engulfing', 'Hammer', 'Doji', 'MorningStar'].map((pattern) => {
                                  const typedPattern = pattern as 'Engulfing' | 'Hammer' | 'Doji' | 'MorningStar';
                                  const checked = allowedPatterns.includes(typedPattern);
                                  return (
                                    <label key={pattern} className="flex items-center gap-2 text-gray-300">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setAllowedPatterns((prev) => Array.from(new Set([...prev, typedPattern])));
                                          } else {
                                            setAllowedPatterns((prev) => prev.filter((p) => p !== typedPattern));
                                          }
                                        }}
                                        className="w-3.5 h-3.5 accent-indigo-500"
                                      />
                                      {pattern}
                                    </label>
                                  );
                                })}
                              </div>
                              <input type="number" value={candleLookback} onChange={(e) => setCandleLookback(parseInt(e.target.value) || 1)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="Candle Lookback" />
                            </div>
                          )}
                        </div>

                        <div className="bg-[#0a0a0f]/40 border border-gray-800/60 rounded-lg p-3 space-y-2 lg:col-span-2">
                          <p className="text-xs text-gray-500">Step 4 - Trade Management</p>
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                            <select value={emaSlType} onChange={(e) => setEmaSlType(e.target.value as typeof emaSlType)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white">
                              <option value="FIXED_PERCENT">Fixed Percent</option>
                              <option value="BELOW_EMA">Below EMA</option>
                              <option value="ATR_BASED">ATR Based</option>
                            </select>
                            <input type="number" step="0.1" value={emaSlValue} onChange={(e) => setEmaSlValue(parseFloat(e.target.value) || 1)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="SL Value" />
                            {emaSlType === 'ATR_BASED' && (
                              <input type="number" value={emaAtrPeriod} onChange={(e) => setEmaAtrPeriod(parseInt(e.target.value) || 14)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="ATR Period" />
                            )}
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                            <input type="number" step="0.1" value={targetRRR} onChange={(e) => setTargetRRR(parseFloat(e.target.value) || 2)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="Target RRR" />
                            <input type="number" value={maxHoldingPeriods} onChange={(e) => setMaxHoldingPeriods(parseInt(e.target.value) || 10)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded px-2 py-1 text-sm text-white" placeholder="Max Holding Bars" />
                            <select value={tradeDirection} onChange={(e) => setTradeDirection(e.target.value as typeof tradeDirection)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white">
                              <option value="BOTH">Both</option>
                              <option value="LONG_ONLY">Long Only</option>
                              <option value="SHORT_ONLY">Short Only</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {strategy === 'RSI_REVERSAL' && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                        RSI Levels
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Overbought</p>
                          <input
                            type="number"
                            min={60}
                            max={90}
                            value={rsiOverbought}
                            onChange={(e) => setRsiOverbought(parseInt(e.target.value))}
                            className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Oversold</p>
                          <input
                            type="number"
                            min={10}
                            max={40}
                            value={rsiOversold}
                            onChange={(e) => setRsiOversold(parseInt(e.target.value))}
                            className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {strategy === 'ORB' && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                        ORB Mode
                      </label>
                      <select value={orbMode} onChange={(e) => setOrbMode(e.target.value as typeof orbMode)} className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white">
                        <option value="CLASSIC">Classic</option>
                        <option value="FVG_RETEST">FVG Retest</option>
                      </select>

                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                        Replay Overlays
                      </label>
                      <div className="flex items-center space-x-3 bg-[#0a0a0f]/40 p-3 rounded-lg border border-gray-800/50">
                        <input
                          type="checkbox"
                          checked={includeOrderBlocks}
                          onChange={(e) => setIncludeOrderBlocks(e.target.checked)}
                          disabled={orbMode !== 'FVG_RETEST'}
                          className="w-4 h-4 accent-indigo-500 cursor-pointer rounded"
                        />
                        <label className="text-xs text-gray-300 cursor-pointer flex-1">
                          Show Order Blocks in Replay (FVG Retest mode)
                        </label>
                      </div>
                    </div>
                  )}

                  {strategy === 'SMC' && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                        SMC Configuration
                      </label>
                      <p className="text-xs text-gray-400">
                        Fair Value Gap + Order Block trading strategy
                      </p>
                      <div className="bg-[#0a0a0f]/40 p-3 rounded-lg border border-gray-800/50">
                        <p className="text-xs text-gray-400">
                          ✓ Detects 3-candle FVG formations<br/>
                          ✓ Waits for retracement into FVG zone<br/>
                          ✓ Enters on engulfing confirmation<br/>
                          ✓ SL just outside FVG bounds<br/>
                          ✓ Target: 3:1 Risk:Reward
                        </p>
                      </div>
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleRun}
                    disabled={isLoading}
                    className="mt-4 w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span>{isLoading ? 'Running...' : 'Run Backtest'}</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
