import { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineData,
  HistogramData,
  UTCTimestamp,
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts';
import { Indicators } from '../services/api';

interface MACDPanelProps {
  indicators: Indicators[];
}

// ✅ Shared converter
const toUTCTimestamp = (time: string | number | Date): UTCTimestamp =>
  (new Date(time).getTime() / 1000) as UTCTimestamp;

export const MACDPanel = ({ indicators }: MACDPanelProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histogramSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // ✅ Create chart
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
      height: 150,
      timeScale: {
        visible: false,
        borderColor: '#374151',
      },
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
    });

    // ✅ Histogram (v5)
    const histogramSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
    });

    // ✅ MACD line
    const macdSeries = chart.addSeries(LineSeries, {
      color: '#22c55e',
      lineWidth: 2,
    });

    // ✅ Signal line
    const signalSeries = chart.addSeries(LineSeries, {
      color: '#ef4444',
      lineWidth: 2,
    });

    chartRef.current = chart;
    macdSeriesRef.current = macdSeries;
    signalSeriesRef.current = signalSeries;
    histogramSeriesRef.current = histogramSeries;

    // ✅ Resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // ✅ Update data
  useEffect(() => {
    if (!indicators.length) return;

    const macdData: LineData[] = indicators
      .filter((i) => typeof i.macdLine === 'number' && Number.isFinite(i.macdLine))
      .map((i) => ({
        time: toUTCTimestamp(i.timestamp),
        value: i.macdLine,
      }));

    const signalData: LineData[] = indicators
      .filter((i) => typeof i.macdSignal === 'number' && Number.isFinite(i.macdSignal))
      .map((i) => ({
        time: toUTCTimestamp(i.timestamp),
        value: i.macdSignal,
      }));

    const histogramData: HistogramData[] = indicators
      .filter((i) => typeof i.macdHistogram === 'number' && Number.isFinite(i.macdHistogram))
      .map((i) => ({
        time: toUTCTimestamp(i.timestamp),
        value: i.macdHistogram,
        color: i.macdHistogram >= 0 ? '#22c55e' : '#ef4444',
      }));

    macdSeriesRef.current?.setData(macdData);
    signalSeriesRef.current?.setData(signalData);
    histogramSeriesRef.current?.setData(histogramData);
  }, [indicators]);

  return (
    <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">
        MACD (12, 26, 9)
      </h3>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
};