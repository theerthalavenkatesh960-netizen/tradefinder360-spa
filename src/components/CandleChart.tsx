import { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  UTCTimestamp,
  createSeriesMarkers,
} from 'lightweight-charts';
import { Candle, Indicators } from '../services/api';
import { formatUTCToIST } from '../utils/formatters';

interface CandleChartProps {
  candles: Candle[];
  indicators?: Indicators[];
  buySignals?: { time: string; price: number }[];
  sellSignals?: { time: string; price: number }[];
  stopLoss?: number;
  target?: number;
  showEMA?: boolean;
  showBollinger?: boolean;
  showRSI?: boolean;
  showMACD?: boolean;
}

export const CandleChart = ({
  candles,
  indicators = [],
  buySignals = [],
  sellSignals = [],
  stopLoss,
  target,
  showEMA = true,
  showBollinger = true,
  showRSI = true,
  showMACD = true,
}: CandleChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const showFlagsRef = useRef({ showEMA, showBollinger, showRSI, showMACD });

  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const emaFastSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSlowSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiOverboughtRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiOversoldRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistogramSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const toUTCTimestamp = (date: string | number | Date): UTCTimestamp =>
    (new Date(date).getTime() / 1000) as UTCTimestamp;

  // ✅ ONE CLEAN UTILITY
  const uniqueByTime = <T extends { time: number }>(data: T[]): T[] => {
    const map = new Map<number, T>();
    data.forEach((d) => map.set(d.time, d));
    return Array.from(map.values()).sort((a, b) => a.time - b.time);
  };

  // Keep showFlags ref in sync so the crosshair handler always reads latest values
  useEffect(() => {
    showFlagsRef.current = { showEMA, showBollinger, showRSI, showMACD };
  }, [showEMA, showBollinger, showRSI, showMACD]);

  // 🚀 INIT CHART
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0a0a0f' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
      },
      localization: {
        timeFormatter: (utc: number) => formatUTCToIST(utc),
      } as any,
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: { top: 0.02, bottom: 0.42 },
      },
      crosshair: {
        mode: 1,
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

    const emaFastSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2 });
    const emaSlowSeries = chart.addSeries(LineSeries, { color: '#f97316', lineWidth: 2 });

    const bbUpperSeries = chart.addSeries(LineSeries, { color: '#ef4444', lineStyle: 2 });
    const bbMiddleSeries = chart.addSeries(LineSeries, { color: '#f59e0b' });
    const bbLowerSeries = chart.addSeries(LineSeries, { color: '#22c55e', lineStyle: 2 });

    const rsiSeries = chart.addSeries(LineSeries, { color: '#8b5cf6', priceScaleId: 'rsi' });
    const rsiOver = chart.addSeries(LineSeries, { color: '#ef4444', lineStyle: 2, priceScaleId: 'rsi' });
    const rsiUnder = chart.addSeries(LineSeries, { color: '#22c55e', lineStyle: 2, priceScaleId: 'rsi' });

    const macdLine = chart.addSeries(LineSeries, { color: '#22c55e', priceScaleId: 'macd' });
    const macdSignal = chart.addSeries(LineSeries, { color: '#ef4444', priceScaleId: 'macd' });
    const macdHist = chart.addSeries(HistogramSeries, { priceScaleId: 'macd' });

    chart.priceScale('rsi').applyOptions({
      scaleMargins: { top: 0.62, bottom: 0.2 },
    });

    chart.priceScale('macd').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0.02 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    emaFastSeriesRef.current = emaFastSeries;
    emaSlowSeriesRef.current = emaSlowSeries;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbMiddleSeriesRef.current = bbMiddleSeries;
    bbLowerSeriesRef.current = bbLowerSeries;
    rsiSeriesRef.current = rsiSeries;
    rsiOverboughtRef.current = rsiOver;
    rsiOversoldRef.current = rsiUnder;
    macdLineSeriesRef.current = macdLine;
    macdSignalSeriesRef.current = macdSignal;
    macdHistogramSeriesRef.current = macdHist;

    // 🖱 CROSSHAIR LEGEND — update top-left overlay on mouse move
    chart.subscribeCrosshairMove((param) => {
      const legend = legendRef.current;
      if (!legend) return;

      if (!param.time || !param.point || param.point.x <= 0 || param.point.y <= 0) {
        legend.style.display = 'none';
        return;
      }

      legend.style.display = 'block';
      const flags = showFlagsRef.current;
      const lines: string[] = [];

      // OHLC row
      const bar = param.seriesData.get(candleSeries) as any;
      if (bar) {
        const bullish = bar.close >= bar.open;
        const priceColor = bullish ? '#22c55e' : '#ef4444';
        lines.push(
          `<span style="color:#6b7280">O</span><span style="color:${priceColor}"> ${bar.open.toFixed(2)}</span>` +
          `  <span style="color:#6b7280">H</span><span style="color:#22c55e"> ${bar.high.toFixed(2)}</span>` +
          `  <span style="color:#6b7280">L</span><span style="color:#ef4444"> ${bar.low.toFixed(2)}</span>` +
          `  <span style="color:#6b7280">C</span><span style="color:${priceColor}"> ${bar.close.toFixed(2)}</span>`
        );
      }

      // EMA
      if (flags.showEMA) {
        const fast = param.seriesData.get(emaFastSeries) as any;
        const slow = param.seriesData.get(emaSlowSeries) as any;
        const parts: string[] = [];
        if (fast?.value != null) parts.push(`<span style="color:#6b7280">EMA Fast</span> <span style="color:#3b82f6">${fast.value.toFixed(2)}</span>`);
        if (slow?.value != null) parts.push(`<span style="color:#6b7280">EMA Slow</span> <span style="color:#f97316">${slow.value.toFixed(2)}</span>`);
        if (parts.length) lines.push(parts.join('  '));
      }

      // Bollinger Bands
      if (flags.showBollinger) {
        const upper = param.seriesData.get(bbUpperSeries) as any;
        const mid = param.seriesData.get(bbMiddleSeries) as any;
        const lower = param.seriesData.get(bbLowerSeries) as any;
        if (upper?.value != null) {
          lines.push(
            `<span style="color:#6b7280">BB</span>` +
            `  <span style="color:#6b7280">U</span><span style="color:#ef4444"> ${upper.value.toFixed(2)}</span>` +
            `  <span style="color:#6b7280">M</span><span style="color:#f59e0b"> ${mid?.value?.toFixed(2) ?? '—'}</span>` +
            `  <span style="color:#6b7280">L</span><span style="color:#22c55e"> ${lower?.value?.toFixed(2) ?? '—'}</span>`
          );
        }
      }

      // RSI
      if (flags.showRSI) {
        const rsiData = param.seriesData.get(rsiSeries) as any;
        if (rsiData?.value != null) {
          const v = rsiData.value;
          const c = v >= 70 ? '#ef4444' : v <= 30 ? '#22c55e' : '#8b5cf6';
          lines.push(`<span style="color:#6b7280">RSI</span> <span style="color:${c}">${v.toFixed(2)}</span>`);
        }
      }

      // MACD
      if (flags.showMACD) {
        const mLine = param.seriesData.get(macdLine) as any;
        const mSig = param.seriesData.get(macdSignal) as any;
        const mHist = param.seriesData.get(macdHist) as any;
        if (mLine?.value != null) {
          lines.push(
            `<span style="color:#6b7280">MACD</span> <span style="color:#22c55e">${mLine.value.toFixed(2)}</span>` +
            (mSig?.value != null ? `  <span style="color:#6b7280">Sig</span> <span style="color:#ef4444">${mSig.value.toFixed(2)}</span>` : '') +
            (mHist?.value != null ? `  <span style="color:#6b7280">Hist</span> <span style="color:${mHist.value >= 0 ? '#22c55e' : '#ef4444'}">${mHist.value.toFixed(2)}</span>` : '')
          );
        }
      }

      legend.innerHTML = lines.join('<br/>');
    });

    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current!.clientWidth,
        height: chartContainerRef.current!.clientHeight,
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // 📊 CANDLES
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    candleSeriesRef.current.setData(
      uniqueByTime(
        candles.map((c) => ({
          time: toUTCTimestamp(c.timestamp),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      )
    );
  }, [candles]);

  // 📈 EMA
  useEffect(() => {
    if (!showEMA || !indicators.length) {
      emaFastSeriesRef.current?.setData([]);
      emaSlowSeriesRef.current?.setData([]);
      return;
    }

    emaFastSeriesRef.current?.setData(
      uniqueByTime(indicators.map(i => ({
        time: toUTCTimestamp(i.timestamp),
        value: i.emaFast
      })))
    );

    emaSlowSeriesRef.current?.setData(
      uniqueByTime(indicators.filter(i => i.emaSlow > 0).map(i => ({
        time: toUTCTimestamp(i.timestamp),
        value: i.emaSlow
      })))
    );
  }, [indicators, showEMA]);

  // 📉 BOLLINGER
  useEffect(() => {
    if (!showBollinger || !indicators.length) {
      bbUpperSeriesRef.current?.setData([]);
      bbMiddleSeriesRef.current?.setData([]);
      bbLowerSeriesRef.current?.setData([]);
      return;
    }

    bbUpperSeriesRef.current?.setData(uniqueByTime(indicators.map(i => ({
      time: toUTCTimestamp(i.timestamp),
      value: i.bollingerUpper
    }))));

    bbMiddleSeriesRef.current?.setData(uniqueByTime(indicators.map(i => ({
      time: toUTCTimestamp(i.timestamp),
      value: i.bollingerMiddle
    }))));

    bbLowerSeriesRef.current?.setData(uniqueByTime(indicators.map(i => ({
      time: toUTCTimestamp(i.timestamp),
      value: i.bollingerLower
    }))));
  }, [indicators, showBollinger]);

  // 📊 RSI
  useEffect(() => {
    const visible = showRSI && indicators.length > 0;
    rsiSeriesRef.current?.applyOptions({ visible });
    rsiOverboughtRef.current?.applyOptions({ visible });
    rsiOversoldRef.current?.applyOptions({ visible });

    if (!visible) return;

    const rsiData = uniqueByTime(indicators.map(i => ({
      time: toUTCTimestamp(i.timestamp),
      value: Math.max(0, Math.min(100, i.rsi))
    })));

    rsiSeriesRef.current?.setData(rsiData);
    rsiOverboughtRef.current?.setData(rsiData.map(p => ({ ...p, value: 70 })));
    rsiOversoldRef.current?.setData(rsiData.map(p => ({ ...p, value: 30 })));
  }, [indicators, showRSI]);

  // 📊 MACD
  useEffect(() => {
    const visible = showMACD && indicators.length > 0;
    macdLineSeriesRef.current?.applyOptions({ visible });
    macdSignalSeriesRef.current?.applyOptions({ visible });
    macdHistogramSeriesRef.current?.applyOptions({ visible });

    if (!visible) return;

    macdLineSeriesRef.current?.setData(uniqueByTime(indicators.map(i => ({
      time: toUTCTimestamp(i.timestamp),
      value: i.macdLine
    }))));

    macdSignalSeriesRef.current?.setData(uniqueByTime(indicators.map(i => ({
      time: toUTCTimestamp(i.timestamp),
      value: i.macdSignal
    }))));

    macdHistogramSeriesRef.current?.setData(uniqueByTime(indicators.map(i => ({
      time: toUTCTimestamp(i.timestamp),
      value: i.macdHistogram,
      color: i.macdHistogram >= 0 ? '#22c55e' : '#ef4444'
    }))));
  }, [indicators, showMACD]);

  // 🗺 LAYOUT — reclaim chart space when RSI/MACD panels toggle
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const hasRSI = showRSI;
    const hasMACD = showMACD;

    if (!hasRSI && !hasMACD) {
      chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.02, bottom: 0.02 } });
    } else if (hasRSI && !hasMACD) {
      chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.02, bottom: 0.22 } });
      chart.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.80, bottom: 0.02 } });
    } else if (!hasRSI && hasMACD) {
      chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.02, bottom: 0.22 } });
      chart.priceScale('macd').applyOptions({ scaleMargins: { top: 0.80, bottom: 0.02 } });
    } else {
      chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.02, bottom: 0.42 } });
      chart.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.62, bottom: 0.20 } });
      chart.priceScale('macd').applyOptions({ scaleMargins: { top: 0.82, bottom: 0.02 } });
    }
  }, [showRSI, showMACD]);

  // 📍 MARKERS
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const allMarkers = uniqueByTime([
      ...buySignals.map(s => ({
        time: toUTCTimestamp(s.time),
        position: 'belowBar' as const,
        color: '#22c55e',
        shape: 'arrowUp' as const,
        text: 'BUY',
      })),
      ...sellSignals.map(s => ({
        time: toUTCTimestamp(s.time),
        position: 'aboveBar' as const,
        color: '#ef4444',
        shape: 'arrowDown' as const,
        text: 'SELL',
      })),
    ]);

    createSeriesMarkers(candleSeriesRef.current, allMarkers);
  }, [buySignals, sellSignals]);

  return (
    <div className="relative w-full h-[78vh] min-h-[560px]">
      <div ref={chartContainerRef} className="absolute inset-0" />
      <div
        ref={legendRef}
        style={{ display: 'none', background: 'rgba(10,10,15,0.72)', fontFamily: 'monospace' }}
        className="absolute top-2 left-2 z-10 pointer-events-none text-xs leading-relaxed px-2 py-1.5 rounded border border-white/10 backdrop-blur-sm"
      />
    </div>
  );
};