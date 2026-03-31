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
  { value: 'ORB', label: 'Opening Range Breakout', description: '5-min high/low breakout' },
  { value: 'RSI_REVERSAL', label: 'RSI Reversal', description: 'Overbought/oversold reversal' },
  { value: 'EMA_CROSSOVER', label: 'EMA Crossover', description: 'Fast/slow EMA cross' },
  { value: 'EMA_PULLBACK', label: 'EMA Pullback', description: 'Crossover + retest entry' },
  { value: 'SMC_FVG', label: 'SMC FVG + Order Block', description: 'Fair Value Gap with order blocks' },
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
  const [strategy, setStrategy] = useState<'ORB' | 'RSI_REVERSAL' | 'EMA_CROSSOVER' | 'EMA_PULLBACK' | 'SMC_FVG'>('ORB');
  const [from, setFrom] = useState(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
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

  const handleRun = () => {
    const request: BacktestRequest = {
      symbol,
      from,
      to,
      strategy: {
        name: strategy,
        params: {
          timeframe,
          riskPercent,
          stopLossType: slType,
          targetType,
          rrRatio: targetType === 'RR_RATIO' ? rrRatio : undefined,
          slPercent: slType === 'FIXED_PERCENT' ? slPercent : undefined,
          fastEMA: (strategy === 'EMA_CROSSOVER' || strategy === 'EMA_PULLBACK') ? fastEMA : undefined,
          slowEMA: (strategy === 'EMA_CROSSOVER' || strategy === 'EMA_PULLBACK') ? slowEMA : undefined,
          rsiOverbought: strategy === 'RSI_REVERSAL' ? rsiOverbought : undefined,
          rsiOversold: strategy === 'RSI_REVERSAL' ? rsiOversold : undefined,
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
                <div>
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

                  {(strategy === 'EMA_CROSSOVER' || strategy === 'EMA_PULLBACK') && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                        EMA Periods
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Fast</p>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={fastEMA}
                            onChange={(e) => setFastEMA(parseInt(e.target.value))}
                            className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Slow</p>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={slowEMA}
                            onChange={(e) => setSlowEMA(parseInt(e.target.value))}
                            className="w-full bg-[#0a0a0f]/60 border border-gray-800 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                          />
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
