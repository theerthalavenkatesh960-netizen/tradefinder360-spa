import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react';
import type { BacktestTrade } from '../../services/api';
import { formatPrice } from '../../utils/formatters';

interface TradeListPanelProps {
  trades: BacktestTrade[];
  selectedTradeId: string | null;
  hoveredTradeId: string | null;
  onSelectTrade: (id: string) => void;
  onHoverTrade: (id: string | null) => void;
}

type SortKey = 'date' | 'pnl' | 'pnlPct';
type Filter = 'all' | 'win' | 'loss' | 'long' | 'short';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Win', value: 'win' },
  { label: 'Loss', value: 'loss' },
  { label: 'Long', value: 'long' },
  { label: 'Short', value: 'short' },
];

export const TradeListPanel = ({
  trades,
  selectedTradeId,
  hoveredTradeId,
  onSelectTrade,
  onHoverTrade,
}: TradeListPanelProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const selectedRowRef = useRef<HTMLDivElement>(null);

  const displayedTrades = useMemo(() => {
    let filtered = trades;
    if (activeFilter === 'win') filtered = trades.filter((t) => t.pnl >= 0);
    if (activeFilter === 'loss') filtered = trades.filter((t) => t.pnl < 0);
    if (activeFilter === 'long') filtered = trades.filter((t) => t.tradeType === 'LONG');
    if (activeFilter === 'short') filtered = trades.filter((t) => t.tradeType === 'SHORT');

    return [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortKey === 'date') diff = new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime();
      if (sortKey === 'pnl') diff = a.pnl - b.pnl;
      if (sortKey === 'pnlPct') diff = a.pnlPercent - b.pnlPercent;
      return sortAsc ? diff : -diff;
    });
  }, [trades, sortKey, sortAsc, activeFilter]);

  // Scroll selected row into view
  useEffect(() => {
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedTradeId]);

  useEffect(() => {
    const handleKeyNavigation = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (!displayedTrades.length) return;

      event.preventDefault();

      const currentIndex = displayedTrades.findIndex((trade) => trade.id === selectedTradeId);
      const nextIndex =
        currentIndex === -1
          ? 0
          : event.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, displayedTrades.length - 1)
          : Math.max(currentIndex - 1, 0);

      const nextTrade = displayedTrades[nextIndex];
      if (nextTrade) {
        onSelectTrade(nextTrade.id);
      }
    };

    window.addEventListener('keydown', handleKeyNavigation);
    return () => window.removeEventListener('keydown', handleKeyNavigation);
  }, [displayedTrades, onSelectTrade, selectedTradeId]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ field }: { field: SortKey }) =>
    sortKey === field ? (
      sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
    ) : (
      <div className="w-3 h-3" />
    );

  const winCount = trades.filter((t) => t.pnl >= 0).length;
  const lossCount = trades.filter((t) => t.pnl < 0).length;
  const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const bestTrade = trades.length ? Math.max(...trades.map((trade) => trade.pnl)) : 0;
  const worstTrade = trades.length ? Math.min(...trades.map((trade) => trade.pnl)) : 0;

  return (
    <div className="flex flex-col h-full bg-[#12121a]/60 border border-gray-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">Trades</h3>
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-green-400">{winCount}W</span>
            <span className="text-gray-600">/</span>
            <span className="text-red-400">{lossCount}L</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          <span className={`text-[11px] px-2 py-1 rounded-full border ${totalPnl >= 0 ? 'text-green-300 bg-green-500/10 border-green-500/30' : 'text-red-300 bg-red-500/10 border-red-500/30'}`}>
            Total PnL: {formatPrice(totalPnl)}
          </span>
          <span className="text-[11px] px-2 py-1 rounded-full border text-green-300 bg-green-500/10 border-green-500/30">
            Best: {formatPrice(bestTrade)}
          </span>
          <span className="text-[11px] px-2 py-1 rounded-full border text-red-300 bg-red-500/10 border-red-500/30">
            Worst: {formatPrice(worstTrade)}
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-1">
          <Filter className="w-3 h-3 text-gray-500 flex-shrink-0" />
          <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium transition ${
                  activeFilter === f.value
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-1 px-3 py-2 border-b border-gray-800/30 bg-[#0a0a0f]/30 flex-shrink-0">
        <button
          onClick={() => toggleSort('date')}
          className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-300 transition text-left"
        >
          <span>Date / Type</span>
          <SortIcon field="date" />
        </button>
        <button
          onClick={() => toggleSort('pnl')}
          className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-300 transition text-right"
        >
          <span>PnL</span>
          <SortIcon field="pnl" />
        </button>
        <button
          onClick={() => toggleSort('pnlPct')}
          className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-300 transition text-right"
        >
          <span>%</span>
          <SortIcon field="pnlPct" />
        </button>
      </div>

      {/* Trade Rows */}
      {displayedTrades.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          No trades match filter
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence initial={false}>
            {displayedTrades.map((trade, i) => {
              const isSelected = trade.id === selectedTradeId;
              const isHovered = trade.id === hoveredTradeId;
              const isWin = trade.pnl >= 0;
              const entryDate = format(new Date(trade.entryTime), 'dd MMM yy');
              const entryTime = format(new Date(trade.entryTime), 'HH:mm');

              return (
                <motion.div
                  key={trade.id}
                  ref={isSelected ? selectedRowRef : undefined}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  onClick={() => onSelectTrade(trade.id)}
                  onMouseEnter={() => onHoverTrade(trade.id)}
                  onMouseLeave={() => onHoverTrade(null)}
                  className={`px-3 py-2.5 border-b border-gray-800/20 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500'
                      : isHovered
                      ? 'bg-white/5'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="grid grid-cols-[1fr_auto_auto] gap-1 items-center">
                    {/* Left: date + type */}
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        {trade.tradeType === 'LONG' ? (
                          <ArrowUpCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        ) : (
                          <ArrowDownCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        )}
                        <span
                          className={`text-xs font-semibold ${
                            trade.tradeType === 'LONG' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {trade.tradeType}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {entryDate}{' '}
                        <span className="text-gray-600">{entryTime}</span>
                      </p>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          E: <span className="text-gray-300">{formatPrice(trade.entryPrice)}</span>
                        </span>
                        <span className="text-xs text-gray-500">
                          X: <span className="text-gray-300">{formatPrice(trade.exitPrice)}</span>
                        </span>
                      </div>
                    </div>

                    {/* PnL */}
                    <div className="text-right">
                      <p className={`text-xs font-semibold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                        {isWin ? '+' : ''}{formatPrice(trade.pnl)}
                      </p>
                    </div>

                    {/* PnL % */}
                    <div className="text-right">
                      <p className={`text-xs font-medium ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                        {isWin ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {/* Expanded detail on selection */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 pt-2 border-t border-gray-800/30 grid grid-cols-3 gap-1 text-xs"
                      >
                        <div>
                          <p className="text-gray-500">SL</p>
                          <p className="text-red-400 font-medium">{formatPrice(trade.stopLoss)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Target</p>
                          <p className="text-green-400 font-medium">{formatPrice(trade.target)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Qty</p>
                          <p className="text-white font-medium">{trade.quantity}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
