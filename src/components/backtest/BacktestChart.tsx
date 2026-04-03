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
import { differenceInMinutes, format } from 'date-fns';
import type { Candle, Indicators, BacktestTrade, BacktestAnnotations } from '../../services/api';
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

type StepState = 'done' | 'active' | 'pending';

interface ReplayStep {
  key: string;
  label: string;
  state: StepState;
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
  strategy?: string;
  annotations?: BacktestAnnotations;
}


const toUTC = (d: string | number | Date): UTCTimestamp =>
  (new Date(d).getTime() / 1000) as UTCTimestamp;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toIstDayKey = (value: string | number | Date): string => {
  const ms = new Date(value).getTime();
  const istMs = ms + 5.5 * 60 * 60 * 1000;
  const d = new Date(istMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

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
  strategy,
  annotations,
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
  const candlesRef = useRef(candles);
  const strategyRef = useRef(strategy);
  const annotationsRef = useRef(annotations);

  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { selectedIdRef.current = selectedTradeId; }, [selectedTradeId]);
  useEffect(() => { hoveredIdRef.current = hoveredTradeId; }, [hoveredTradeId]);
  useEffect(() => { replayNowRef.current = replayNowMs; }, [replayNowMs]);
  useEffect(() => { candlesRef.current = candles; }, [candles]);
  useEffect(() => { strategyRef.current = strategy; }, [strategy]);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
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

    // ─── Render ORB/FVG/OB annotations for ORB_FVG_RETEST strategy ───────────
    const currentStrategy = strategyRef.current;
    const currentAnnotations = annotationsRef.current;
    const currentCandles = candlesRef.current;
    const currentReplayNow = replayNowRef.current;

    const drawBadge = (x: number, y: number, text: string, bg: string, fg: string) => {
      const padX = 6;
      const h = 16;
      ctx.font = '10px sans-serif';
      const w = ctx.measureText(text).width + padX * 2;
      const left = x - w / 2;
      const top = y - h / 2;
      const r = 4;

      ctx.beginPath();
      ctx.moveTo(left + r, top);
      ctx.lineTo(left + w - r, top);
      ctx.quadraticCurveTo(left + w, top, left + w, top + r);
      ctx.lineTo(left + w, top + h - r);
      ctx.quadraticCurveTo(left + w, top + h, left + w - r, top + h);
      ctx.lineTo(left + r, top + h);
      ctx.quadraticCurveTo(left, top + h, left, top + h - r);
      ctx.lineTo(left, top + r);
      ctx.quadraticCurveTo(left, top, left + r, top);
      ctx.closePath();
      ctx.fillStyle = bg;
      ctx.fill();

      ctx.fillStyle = fg;
      ctx.fillText(text, left + padX, top + 11);
    };

    if (currentStrategy === 'ORB_FVG_RETEST' && currentAnnotations) {
      const timeScale = chart.timeScale();

      // series.priceToCoordinate is the correct lightweight-charts v4 API
      const getPriceY = (price: number) => series.priceToCoordinate(price) ?? height / 2;
      // Map candle index to UTC timestamp then to screen X
      const getCandleX = (idx: number): number => {
        const c = currentCandles?.[idx];
        if (!c) return 0;
        const utc = (typeof c.timestamp === 'number' ? c.timestamp : new Date(c.timestamp).getTime() / 1000) as UTCTimestamp;
        return timeScale.timeToCoordinate(utc) ?? 0;
      };

      // Determine the last candle index visible in replay so we can hide future annotations
      const replayCandleIdx = currentReplayNow
        ? (currentCandles ?? []).reduce((last, c, i) => {
            const ts = typeof c.timestamp === 'number' ? c.timestamp * 1000 : new Date(c.timestamp).getTime();
            return ts <= currentReplayNow ? i : last;
          }, -1)
        : Number.MAX_SAFE_INTEGER;

      // Very light vertical divider at each IST day start.
      // Keep it subtle so it helps orientation without cluttering the replay.
      if (currentCandles && currentCandles.length > 0) {
        let prevDayKey: string | null = null;
        const maxIdx = Math.min(replayCandleIdx, currentCandles.length - 1);

        for (let i = 0; i <= maxIdx; i++) {
          const c = currentCandles[i];
          const dayKey = toIstDayKey(c.timestamp as any);
          const isDayStart = dayKey !== prevDayKey;
          prevDayKey = dayKey;

          if (!isDayStart) continue;

          const x = getCandleX(i);
          if (x <= 0) continue;

          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // ── 1. ORB range lines — one pair per trading day ─────────────────────
      if (currentAnnotations.orbZones && currentAnnotations.orbZones.length > 0) {
        currentAnnotations.orbZones.forEach((orb) => {
          const { orbStartIdx, orbEndIdx, orbHigh, orbLow, tradeNotTakenReason } = orb;
          if (orbStartIdx > replayCandleIdx) return;   // not yet reached in replay
          if (orbHigh <= 0 || orbLow <= 0) return;

          const x1 = getCandleX(orbStartIdx);
          // Clamp end to replay cursor so lines never peek into the future.
          // orbEndIdx is day-bounded from backend, so lines never bleed into next day.
          const clampedEnd = Math.min(orbEndIdx, replayCandleIdx);
          const x2 = getCandleX(clampedEnd);
          const y1 = getPriceY(orbHigh);
          const y2 = getPriceY(orbLow);

          // Two horizontal range lines for the day.
          const borderColor = tradeNotTakenReason
            ? 'rgba(251, 191, 36, 0.45)'
            : 'rgba(99, 102, 241, 0.6)';
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1.7;
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x1, y2); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.setLineDash([]);

          // Labels for top and bottom range values.
          ctx.fillStyle = borderColor.replace('0.45', '0.85').replace('0.6', '0.9');
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(`ORB H ${orbHigh.toFixed(2)}`, x1 + 4, y1 - 4);
          ctx.fillText(`ORB L ${orbLow.toFixed(2)}`, x1 + 4, y2 + 12);

          // End-of-day reason label when replay has reached this day close.
          if (tradeNotTakenReason && clampedEnd === orbEndIdx) {
            const labelX = x2 + 4;
            const labelY = (y1 + y2) / 2 + 4;
            ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
            ctx.font = '9px sans-serif';
            ctx.fillText(`✗ ${tradeNotTakenReason}`, labelX, labelY);
          }
        });
      }

      // ── 2. FVG zones ───────────────────────────────────────────────────────
      if (currentAnnotations.fvgZones && currentAnnotations.fvgZones.length > 0) {
        currentAnnotations.fvgZones.forEach((fvg, idx) => {
          const { fvgStartIdx, fvgEndIdx, fvgHigh, fvgLow, direction } = fvg;
          if (fvgStartIdx > replayCandleIdx) return;
          if (fvgHigh <= 0 || fvgLow <= 0) return;

          const x1 = getCandleX(fvgStartIdx);
          const x2 = getCandleX(Math.min(fvgEndIdx, replayCandleIdx));
          const y1 = getPriceY(fvgHigh);
          const y2 = getPriceY(fvgLow);
          const yTop = Math.min(y1, y2);
          const boxH = Math.abs(y2 - y1);

          const isBullish = direction === 'BULLISH';
          ctx.fillStyle = isBullish
            ? 'rgba(51, 214, 166, 0.06)'   // teal for bullish
            : 'rgba(251, 113, 133, 0.06)';  // rose for bearish
          ctx.fillRect(x1, yTop, x2 - x1, boxH);

          const borderCol = isBullish
            ? 'rgba(51, 214, 166, 0.5)'
            : 'rgba(251, 113, 133, 0.5)';
          ctx.strokeStyle = borderCol;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.strokeRect(x1, yTop, x2 - x1, boxH);
          ctx.setLineDash([]);

          ctx.fillStyle = borderCol.replace('0.5', '0.85');
          ctx.font = '9px sans-serif';
          ctx.fillText(`FVG${idx + 1} ${isBullish ? '▲' : '▼'}`, x1 + 3, yTop + 11);
        });
      }

      // ── 3. Order Block zones ───────────────────────────────────────────────
      if (currentAnnotations.obZones && currentAnnotations.obZones.length > 0) {
        currentAnnotations.obZones.forEach((ob, idx) => {
          const { obStartIdx, obEndIdx, obHigh, obLow } = ob;
          if (obStartIdx > replayCandleIdx) return;
          if (obHigh <= 0 || obLow <= 0) return;

          const x1 = getCandleX(obStartIdx);
          const x2 = getCandleX(Math.min(obEndIdx, replayCandleIdx));
          const y1 = getPriceY(obHigh);
          const y2 = getPriceY(obLow);
          const yTop = Math.min(y1, y2);
          const boxH = Math.abs(y2 - y1);

          ctx.fillStyle = 'rgba(34, 197, 94, 0.05)';
          ctx.fillRect(x1, yTop, x2 - x1, boxH);
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
          ctx.lineWidth = 1;
          ctx.setLineDash([1, 2]);
          ctx.strokeRect(x1, yTop, x2 - x1, boxH);
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(34, 197, 94, 0.75)';
          ctx.font = '9px sans-serif';
          ctx.fillText(`OB${idx + 1}`, x1 + 3, yTop + 11);
        });
      }

      // ── 4. Signal event markers from events[] ─────────────────────────────
      if (currentAnnotations.events && currentAnnotations.events.length > 0) {
        currentAnnotations.events.forEach((ev) => {
          const evTs = new Date(ev.timestamp).getTime();
          if (evTs > (currentReplayNow ?? Number.MAX_SAFE_INTEGER)) return;

          const evIdx = (currentCandles ?? []).findIndex((c) => {
            const ts = typeof c.timestamp === 'number' ? c.timestamp * 1000 : new Date(c.timestamp).getTime();
            return Math.abs(ts - evTs) < 60_000;
          });
          if (evIdx < 0 || evIdx > replayCandleIdx) return;

          const x = getCandleX(evIdx);
          const c = currentCandles?.[evIdx] as any;

          switch (ev.eventType) {
            case 'BREAKOUT': {
              const y = getPriceY(c?.high ?? 0);
              ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
              ctx.beginPath();
              ctx.moveTo(x, y - 14); ctx.lineTo(x - 5, y - 6); ctx.lineTo(x + 5, y - 6);
              ctx.closePath(); ctx.fill();
              ctx.fillStyle = 'rgba(99, 102, 241, 0.85)';
              ctx.font = '9px sans-serif';
              ctx.fillText('BO', x - 6, y - 16);
              break;
            }
            case 'FVG_FORMED': {
              const y = getPriceY(c?.high ?? 0);
              ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
              ctx.beginPath();
              ctx.arc(x, y - 8, 4, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'rgba(168, 85, 247, 0.85)';
              ctx.font = '9px sans-serif';
              ctx.fillText('FVG', x - 8, y - 14);
              break;
            }
            case 'RETEST': {
              const y = getPriceY(c?.low ?? 0);
              ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)';
              ctx.lineWidth = 1;
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.moveTo(x, y - 26);
              ctx.lineTo(x, y + 10);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.fillStyle = 'rgba(251, 146, 60, 0.92)';
              ctx.beginPath();
              ctx.arc(x, y + 10, 4.5, 0, Math.PI * 2);
              ctx.fill();

              drawBadge(x, y - 34, 'Retested', 'rgba(251, 146, 60, 0.9)', '#111827');
              break;
            }
            case 'ENGULF_CONFIRMED': {
              const y = getPriceY(c?.close ?? 0);
              ctx.fillStyle = 'rgba(52, 211, 153, 0.9)';
              ctx.beginPath();
              ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = 'rgba(10, 10, 15, 0.9)';
              ctx.lineWidth = 1.2; ctx.stroke();
              ctx.fillStyle = 'rgba(52, 211, 153, 0.85)';
              ctx.font = '9px sans-serif';
              ctx.fillText('ENG', x - 8, y - 10);
              break;
            }
            case 'ENTRY': {
              const y = getPriceY(c?.open ?? 0);
              ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
              ctx.beginPath();
              ctx.moveTo(x, y - 10); ctx.lineTo(x - 6, y); ctx.lineTo(x + 6, y);
              ctx.closePath(); ctx.fill();
              ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
              ctx.font = 'bold 9px sans-serif';
              ctx.fillText('IN', x - 5, y - 12);
              break;
            }
            case 'TRADE_NOT_TAKEN': {
              const y = getPriceY(c?.close ?? 0);
              ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
              ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke();
              break;
            }
            case 'CONFLUENCE_FAIL': {
              const y = getPriceY(c?.close ?? 0);
              ctx.fillStyle = 'rgba(234, 88, 12, 0.85)';
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'rgba(234, 88, 12, 0.9)';
              ctx.font = '8px sans-serif';
              ctx.fillText('CF', x - 6, y + 12);
              break;
            }
            case 'VOLUME_FAIL': {
              const y = getPriceY(c?.close ?? 0);
              ctx.fillStyle = 'rgba(153, 27, 27, 0.85)';
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'rgba(153, 27, 27, 0.9)';
              ctx.font = '8px sans-serif';
              ctx.fillText('VF', x - 6, y + 12);
              break;
            }
            case 'ENGULF_FAIL': {
              const y = getPriceY(c?.close ?? 0);
              ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
              ctx.beginPath();
              ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
              ctx.lineWidth = 1;
              ctx.stroke();
              break;
            }
            case 'RETEST_CONTINUED': {
              const y = getPriceY(c?.close ?? 0);
              ctx.fillStyle = 'rgba(251, 146, 60, 0.7)';
              ctx.beginPath();
              ctx.arc(x, y + 8, 3, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'rgba(251, 146, 60, 0.85)';
              ctx.font = '8px sans-serif';
              ctx.fillText('RC', x - 5, y + 18);
              break;
            }
            case 'PHASE_BACK_TO_RETEST': {
              const y = getPriceY(c?.close ?? 0);
              ctx.fillStyle = 'rgba(59, 130, 246, 0.7)';
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'rgba(59, 130, 246, 0.85)';
              ctx.font = '8px sans-serif';
              ctx.fillText('BK', x - 5, y - 12);
              break;
            }
            case 'RR_FAILED': {
              const y = getPriceY(c?.close ?? 0);
              ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
              ctx.beginPath();
              ctx.moveTo(x - 4, y - 2);
              ctx.lineTo(x + 4, y - 2);
              ctx.lineTo(x, y + 4);
              ctx.closePath(); ctx.fill();
              ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
              ctx.font = '8px sans-serif';
              ctx.fillText('RR', x - 6, y - 6);
              break;
            }
            case 'DRAWDOWN_HALT': {
              const y = getPriceY(c?.close ?? 0);
              ctx.fillStyle = 'rgba(127, 29, 29, 0.85)';
              ctx.beginPath();
              ctx.moveTo(x, y - 5);
              ctx.lineTo(x - 4, y + 3);
              ctx.lineTo(x + 4, y + 3);
              ctx.closePath(); ctx.fill();
              ctx.fillStyle = 'rgba(127, 29, 29, 0.9)';
              ctx.font = '8px sans-serif';
              ctx.fillText('DH', x - 6, y - 8);
              break;
            }
            case 'QTY_FAILED':
            case 'QTY_FINAL_FAIL': {
              const y = getPriceY(c?.close ?? 0);
              ctx.fillStyle = 'rgba(202, 138, 4, 0.8)';
              ctx.beginPath();
              ctx.moveTo(x - 3, y - 4);
              ctx.lineTo(x + 3, y - 4);
              ctx.lineTo(x + 3, y + 4);
              ctx.lineTo(x - 3, y + 4);
              ctx.closePath(); ctx.fill();
              ctx.fillStyle = 'rgba(202, 138, 4, 0.9)';
              ctx.font = '8px sans-serif';
              ctx.fillText('QF', x - 5, y + 10);
              break;
            }
            case 'QTY_CAPPED': {
              const y = getPriceY(c?.close ?? 0);
              ctx.fillStyle = 'rgba(180, 83, 9, 0.7)';
              ctx.beginPath();
              ctx.moveTo(x - 3, y - 4);
              ctx.lineTo(x + 3, y - 4);
              ctx.lineTo(x + 3, y + 4);
              ctx.lineTo(x - 3, y + 4);
              ctx.closePath(); ctx.fill();
              ctx.strokeStyle = 'rgba(180, 83, 9, 0.85)';
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.fillStyle = 'rgba(180, 83, 9, 0.9)';
              ctx.font = '8px sans-serif';
              ctx.fillText('QC', x - 5, y + 10);
              break;
            }
          }
        });
      }
    }

    ctx.restore();
  }, []);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => drawBoxes());
  }, [trades, selectedTradeId, hoveredTradeId, replayNowMs, strategy, annotations, drawBoxes]);

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
  // Hide EMA lines for ORB_FVG_RETEST strategy; show for all others
  useEffect(() => {
    const isOrbFvgRetest = strategy === 'ORB_FVG_RETEST';
    if (isOrbFvgRetest || !emaFastRef.current || !emaSlowRef.current || !indicators.length) return;

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
  }, [indicators, strategy]);

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

  const replayDayKey = useMemo(() => {
    if (!replayNowMs || !candles.length) return '';
    for (let i = candles.length - 1; i >= 0; i--) {
      if (new Date(candles[i].timestamp).getTime() <= replayNowMs) {
        return toIstDayKey(candles[i].timestamp);
      }
    }
    return '';
  }, [replayNowMs, candles]);

  // Compute current replay date and status
  const replayStatus = useMemo(() => {
    if (!replayNowMs || !candles.length || strategy !== 'ORB_FVG_RETEST') {
      return { date: '', status: '', detail: '', eventCount: 0 };
    }

    // Find the latest candle that is already revealed in replay.
    let currentCandle: Candle | null = null;
    for (let i = candles.length - 1; i >= 0; i--) {
      if (new Date(candles[i].timestamp).getTime() <= replayNowMs) {
        currentCandle = candles[i];
        break;
      }
    }

    if (!currentCandle) {
      return { date: '', status: '', detail: '', eventCount: 0 };
    }

    const date = format(new Date(currentCandle.timestamp), 'MMM dd, yyyy');
    const dayKey = toIstDayKey(currentCandle.timestamp);

    // Determine status from annotations
    let status = 'Waiting for ORB to form';
    let eventCount = 0;

    if (!annotations?.events) {
      return { date, status, detail: '', eventCount };
    }

    // Find all emitted events at or before current replay time, but only for current replay day.
    const relevantEvents = annotations.events
      .filter((e) => !!e.timestamp)
      .filter((e) => toIstDayKey(e.timestamp) === dayKey)
      .filter((e) => new Date(e.timestamp).getTime() <= replayNowMs)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (relevantEvents.length === 0) {
      return { date, status, detail: 'Checking ORB breakout conditions', eventCount: 0 };
    }

    eventCount = relevantEvents.length;
    const latestEvent = relevantEvents[relevantEvents.length - 1];

    // Map event type to human-readable status
    const statusMap: Record<string, string> = {
      CONFLUENCE_FAIL: 'Confluence check failed (RSI not aligned)',
      VOLUME_FAIL: 'Volume check failed',
      BREAKOUT: 'Breakout confirmed — waiting for FVG to form',
      FVG_FORMED: 'FVG formed — waiting for price retest',
      RETEST: 'Price retesting FVG',
      RETEST_CONTINUED: 'Still retesting FVG',
      ENGULF_FAIL: 'Engulfing check failed',
      PHASE_BACK_TO_RETEST: 'Price exited FVG — back to retest watch',
      ENGULF_CONFIRMED: 'Engulfing confirmed — preparing entry',
      RR_FAILED: 'Risk/Reward too low — entry rejected',
      DRAWDOWN_HALT: 'Drawdown halt active — no new entries',
      QTY_FAILED: 'Position size invalid',
      QTY_CAPPED: 'Position size capped to 20%',
      ENTRY: 'Trade entered',
      TRADE_NOT_TAKEN: 'Trade not taken — end of day',
    };

    status = statusMap[latestEvent.eventType] || latestEvent.eventType || status;

    return {
      date,
      status,
      detail: latestEvent.description || '',
      eventCount,
    };
  }, [replayNowMs, candles, strategy, annotations]);

  const replayNarration = useMemo(() => {
    if (!replayNowMs || strategy !== 'ORB_FVG_RETEST' || !annotations?.events) {
      return {
        currentPhase: 'Waiting for ORB to form',
        steps: [] as ReplayStep[],
        recentEvents: [] as { time: string; text: string }[],
      };
    }

    const eventTs = (ts: string) => new Date(ts).getTime();
    const upToNow = annotations.events
      .filter((e) => !!e.timestamp)
      .filter((e) => !replayDayKey || toIstDayKey(e.timestamp) === replayDayKey)
      .filter((e) => eventTs(e.timestamp) <= replayNowMs)
      .sort((a, b) => eventTs(a.timestamp) - eventTs(b.timestamp));

    if (upToNow.length === 0) {
      return {
        currentPhase: 'Checking ORB breakout conditions',
        steps: [
          { key: 'orb', label: 'ORB', state: 'active' },
          { key: 'breakout', label: 'Breakout', state: 'pending' },
          { key: 'fvg', label: 'FVG', state: 'pending' },
          { key: 'retest', label: 'Retest', state: 'pending' },
          { key: 'engulf', label: 'Engulf', state: 'pending' },
          { key: 'entry', label: 'Entry', state: 'pending' },
        ] as ReplayStep[],
        recentEvents: [] as { time: string; text: string }[],
      };
    }

    const lastEvent = upToNow[upToNow.length - 1];
    const hasEvent = (types: string[]) => upToNow.some((e) => types.includes(e.eventType));

    const isRejected = hasEvent([
      'TRADE_NOT_TAKEN',
      'RR_FAILED',
      'DRAWDOWN_HALT',
      'QTY_FAILED',
      'QTY_FINAL_FAIL',
      'CONFLUENCE_FAIL',
      'VOLUME_FAIL',
    ]);

    const hasEntry = hasEvent(['ENTRY']);
    const hasEngulf = hasEvent(['ENGULF_CONFIRMED']);
    const hasRetest = hasEvent(['RETEST', 'RETEST_CONTINUED']);
    const hasFvg = hasEvent(['FVG_FORMED']);
    const hasBreakout = hasEvent(['BREAKOUT']);

    let currentPhase = replayStatus.status || 'Running strategy checks';
    if (!hasBreakout) currentPhase = 'Waiting for breakout confirmation';
    else if (!hasFvg) currentPhase = 'Breakout confirmed - checking for FVG';
    else if (!hasRetest) currentPhase = 'FVG found - waiting for retest';
    else if (!hasEngulf) currentPhase = 'Retest happened - checking engulfing';
    else if (!hasEntry && !isRejected) currentPhase = 'Engulfing confirmed - preparing entry';

    const steps: ReplayStep[] = [
      { key: 'orb', label: 'ORB', state: 'done' },
      {
        key: 'breakout',
        label: 'Breakout',
        state: !hasBreakout ? 'active' : 'done',
      },
      {
        key: 'fvg',
        label: 'FVG',
        state: hasFvg ? 'done' : hasBreakout ? 'active' : 'pending',
      },
      {
        key: 'retest',
        label: 'Retest',
        state: hasRetest ? 'done' : hasFvg ? 'active' : 'pending',
      },
      {
        key: 'engulf',
        label: 'Engulf',
        state: hasEngulf ? 'done' : hasRetest ? 'active' : 'pending',
      },
      {
        key: 'entry',
        label: 'Entry',
        state: hasEntry ? 'done' : hasEngulf && !isRejected ? 'active' : 'pending',
      },
    ];

    const recentEvents = upToNow
      .slice(-4)
      .map((e) => ({
        time: format(new Date(e.timestamp), 'HH:mm'),
        text: e.description || e.eventType,
      }));

    if (lastEvent.eventType === 'TRADE_NOT_TAKEN') {
      currentPhase = 'Day closed - trade not taken';
    }

    return { currentPhase, steps, recentEvents };
  }, [replayNowMs, strategy, annotations, replayStatus.status, replayDayKey]);

  const tooltipLeft = tooltip
    ? clamp(tooltip.x + 14, 8, Math.max(8, (containerRef.current?.clientWidth ?? 0) - 236))
    : 0;
  const tooltipTop = tooltip
    ? clamp(tooltip.y - 10, 8, Math.max(8, (containerRef.current?.clientHeight ?? 0) - 220))
    : 0;
  const hasReplayHeader = Boolean(replayStatus.date);
  const replayHeaderHeight = hasReplayHeader ? 56 : 0;
  const isOrbReplay = strategy === 'ORB_FVG_RETEST';

  return (
    <div className="relative bg-[#0a0a0f] rounded-xl overflow-hidden border border-gray-800/50">
      {hasReplayHeader && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-br from-slate-900/70 to-slate-900/45 px-4 py-2.5 border-b border-indigo-500/30 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm font-semibold text-indigo-400">{replayStatus.date}</div>
              <div className="h-4 w-px bg-slate-600/40" />
              <div className="text-sm text-slate-300 max-w-3xl truncate">{replayNarration.currentPhase || replayStatus.status}</div>
            </div>
            {replayStatus.eventCount > 0 && (
              <div className="text-xs text-slate-400 flex items-center space-x-1">
                <span className="text-indigo-400 font-semibold">{replayStatus.eventCount}</span>
                <span>event{replayStatus.eventCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          {replayStatus.detail && (
            <div className="mt-1 text-xs text-slate-400 truncate">
              {replayStatus.detail}
            </div>
          )}
          {replayNarration.steps.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {replayNarration.steps.map((step) => {
                const cls =
                  step.state === 'done'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : step.state === 'active'
                    ? 'bg-indigo-500/20 border-indigo-500/45 text-indigo-200'
                    : 'bg-slate-700/25 border-slate-600/40 text-slate-400';
                return (
                  <span
                    key={step.key}
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${cls}`}
                  >
                    {step.label}
                  </span>
                );
              })}
            </div>
          )}
          {replayNarration.recentEvents.length > 0 && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1">
              {replayNarration.recentEvents.map((evt, idx) => (
                <div key={`${evt.time}-${idx}`} className="text-[11px] text-slate-300/90 truncate">
                  <span className="text-indigo-300 mr-1">{evt.time}</span>
                  <span>{evt.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div ref={containerRef} className="relative w-full" style={{ cursor: 'crosshair', paddingTop: `${replayHeaderHeight}px` }}>
        <canvas
          ref={overlayRef}
          style={{
            position: 'absolute',
            top: `${replayHeaderHeight}px`,
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

      {isOrbReplay && (
        <div className="border-t border-gray-800/70 bg-[#0b0b12] px-4 py-2">
          <button
            type="button"
            onClick={() => setLegendOpen((prev) => !prev)}
            className="w-full text-left text-xs text-gray-300 hover:text-white transition-colors"
          >
            {legendOpen ? 'Hide Replay Legend' : 'Show Replay Legend'}
          </button>
          {legendOpen && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400">
              <div>ORB box (indigo): opening range for the full day.</div>
              <div>ORB box (amber): no trade taken for that day.</div>
              <div>FVG box (teal): bullish fair value gap zone.</div>
              <div>FVG box (rose): bearish fair value gap zone.</div>
              <div>OB box (green): order block zone.</div>
              <div>BO marker: breakout confirmed.</div>
              <div>FVG marker: new gap detected.</div>
              <div>Retested badge: close moved back into FVG.</div>
              <div>ENG marker: engulfing confirmed.</div>
              <div>IN marker: entry candle.</div>
              <div>Red X marker: trade not taken at day end.</div>
              <div>Status bar (top): current step the logic is evaluating.</div>
            </div>
          )}
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