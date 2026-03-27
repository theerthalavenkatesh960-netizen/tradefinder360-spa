import { useEffect, useRef, useCallback, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  UTCTimestamp,
  CandlestickData,
  LineData,
  createSeriesMarkers,
  IPriceLine,
} from 'lightweight-charts';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInMinutes } from 'date-fns';
import type { Candle, Indicators, BacktestTrade } from '../../services/api';
import { formatPrice } from '../../utils/formatters';

interface TradeBox {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface TradeLane {
  id: string;
  xStart: number;
  xEnd: number;
  yEntry: number;
  yStop: number;
  yTarget: number;
  isWin: boolean;
  isSelected: boolean;
  tradeType: BacktestTrade['tradeType'];
}

interface TooltipState {
  x: number;
  y: number;
  trade: BacktestTrade;
}

interface BacktestChartProps {
  candles: Candle[];
  indicators?: Indicators[];
  trades: BacktestTrade[];
  selectedTradeId: string | null;
  hoveredTradeId: string | null;
  onTradeSelect: (id: string) => void;
  onTradeHover: (id: string | null) => void;
}

const toUTC = (d: string | number | Date): UTCTimestamp =>
  (new Date(d).getTime() / 1000) as UTCTimestamp;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const BacktestChart = ({
  candles,
  indicators = [],
  trades,
  selectedTradeId,
  hoveredTradeId,
  onTradeSelect,
  onTradeHover,
}: BacktestChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const emaFastRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSlowRef = useRef<ISeriesApi<'Line'> | null>(null);
  const activePriceLinesRef = useRef<IPriceLine[]>([]);
  const tradeBoxesRef = useRef<TradeBox[]>([]);
  const rafRef = useRef<number | null>(null);

  const tradesRef = useRef(trades);
  const selectedIdRef = useRef(selectedTradeId);
  const hoveredIdRef = useRef(hoveredTradeId);

  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { selectedIdRef.current = selectedTradeId; }, [selectedTradeId]);
  useEffect(() => { hoveredIdRef.current = hoveredTradeId; }, [hoveredTradeId]);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const drawBoxes = useCallback(() => {
    const canvas = overlayRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    const container = containerRef.current;
    if (!canvas || !chart || !series || !container) return;

    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const currentTrades = tradesRef.current;
    const selectedId = selectedIdRef.current;
    const hoveredId = hoveredIdRef.current;
    const boxes: TradeBox[] = [];
    const lanes: TradeLane[] = [];

    for (const trade of currentTrades) {
      const x1 = chart.timeScale().timeToCoordinate(toUTC(trade.entryTime));
      const x2 = chart.timeScale().timeToCoordinate(toUTC(trade.exitTime));
      const priceHigh = Math.max(trade.stopLoss, trade.target);
      const priceLow = Math.min(trade.stopLoss, trade.target);
      const y1 = series.priceToCoordinate(priceHigh);
      const y2 = series.priceToCoordinate(priceLow);

      if (x1 === null || x2 === null || y1 === null || y2 === null) continue;

      const isSelected = trade.id === selectedId;
      const isHovered = trade.id === hoveredId;
      const isWin = trade.pnl >= 0;
      const entryY = series.priceToCoordinate(trade.entryPrice);
      const slY = series.priceToCoordinate(trade.stopLoss);
      const targetY = series.priceToCoordinate(trade.target);

      const rectX = Math.min(x1, x2);
      const rectY = Math.min(y1, y2);
      const rectW = Math.max(Math.abs(x2 - x1), 2);
      const rectH = Math.max(Math.abs(y2 - y1), 2);

      boxes.push({ id: trade.id, x1: rectX, y1: rectY, x2: rectX + rectW, y2: rectY + rectH });

      if (entryY !== null && slY !== null && targetY !== null) {
        lanes.push({
          id: trade.id,
          xStart: x1,
          xEnd: x2,
          yEntry: entryY,
          yStop: slY,
          yTarget: targetY,
          isWin,
          isSelected,
          tradeType: trade.tradeType,
        });
      }

      const alpha = isSelected ? 0.18 : isHovered ? 0.1 : 0.06;
      const strokeAlpha = isSelected ? 0.8 : isHovered ? 0.6 : 0.3;

      ctx.fillStyle = isWin
        ? `rgba(34, 197, 94, ${alpha})`
        : `rgba(239, 68, 68, ${alpha})`;
      ctx.fillRect(rectX, rectY, rectW, rectH);

      ctx.strokeStyle = isWin
        ? `rgba(34, 197, 94, ${strokeAlpha})`
        : `rgba(239, 68, 68, ${strokeAlpha})`;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.strokeRect(rectX, rectY, rectW, rectH);

      if (slY !== null) {
        ctx.beginPath();
        ctx.moveTo(rectX, slY);
        ctx.lineTo(rectX + rectW, slY);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (targetY !== null) {
        ctx.beginPath();
        ctx.moveTo(rectX, targetY);
        ctx.lineTo(rectX + rectW, targetY);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw swim lanes after boxes so they stay visible on top.
    for (const lane of lanes) {
      const lineColor = lane.tradeType === 'LONG' ? 'rgba(99, 102, 241, 0.95)' : 'rgba(249, 115, 22, 0.95)';
      const direction = lane.xEnd >= lane.xStart ? 1 : -1;

      ctx.beginPath();
      ctx.moveTo(lane.xStart, lane.yEntry);
      ctx.lineTo(lane.xEnd, lane.yEntry);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lane.isSelected ? 1.8 : 1.25;
      ctx.stroke();

      const arrowSize = 6;
      ctx.beginPath();
      ctx.moveTo(lane.xEnd, lane.yEntry);
      ctx.lineTo(lane.xEnd - direction * arrowSize, lane.yEntry - arrowSize / 2);
      ctx.lineTo(lane.xEnd - direction * arrowSize, lane.yEntry + arrowSize / 2);
      ctx.closePath();
      ctx.fillStyle = lineColor;
      ctx.fill();

      const markerSize = 7;
      ctx.beginPath();
      if (lane.tradeType === 'LONG') {
        ctx.moveTo(lane.xStart, lane.yEntry - markerSize);
        ctx.lineTo(lane.xStart - markerSize * 0.7, lane.yEntry + markerSize * 0.7);
        ctx.lineTo(lane.xStart + markerSize * 0.7, lane.yEntry + markerSize * 0.7);
      } else {
        ctx.moveTo(lane.xStart, lane.yEntry + markerSize);
        ctx.lineTo(lane.xStart - markerSize * 0.7, lane.yEntry - markerSize * 0.7);
        ctx.lineTo(lane.xStart + markerSize * 0.7, lane.yEntry - markerSize * 0.7);
      }
      ctx.closePath();
      ctx.fillStyle = lane.tradeType === 'LONG' ? '#22c55e' : '#ef4444';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(lane.xEnd, lane.yEntry, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = lane.isWin ? '#22c55e' : '#ef4444';
      ctx.fill();
    }

    tradeBoxesRef.current = boxes;
    ctx.restore();
  }, []);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => drawBoxes());
  }, [trades, selectedTradeId, hoveredTradeId, drawBoxes]);

  // ─── Create chart (once) ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0a0a0f' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      width: containerRef.current.clientWidth,
      height: 520,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
      },
      rightPriceScale: { borderColor: '#374151' },
      crosshair: {
        vertLine: { color: '#6366f1', width: 1, style: 3 },
        horzLine: { color: '#6366f1', width: 1, style: 3 },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const emaFast = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      title: 'EMA F',
    });

    const emaSlow = chart.addSeries(LineSeries, {
      color: '#f97316',
      lineWidth: 1,
      title: 'EMA S',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    emaFastRef.current = emaFast;
    emaSlowRef.current = emaSlow;

    // ✅ v5 fix: store the handler and use unsubscribeVisibleLogicalRangeChange
    const handleRangeChange = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => drawBoxes());
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => drawBoxes());
      }
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const hit = tradeBoxesRef.current.find(
        (b) => mx >= b.x1 && mx <= b.x2 && my >= b.y1 && my <= b.y2
      );

      if (hit) {
        const trade = tradesRef.current.find((t) => t.id === hit.id);
        if (trade) {
          setTooltip({ x: mx, y: my, trade });
          onTradeHover(hit.id);
        }
      } else {
        setTooltip(null);
        onTradeHover(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const hit = tradeBoxesRef.current.find(
        (b) => mx >= b.x1 && mx <= b.x2 && my >= b.y1 && my <= b.y2
      );
      if (hit) onTradeSelect(hit.id);
    };

    const handleMouseLeave = () => {
      setTooltip(null);
      onTradeHover(null);
    };

    const el = containerRef.current;
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('click', handleClick);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // ✅ v5 fix: pass the same handler reference to unsubscribe
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      resizeObserver.disconnect();
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('click', handleClick);
      el.removeEventListener('mouseleave', handleMouseLeave);
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Candle data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;

    const data: CandlestickData[] = candles.map((c) => ({
      time: toUTC(c.timestamp),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // ─── EMA data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!emaFastRef.current || !emaSlowRef.current || !indicators.length) return;

    const fastData: LineData[] = indicators
      .filter((i) => i.emaFast > 0)
      .map((i) => ({ time: toUTC(i.timestamp), value: i.emaFast }));

    const slowData: LineData[] = indicators
      .filter((i) => i.emaSlow > 0)
      .map((i) => ({ time: toUTC(i.timestamp), value: i.emaSlow }));

    emaFastRef.current.setData(fastData);
    emaSlowRef.current.setData(slowData);
  }, [indicators]);

  // ─── Trade markers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const markers = trades
      .flatMap((trade) => [
        {
          time: toUTC(trade.entryTime),
          position: (trade.tradeType === 'LONG' ? 'belowBar' : 'aboveBar') as
            | 'belowBar'
            | 'aboveBar',
          color: trade.tradeType === 'LONG' ? '#22c55e' : '#ef4444',
          shape: (trade.tradeType === 'LONG' ? 'arrowUp' : 'arrowDown') as
            | 'arrowUp'
            | 'arrowDown',
          text: trade.tradeType === 'LONG' ? 'L' : 'S',
          size: trade.id === selectedTradeId ? 2 : 1,
        },
        {
          time: toUTC(trade.exitTime),
          position: (trade.tradeType === 'LONG' ? 'aboveBar' : 'belowBar') as
            | 'belowBar'
            | 'aboveBar',
          color: trade.pnl >= 0 ? '#22c55e' : '#ef4444',
          shape: 'circle' as const,
          text: '',
          size: 1,
        },
      ])
      .sort((a, b) => (a.time as number) - (b.time as number));

    createSeriesMarkers(candleSeriesRef.current, markers);
  }, [trades, selectedTradeId]);

  // ─── Selected trade: price lines + scroll ────────────────────────────────
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    activePriceLinesRef.current.forEach((line) => series.removePriceLine(line));
    activePriceLinesRef.current = [];

    if (!selectedTradeId) return;
    const trade = trades.find((t) => t.id === selectedTradeId);
    if (!trade) return;

    const entryLine = series.createPriceLine({
      price: trade.entryPrice,
      color: '#6366f1',
      lineWidth: 1.5,
      lineStyle: 0,
      axisLabelVisible: true,
      title: 'Entry',
    });

    const slLine = series.createPriceLine({
      price: trade.stopLoss,
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'SL',
    });

    const targetLine = series.createPriceLine({
      price: trade.target,
      color: '#22c55e',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'Target',
    });

    activePriceLinesRef.current = [entryLine, slLine, targetLine];

    const entryMs = new Date(trade.entryTime).getTime();
    const exitMs = new Date(trade.exitTime).getTime();
    const pad = Math.max(exitMs - entryMs, 4 * 60 * 60 * 1000);
    chartRef.current?.timeScale().setVisibleRange({
      from: ((entryMs - pad) / 1000) as UTCTimestamp,
      to: ((exitMs + pad) / 1000) as UTCTimestamp,
    });
  }, [selectedTradeId, trades]);

  const winCount = trades.filter((trade) => trade.pnl >= 0).length;
  const lossCount = trades.length - winCount;

  const tooltipLeft = tooltip
    ? clamp(tooltip.x + 14, 8, Math.max(8, (containerRef.current?.clientWidth ?? 0) - 236))
    : 0;
  const tooltipTop = tooltip
    ? clamp(tooltip.y - 10, 8, Math.max(8, (containerRef.current?.clientHeight ?? 0) - 220))
    : 0;

  return (
    <div className="relative bg-[#0a0a0f] rounded-xl overflow-hidden border border-gray-800/50">
      <div ref={containerRef} className="relative w-full" style={{ cursor: 'crosshair' }}>
        <canvas
          ref={overlayRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      </div>

      <AnimatePresence>
        {tooltip && (
          <motion.div
            key="trade-tooltip"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.1 }}
            style={{
              position: 'absolute',
              left: tooltipLeft,
              top: tooltipTop,
              zIndex: 50,
              pointerEvents: 'none',
            }}
          >
            <TradeTooltip trade={tooltip.trade} />
          </motion.div>
        )}
      </AnimatePresence>

      {trades.length > 0 && (
        <div className="absolute top-3 left-3 flex items-center space-x-3 z-20 pointer-events-none">
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-500/40 border border-green-500/60" />
            <span className="text-xs text-gray-400">Win</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-500/40 border border-red-500/60" />
            <span className="text-xs text-gray-400">Loss</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 border-t border-indigo-400/60 border-dashed" />
            <span className="text-xs text-gray-400">Entry</span>
          </div>
        </div>
      )}

      {trades.length > 0 && (
        <div className="absolute top-3 right-3 z-20 pointer-events-none rounded-full border border-gray-700/70 bg-[#12121a]/90 px-3 py-1 text-xs text-gray-200">
          {trades.length} trades | {winCount} wins | {lossCount} losses
        </div>
      )}
    </div>
  );
};

