import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData } from 'lightweight-charts';
import { Indicators } from '../services/api';

interface RSIPanelProps {
  indicators: Indicators[];
}

export const RSIPanel = ({ indicators }: RSIPanelProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

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

    const rsiSeries = chart.addLineSeries({
      color: '#6366f1',
      lineWidth: 2,
    });

    chartRef.current = chart;
    rsiSeriesRef.current = rsiSeries;

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
    if (!rsiSeriesRef.current || !indicators.length) return;

    const rsiData: LineData[] = indicators
      .filter((i) => i.rsi > 0)
      .map((i) => ({
        time: new Date(i.timestamp).getTime() / 1000,
        value: i.rsi,
      }));

    rsiSeriesRef.current.setData(rsiData);
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
