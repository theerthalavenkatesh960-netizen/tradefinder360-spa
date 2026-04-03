import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
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
} from 'lightweight-charts';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInMinutes } from 'date-fns';
import type { Candle, Indicators, BacktestTrade } from '../../services/api';
import { formatPrice, formatUTCToIST } from '../../utils/formatters';

interface TradeBox {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface TradeHitTarget {
  id: string;
  x: number;
  y: number;
  r: number;
}

interface TradeLane {
  id: string;
  xStart: number;
  xEnd: number;
  yEntry: number;
  yStop: number;
  yTarget: number;
  isWin: boolean;
  isExited: boolean;
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
  replayNowMs?: number | null;
  replayIndex?: number;
  replayFollowEnabled?: boolean;
  isReplayPlaying?: boolean;
  onReplayPauseFromZoom?: () => void;
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
  replayNowMs = null,
  replayIndex = 0,
  replayFollowEnabled = false,
  isReplayPlaying = false,
  onReplayPauseFromZoom,
}: BacktestChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const emaFastRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSlowRef = useRef<ISeriesApi<'Line'> | null>(null);
  const tradeBoxesRef = useRef<TradeBox[]>([]);
  const tradeHitTargetsRef = useRef<TradeHitTarget[]>([]);
  const rafRef = useRef<number | null>(null);
  const mouseRafRef = useRef<number | null>(null);
  const replayCenterRafRef = useRef<number | null>(null);
  const lastHoveredIdRef = useRef<string | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const lastRangeSpanRef = useRef(120);
  const userAdjustedRangeRef = useRef(false);
  const isProgrammaticRangeChangeRef = useRef(false);

