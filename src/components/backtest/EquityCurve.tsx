import { useEffect, useRef, useMemo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  HistogramSeries,
  LineData,
  HistogramData,
  UTCTimestamp,
} from 'lightweight-charts';
import type { EquityPoint } from '../../services/api';

interface EquityCurveProps {
  equityCurve: EquityPoint[];
}

const toUTC = (d: string | number | Date): UTCTimestamp =>
  (new Date(d).getTime() / 1000) as UTCTimestamp;

export const EquityCurve = ({ equityCurve }: EquityCurveProps) => {
  const equityContainerRef = useRef<HTMLDivElement>(null);
  const pnlContainerRef = useRef<HTMLDivElement>(null);
  const equityChartRef = useRef<IChartApi | null>(null);
  const pnlChartRef = useRef<IChartApi | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const pnlSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Compute daily PnL by grouping equity points by calendar date
  const dailyPnl = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 1; i < equityCurve.length; i++) {
      const date = equityCurve[i].timestamp.slice(0, 10);
      const delta = equityCurve[i].equity - equityCurve[i - 1].equity;
      map.set(date, (map.get(date) ?? 0) + delta);
    }
    return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
  }, [equityCurve]);

  // Create equity curve chart
  useEffect(() => {
    if (!equityContainerRef.current) return;

    const chart = createChart(equityContainerRef.current, {
      layout: { background: { color: '#0a0a0f' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      width: equityContainerRef.current.clientWidth,
      height: 180,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#374151' },
      rightPriceScale: { borderColor: '#374151' },
      crosshair: {
        vertLine: { color: '#6366f1', width: 1, style: 3 },
        horzLine: { color: '#6366f1', width: 1, style: 3 },
      },
    });

    const series = chart.addSeries(LineSeries, {
      color: '#6366f1',
      lineWidth: 2,
      title: 'Equity',
      priceLineVisible: false,
      lastValueVisible: true,
    });

    equityChartRef.current = chart;
    equitySeriesRef.current = series;

    const handleResize = () => {
      if (equityContainerRef.current) {
        chart.applyOptions({ width: equityContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Create daily PnL chart
  useEffect(() => {
    if (!pnlContainerRef.current) return;

    const chart = createChart(pnlContainerRef.current, {
      layout: { background: { color: '#0a0a0f' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      width: pnlContainerRef.current.clientWidth,
      height: 100,
      timeScale: { timeVisible: false, borderColor: '#374151' },
      rightPriceScale: { borderColor: '#374151' },
    });

    const series = chart.addSeries(HistogramSeries, {
      priceScaleId: 'right',
      priceLineVisible: false,
      lastValueVisible: false,
    });

    pnlChartRef.current = chart;
    pnlSeriesRef.current = series;

    const handleResize = () => {
      if (pnlContainerRef.current) {
        chart.applyOptions({ width: pnlContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Set equity curve data
  useEffect(() => {
    if (!equitySeriesRef.current || !equityCurve.length) return;

    const data: LineData[] = equityCurve.map((p) => ({
      time: toUTC(p.timestamp),
      value: p.equity,
    }));

    equitySeriesRef.current.setData(data);
    equityChartRef.current?.timeScale().fitContent();
  }, [equityCurve]);

  // Set daily PnL data
  useEffect(() => {
    if (!pnlSeriesRef.current || !dailyPnl.length) return;

    const data: HistogramData[] = dailyPnl.map((d) => ({
      time: (new Date(d.date).getTime() / 1000) as UTCTimestamp,
      value: d.value,
      color: d.value >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)',
    }));

    pnlSeriesRef.current.setData(data);
    pnlChartRef.current?.timeScale().fitContent();
  }, [dailyPnl]);

  if (!equityCurve.length) return null;

  return (
    <div className="bg-[#12121a]/50 border border-gray-800/50 rounded-xl p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Equity Curve</h3>
          <p className="text-xs text-gray-500">Capital growth over backtest period</p>
        </div>
        <div className="text-xs text-gray-500">{equityCurve.length} trade points</div>
      </div>
      <div ref={equityContainerRef} className="w-full" />
      <div className="mt-1">
        <p className="text-xs text-gray-600 mb-1 px-1">Daily P&L</p>
        <div ref={pnlContainerRef} className="w-full" />
      </div>
    </div>
  );
};
