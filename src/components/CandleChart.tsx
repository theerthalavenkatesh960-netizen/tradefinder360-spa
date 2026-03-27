import { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  CandlestickSeries,
  LineSeries,
  UTCTimestamp,
  createSeriesMarkers,
} from 'lightweight-charts';
import { Candle, Indicators } from '../services/api';

interface CandleChartProps {
  candles: Candle[];
  indicators?: Indicators[];
  buySignals?: { time: string; price: number }[];
  sellSignals?: { time: string; price: number }[];
  stopLoss?: number;
  target?: number;
  showEMA?: boolean;
  showBollinger?: boolean;
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
}: CandleChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const emaFastSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSlowSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const toUTCTimestamp = (date: string | number | Date): UTCTimestamp =>
  (new Date(date).getTime() / 1000) as UTCTimestamp;

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
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#6366f1',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: '#6366f1',
          width: 1,
          style: 3,
        },
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

    const emaFastSeries = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      title: 'EMA Fast',
    });

    const emaSlowSeries = chart.addSeries(LineSeries, {
      color: '#f97316',
      lineWidth: 2,
      title: 'EMA Slow',
    });

    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: '#ef4444',
      lineWidth: 1.25,
      lineStyle: 2,
      title: 'BB Upper',
    });

    const bbMiddleSeries = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      lineStyle: 1,
      title: 'BB Middle',
    });

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: '#22c55e',
      lineWidth: 1.25,
      lineStyle: 2,
      title: 'BB Lower',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    emaFastSeriesRef.current = emaFastSeries;
    emaSlowSeriesRef.current = emaSlowSeries;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbMiddleSeriesRef.current = bbMiddleSeries;
    bbLowerSeriesRef.current = bbLowerSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const candleData: CandlestickData[] = candles.map((c) => ({
      time: toUTCTimestamp(c.timestamp),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(candleData);
  }, [candles]);

  

  useEffect(() => {
    if (!showEMA || !indicators.length) {
      emaFastSeriesRef.current?.setData([]);
      emaSlowSeriesRef.current?.setData([]);
      return;
    }

    const emaFastData: LineData[] = indicators
      .filter((i) => i.emaFast > 0)
      .map((i) => ({
        time: toUTCTimestamp(i.timestamp),
        value: i.emaFast,
      }));

    const emaSlowData: LineData[] = indicators
      .filter((i) => i.emaSlow > 0)
      .map((i) => ({
        time: toUTCTimestamp(i.timestamp),
        value: i.emaSlow,
      }));

    emaFastSeriesRef.current?.setData(emaFastData);
    emaSlowSeriesRef.current?.setData(emaSlowData);
  }, [indicators, showEMA]);

  useEffect(() => {
    if (!showBollinger || !indicators.length) {
      bbUpperSeriesRef.current?.setData([]);
      bbMiddleSeriesRef.current?.setData([]);
      bbLowerSeriesRef.current?.setData([]);
      return;
    }

    const bbUpperData: LineData[] = indicators
      .filter((i) => i.bollingerUpper > 0)
      .map((i) => ({
        time: toUTCTimestamp(i.timestamp),
        value: i.bollingerUpper,
      }));

    const bbMiddleData: LineData[] = indicators
      .filter((i) => i.bollingerMiddle > 0)
      .map((i) => ({
        time: toUTCTimestamp(i.timestamp),
        value: i.bollingerMiddle,
      }));

    const bbLowerData: LineData[] = indicators
      .filter((i) => i.bollingerLower > 0)
      .map((i) => ({
        time: toUTCTimestamp(i.timestamp),
        value: i.bollingerLower,
      }));

    bbUpperSeriesRef.current?.setData(bbUpperData);
    bbMiddleSeriesRef.current?.setData(bbMiddleData);
    bbLowerSeriesRef.current?.setData(bbLowerData);
  }, [indicators, showBollinger]);


  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const buyMarkers = buySignals.map((signal) => ({
      time: toUTCTimestamp(signal.time),
      position: 'belowBar' as const,
      color: '#22c55e',
      shape: 'arrowUp' as const,
      text: 'BUY',
    }));

    const sellMarkers = sellSignals.map((signal) => ({
      time: toUTCTimestamp(signal.time),
      position: 'aboveBar' as const,
      color: '#ef4444',
      shape: 'arrowDown' as const,
      text: 'SELL',
    }));

    // ✅ MERGE BOTH
    const allMarkers = [...buyMarkers, ...sellMarkers];

    // ✅ SINGLE CALL
    createSeriesMarkers(candleSeriesRef.current, allMarkers);

  }, [buySignals, sellSignals]);

  return <div ref={chartContainerRef} className="w-full" />;
};