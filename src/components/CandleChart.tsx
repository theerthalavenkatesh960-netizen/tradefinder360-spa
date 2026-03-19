import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData } from 'lightweight-charts';
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
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

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

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const emaFastSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      title: 'EMA Fast',
    });

    const emaSlowSeries = chart.addLineSeries({
      color: '#f97316',
      lineWidth: 2,
      title: 'EMA Slow',
    });

    const bbUpperSeries = chart.addLineSeries({
      color: '#6b7280',
      lineWidth: 1,
      lineStyle: 2,
      title: 'BB Upper',
    });

    const bbLowerSeries = chart.addLineSeries({
      color: '#6b7280',
      lineWidth: 1,
      lineStyle: 2,
      title: 'BB Lower',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    emaFastSeriesRef.current = emaFastSeries;
    emaSlowSeriesRef.current = emaSlowSeries;
    bbUpperSeriesRef.current = bbUpperSeries;
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
      time: new Date(c.timestamp).getTime() / 1000,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(candleData);
  }, [candles]);

  useEffect(() => {
    if (!indicators.length || !showEMA) return;

    const emaFastData: LineData[] = indicators
      .filter((i) => i.emaFast > 0)
      .map((i) => ({
        time: new Date(i.timestamp).getTime() / 1000,
        value: i.emaFast,
      }));

    const emaSlowData: LineData[] = indicators
      .filter((i) => i.emaSlow > 0)
      .map((i) => ({
        time: new Date(i.timestamp).getTime() / 1000,
        value: i.emaSlow,
      }));

    emaFastSeriesRef.current?.setData(emaFastData);
    emaSlowSeriesRef.current?.setData(emaSlowData);
  }, [indicators, showEMA]);

  useEffect(() => {
    if (!indicators.length || !showBollinger) return;

    const bbUpperData: LineData[] = indicators
      .filter((i) => i.bollingerUpper > 0)
      .map((i) => ({
        time: new Date(i.timestamp).getTime() / 1000,
        value: i.bollingerUpper,
      }));

    const bbLowerData: LineData[] = indicators
      .filter((i) => i.bollingerLower > 0)
      .map((i) => ({
        time: new Date(i.timestamp).getTime() / 1000,
        value: i.bollingerLower,
      }));

    bbUpperSeriesRef.current?.setData(bbUpperData);
    bbLowerSeriesRef.current?.setData(bbLowerData);
  }, [indicators, showBollinger]);

  useEffect(() => {
    if (!chartRef.current || !buySignals.length) return;

    buySignals.forEach((signal) => {
      candleSeriesRef.current?.setMarkers([
        {
          time: new Date(signal.time).getTime() / 1000,
          position: 'belowBar',
          color: '#22c55e',
          shape: 'arrowUp',
          text: 'BUY',
        },
      ]);
    });
  }, [buySignals]);

  useEffect(() => {
    if (!chartRef.current || !sellSignals.length) return;

    sellSignals.forEach((signal) => {
      candleSeriesRef.current?.setMarkers([
        {
          time: new Date(signal.time).getTime() / 1000,
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: 'SELL',
        },
      ]);
    });
  }, [sellSignals]);

  return <div ref={chartContainerRef} className="w-full" />;
};
