import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, HistogramData } from 'lightweight-charts';
import { Indicators } from '../services/api';

interface MACDPanelProps {
  indicators: Indicators[];
}

export const MACDPanel = ({ indicators }: MACDPanelProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histogramSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

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

    const histogramSeries = chart.addHistogramSeries({
      color: '#6366f1',
      priceFormat: {
        type: 'volume',
      },
    });

    const macdSeries = chart.addLineSeries({
      color: '#22c55e',
      lineWidth: 2,
    });

    const signalSeries = chart.addLineSeries({
      color: '#ef4444',
      lineWidth: 2,
    });

    chartRef.current = chart;
    macdSeriesRef.current = macdSeries;
    signalSeriesRef.current = signalSeries;
    histogramSeriesRef.current = histogramSeries;

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
    if (!indicators.length) return;

    const macdData: LineData[] = indicators
      .filter((i) => i.macdLine !== 0)
      .map((i) => ({
        time: new Date(i.timestamp).getTime() / 1000,
        value: i.macdLine,
      }));

    const signalData: LineData[] = indicators
      .filter((i) => i.macdSignal !== 0)
      .map((i) => ({
        time: new Date(i.timestamp).getTime() / 1000,
        value: i.macdSignal,
      }));

    const histogramData: HistogramData[] = indicators
      .filter((i) => i.macdHistogram !== 0)
      .map((i) => ({
        time: new Date(i.timestamp).getTime() / 1000,
        value: i.macdHistogram,
        color: i.macdHistogram > 0 ? '#22c55e' : '#ef4444',
      }));

    macdSeriesRef.current?.setData(macdData);
    signalSeriesRef.current?.setData(signalData);
    histogramSeriesRef.current?.setData(histogramData);
  }, [indicators]);

  return (
    <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">MACD (12, 26, 9)</h3>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
};
