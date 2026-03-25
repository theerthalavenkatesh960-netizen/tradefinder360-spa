import { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineData,
  UTCTimestamp,
  LineSeries,
} from 'lightweight-charts';
import { Indicators } from '../services/api';

interface RSIPanelProps {
  indicators: Indicators[];
}

// ✅ Shared time converter (v5 strict typing fix)
const toUTCTimestamp = (time: string | number | Date): UTCTimestamp =>
  (new Date(time).getTime() / 1000) as UTCTimestamp;

export const RSIPanel = ({ indicators }: RSIPanelProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const overboughtRef = useRef<ISeriesApi<'Line'> | null>(null);
  const oversoldRef = useRef<ISeriesApi<'Line'> | null>(null);

  // ✅ Create chart (once)
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

    // ✅ Main RSI line (v5 API)
    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#6366f1',
      lineWidth: 2,
    });

    // ✅ Overbought (70)
    const overboughtLine = chart.addSeries(LineSeries, {
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: 2, // dashed
    });

    // ✅ Oversold (30)
    const oversoldLine = chart.addSeries(LineSeries, {
      color: '#22c55e',
      lineWidth: 1,
      lineStyle: 2,
    });

    chartRef.current = chart;
    rsiSeriesRef.current = rsiSeries;
    overboughtRef.current = overboughtLine;
    oversoldRef.current = oversoldLine;

    // ✅ Responsive resize
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
    if (!rsiSeriesRef.current || !indicators.length) return;

    const rsiData: LineData[] = indicators
      .filter((i) => typeof i.rsi === 'number' && Number.isFinite(i.rsi))
      .map((i) => ({
        time: toUTCTimestamp(i.timestamp),
        value: Math.max(0, Math.min(100, i.rsi)), // ✅ clamp RSI
      }));

    if (!rsiData.length) return;

    // ✅ Set RSI line
    rsiSeriesRef.current.setData(rsiData);

    // ✅ Build static band lines
    const overboughtData: LineData[] = rsiData.map((d) => ({
      time: d.time,
      value: 70,
    }));

    const oversoldData: LineData[] = rsiData.map((d) => ({
      time: d.time,
      value: 30,
    }));

    overboughtRef.current?.setData(overboughtData);
    oversoldRef.current?.setData(oversoldData);
  }, [indicators]);

  return (
    <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">RSI (14)</h3>

      <div ref={chartContainerRef} className="w-full" />

      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>Oversold (30)</span>
        <span>Overbought (70)</span>
      </div>
    </div>
  );
};