  const tradesRef = useRef(trades);
  const selectedIdRef = useRef(selectedTradeId);
  const hoveredIdRef = useRef(hoveredTradeId);
  const replayNowRef = useRef<number | null>(replayNowMs);

  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { selectedIdRef.current = selectedTradeId; }, [selectedTradeId]);
  useEffect(() => { hoveredIdRef.current = hoveredTradeId; }, [hoveredTradeId]);
  useEffect(() => { replayNowRef.current = replayNowMs; }, [replayNowMs]);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const candleSourceSignatureRef = useRef('');

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
    const hitTargets: TradeHitTarget[] = [];
    const lanes: TradeLane[] = [];

    if (replayNowRef.current !== null) {
      const replayX = chart.timeScale().timeToCoordinate((replayNowRef.current / 1000) as UTCTimestamp);
      if (replayX !== null) {
        const glowHalfWidth = 6;
        ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        ctx.fillRect(replayX - glowHalfWidth, 0, glowHalfWidth * 2, height);

        ctx.beginPath();
        ctx.moveTo(replayX, 0);
        ctx.lineTo(replayX, height);
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.65)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    for (const trade of currentTrades) {
      const replayNow = replayNowRef.current;
      const entryMs = new Date(trade.entryTime).getTime();
      const exitMs = new Date(trade.exitTime).getTime();
      const effectiveExitMs = replayNow !== null ? Math.min(exitMs, replayNow) : exitMs;
      const isExited = replayNow !== null ? replayNow >= exitMs : true;

      if (replayNow !== null && replayNow < entryMs) {
        continue;
      }

      const x1 = chart.timeScale().timeToCoordinate(toUTC(trade.entryTime));
      const x2 = chart.timeScale().timeToCoordinate((effectiveExitMs / 1000) as UTCTimestamp);
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
          isExited,
          isSelected,
          tradeType: trade.tradeType,
        });

        hitTargets.push({ id: trade.id, x: x1, y: entryY, r: 8 });
        if (isExited) {
          hitTargets.push({ id: trade.id, x: x2, y: entryY, r: 8 });
        }
      }

      const alpha = isExited ? (isSelected ? 0.18 : isHovered ? 0.1 : 0.05) : isSelected ? 0.14 : 0.06;
      const strokeAlpha = isExited ? (isSelected ? 0.8 : isHovered ? 0.6 : 0.3) : isSelected ? 0.75 : 0.45;
      // LONG = sky blue  |  SHORT = orange-amber
      const isLong = trade.tradeType === 'LONG';
      const tradeR = isLong ? '14, 165, 233' : '249, 115, 22';

      ctx.fillStyle = `rgba(${tradeR}, ${alpha})`;
      ctx.fillRect(rectX, rectY, rectW, rectH);

      ctx.strokeStyle = `rgba(${tradeR}, ${strokeAlpha})`;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.strokeRect(rectX, rectY, rectW, rectH);

      if (isSelected || isHovered) {
        const tradeWidth = Math.max(Math.abs(x2 - x1), 2);
        const tradeStart = Math.min(x1, x2);
        const profitY = series.priceToCoordinate(trade.target);
        const stopY = series.priceToCoordinate(trade.stopLoss);
        const entryBandY = series.priceToCoordinate(trade.entryPrice);

        if (profitY !== null && stopY !== null && entryBandY !== null) {
          const upperProfit = Math.min(entryBandY, profitY);
          const profitHeight = Math.max(Math.abs(entryBandY - profitY), 1);
          const upperRisk = Math.min(entryBandY, stopY);
          const riskHeight = Math.max(Math.abs(entryBandY - stopY), 1);

          const profitTint = isWin ? 'rgba(34, 197, 94, 0.18)' : 'rgba(34, 197, 94, 0.08)';
          const riskTint = isWin ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.18)';

          ctx.fillStyle = profitTint;
          ctx.fillRect(tradeStart, upperProfit, tradeWidth, profitHeight);
          ctx.fillStyle = riskTint;
          ctx.fillRect(tradeStart, upperRisk, tradeWidth, riskHeight);
        }
      }

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
      // LONG = sky blue, SHORT = orange-amber — matches box colour scheme
      const lineColor = lane.tradeType === 'LONG' ? 'rgba(14, 165, 233, 0.95)' : 'rgba(249, 115, 22, 0.95)';
      const direction = lane.xEnd >= lane.xStart ? 1 : -1;

      ctx.beginPath();
      ctx.moveTo(lane.xStart, lane.yEntry);
      ctx.lineTo(lane.xEnd, lane.yEntry);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lane.isSelected ? 1.6 : 1.15;
      ctx.stroke();

      const arrowSize = 5;
      ctx.beginPath();
      ctx.moveTo(lane.xEnd, lane.yEntry);
      ctx.lineTo(lane.xEnd - direction * arrowSize, lane.yEntry - arrowSize / 2);
      ctx.lineTo(lane.xEnd - direction * arrowSize, lane.yEntry + arrowSize / 2);
      ctx.closePath();
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(10, 10, 15, 0.95)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const markerSize = 5.5;
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
      // Entry triangle: sky blue for LONG, orange-amber for SHORT
      ctx.fillStyle = lane.tradeType === 'LONG' ? '#38bdf8' : '#fb923c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(10, 10, 15, 0.9)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (lane.isExited) {
        ctx.beginPath();
        ctx.arc(lane.xEnd, lane.yEntry, 3.4, 0, Math.PI * 2);
        // Exit dot: green = win, rose-red = loss — outcome at a glance
        ctx.fillStyle = lane.isWin ? '#4ade80' : '#f87171';
        ctx.fill();
        ctx.strokeStyle = 'rgba(10, 10, 15, 0.95)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    tradeBoxesRef.current = boxes;
    tradeHitTargetsRef.current = hitTargets;
    ctx.restore();
  }, []);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => drawBoxes());
  }, [trades, selectedTradeId, hoveredTradeId, replayNowMs, drawBoxes]);

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
      localization: {
        timeFormatter: (utcTimestamp: number) => formatUTCToIST(utcTimestamp),
      } as any,
      crosshair: {
        vertLine: { color: '#6366f1', width: 1, style: 3 },
        horzLine: { color: '#6366f1', width: 1, style: 3 },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#86efac',
      downColor: '#fda4af',
      borderUpColor: '#4ade80',
      borderDownColor: '#fb7185',
      wickUpColor: '#bbf7d0',
      wickDownColor: '#fecdd3',
    });

    const emaFast = chart.addSeries(LineSeries, {
      color: 'rgba(147, 197, 253, 0.95)',
      lineWidth: 1,
      title: 'EMA F',
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const emaSlow = chart.addSeries(LineSeries, {
      color: 'rgba(251, 191, 110, 0.92)',
      lineWidth: 1,
      title: 'EMA S',
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    emaFastRef.current = emaFast;
    emaSlowRef.current = emaSlow;

    // ✅ v5 fix: store the handler and use unsubscribeVisibleLogicalRangeChange
    const handleRangeChange = () => {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) {
        const span = Math.max(30, range.to - range.from);
        const previousSpan = lastRangeSpanRef.current;
        lastRangeSpanRef.current = span;

        if (isProgrammaticRangeChangeRef.current) {
          isProgrammaticRangeChangeRef.current = false;
        } else {
          userAdjustedRangeRef.current = true;
          const spanDelta = Math.abs(span - previousSpan);
          if (spanDelta > 0.5 && replayNowRef.current !== null && isReplayPlaying) {
            onReplayPauseFromZoom?.();
          }
        }
      }
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

    const processPointer = () => {
      mouseRafRef.current = null;
      const point = latestPointerRef.current;
      if (!point) return;
      const mx = point.x;
      const my = point.y;

      const markerHit = tradeHitTargetsRef.current.find((h) => {
        const dx = mx - h.x;
        const dy = my - h.y;
        return dx * dx + dy * dy <= h.r * h.r;
      });

      const boxHit = tradeBoxesRef.current.find(
        (b) => mx >= b.x1 && mx <= b.x2 && my >= b.y1 && my <= b.y2
      );

      const hitId = markerHit?.id ?? boxHit?.id ?? null;

      if (hitId) {
        const trade = tradesRef.current.find((t) => t.id === hitId);
        if (trade) {
          setTooltip({ x: mx, y: my, trade });
          if (lastHoveredIdRef.current !== hitId) {
            lastHoveredIdRef.current = hitId;
            onTradeHover(hitId);
          }
          return;
        }
      }

      setTooltip(null);
      if (lastHoveredIdRef.current !== null) {
        lastHoveredIdRef.current = null;
        onTradeHover(null);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      latestPointerRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      if (mouseRafRef.current === null) {
        mouseRafRef.current = requestAnimationFrame(processPointer);
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
      latestPointerRef.current = null;
      if (mouseRafRef.current !== null) {
        cancelAnimationFrame(mouseRafRef.current);
        mouseRafRef.current = null;
      }
      if (lastHoveredIdRef.current !== null) {
        lastHoveredIdRef.current = null;
        onTradeHover(null);
      }
    };

    const el = containerRef.current;
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('click', handleClick);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mouseRafRef.current !== null) cancelAnimationFrame(mouseRafRef.current);
      if (replayCenterRafRef.current !== null) cancelAnimationFrame(replayCenterRafRef.current);
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

  const styledCandles = useMemo(() => {
    if (!candles.length) return [] as CandlestickData[];

    const replayCutoff = replayNowMs ?? Number.POSITIVE_INFINITY;

    return candles.map((candle) => {
      const time = toUTC(candle.timestamp);
      const isUp = candle.close >= candle.open;
      const isRevealed = new Date(candle.timestamp).getTime() <= replayCutoff;

      if (isRevealed) {
        return {
          time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          color: isUp ? '#22c55e' : '#ef4444',
          borderColor: isUp ? '#4ade80' : '#f87171',
          wickColor: isUp ? '#86efac' : '#fca5a5',
        };
      }

      return {
        time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        color: isUp ? 'rgba(75, 85, 99, 0.33)' : 'rgba(71, 85, 105, 0.33)',
        borderColor: isUp ? 'rgba(107, 114, 128, 0.48)' : 'rgba(107, 114, 128, 0.48)',
        wickColor: isUp ? 'rgba(107, 114, 128, 0.4)' : 'rgba(107, 114, 128, 0.4)',
      };
    });
  }, [candles, replayNowMs]);

  // ─── Candle data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current || !styledCandles.length) return;

    candleSeriesRef.current.setData(styledCandles);

    const sourceSignature = `${candles.length}:${candles[0]?.timestamp ?? ''}:${candles[candles.length - 1]?.timestamp ?? ''}`;
    const isNewSource = candleSourceSignatureRef.current !== sourceSignature;
    if (isNewSource) {
      candleSourceSignatureRef.current = sourceSignature;
    }

    if (isNewSource && !userAdjustedRangeRef.current) {
      chartRef.current?.timeScale().fitContent();
      const range = chartRef.current?.timeScale().getVisibleLogicalRange();
      if (range) {
        lastRangeSpanRef.current = Math.max(30, range.to - range.from);
      }
    }
  }, [candles, styledCandles]);

  // ─── EMA data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!emaFastRef.current || !emaSlowRef.current || !indicators.length) return;

    const dedup = (data: LineData[]) => {
      const seen = new Map<number, LineData>();
      for (const d of data) seen.set(d.time as number, d);
      return Array.from(seen.values()).sort((a, b) => (a.time as number) - (b.time as number));
    };

    const fastData = dedup(
      indicators.filter((i) => i.emaFast > 0).map((i) => ({ time: toUTC(i.timestamp), value: i.emaFast }))
    );
    const slowData = dedup(
      indicators.filter((i) => i.emaSlow > 0).map((i) => ({ time: toUTC(i.timestamp), value: i.emaSlow }))
    );

    emaFastRef.current.setData(fastData);
    emaSlowRef.current.setData(slowData);
  }, [indicators]);

  // ─── Trade markers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const markers = trades
      .flatMap((trade) => {
        const replayNow = replayNowMs;
        const entryMs = new Date(trade.entryTime).getTime();
        const exitMs = new Date(trade.exitTime).getTime();
        const hasEntered = replayNow === null || replayNow >= entryMs;
        const hasExited = replayNow === null || replayNow >= exitMs;

        if (!hasEntered) {
          return [];
        }

        const entryMarker = {
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
        };

        if (!hasExited) {
          return [entryMarker];
        }

        const exitMarker = {
          time: toUTC(trade.exitTime),
          position: (trade.tradeType === 'LONG' ? 'aboveBar' : 'belowBar') as
            | 'belowBar'
            | 'aboveBar',
          color: trade.pnl >= 0 ? '#22c55e' : '#ef4444',
          shape: 'circle' as const,
          text: '',
          size: 1,
        };

        return [entryMarker, exitMarker];
      })
      .sort((a, b) => (a.time as number) - (b.time as number));

    createSeriesMarkers(candleSeriesRef.current, markers);
  }, [trades, selectedTradeId, replayNowMs]);

  // ─── Selected trade: scroll only ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedTradeId) return;
    const trade = trades.find((t) => t.id === selectedTradeId);
    if (!trade) return;

    const entryMs = new Date(trade.entryTime).getTime();
    const exitMs = new Date(trade.exitTime).getTime();
    const pad = Math.max(exitMs - entryMs, 4 * 60 * 60 * 1000);
    isProgrammaticRangeChangeRef.current = true;
    chartRef.current?.timeScale().setVisibleRange({
      from: ((entryMs - pad) / 1000) as UTCTimestamp,
      to: ((exitMs + pad) / 1000) as UTCTimestamp,
    });
  }, [selectedTradeId, trades]);

  useEffect(() => {
    if (!replayFollowEnabled || replayNowMs === null || !candles.length || !chartRef.current) return;

    const chart = chartRef.current;
    const clampedIndex = clamp(replayIndex, 0, candles.length - 1);

    if (replayCenterRafRef.current !== null) {
      cancelAnimationFrame(replayCenterRafRef.current);
    }

    replayCenterRafRef.current = requestAnimationFrame(() => {
      const span = Math.max(20, lastRangeSpanRef.current);
      const leftRatio = 0.5;
      isProgrammaticRangeChangeRef.current = true;
      chart.timeScale().setVisibleLogicalRange({
        from: clampedIndex - span * leftRatio,
        to: clampedIndex + span * (1 - leftRatio),
      });
    });
  }, [replayFollowEnabled, replayNowMs, replayIndex, candles.length]);

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