// ─── Trade Tooltip ──────────────────────────────────────────────────────────
const TradeTooltip = ({ trade }: { trade: BacktestTrade }) => {
  const isWin = trade.pnl >= 0;
  const durationMin = differenceInMinutes(
    new Date(trade.exitTime),
    new Date(trade.entryTime)
  );
  const duration =
    durationMin < 60
      ? `${durationMin}m`
      : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;

  const rrAchieved = trade.entryPrice
    ? Math.abs(trade.exitPrice - trade.entryPrice) /
      Math.abs(trade.entryPrice - trade.stopLoss)
    : 0;

  return (
    <div className="bg-[#1a1a2e]/95 backdrop-blur border border-gray-700/80 rounded-xl p-3 shadow-2xl min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded ${
            trade.tradeType === 'LONG'
              ? 'bg-green-500/20 text-green-300'
              : 'bg-red-500/20 text-red-300'
          }`}
        >
          {trade.tradeType}
        </span>
        <span className={`text-xs font-semibold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
          {isWin ? '+' : ''}{formatPrice(trade.pnl)}
        </span>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Entry</span>
          <span className="text-white">{formatPrice(trade.entryPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Exit</span>
          <span className="text-white">{formatPrice(trade.exitPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Stop Loss</span>
          <span className="text-red-400">{formatPrice(trade.stopLoss)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Target</span>
          <span className="text-green-400">{formatPrice(trade.target)}</span>
        </div>
        <div className="border-t border-gray-800 pt-1 mt-1 flex justify-between">
          <span className="text-gray-500">R:R</span>
          <span className="text-blue-300">1 : {rrAchieved.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Duration</span>
          <span className="text-gray-300">{duration}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Return</span>
          <span className={isWin ? 'text-green-400' : 'text-red-400'}>
            {trade.pnlPercent > 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
};