import { memo, useState } from 'react';
import { Candle } from '../services/api';

interface TrendCandlesProps {
  candles: Candle[];
  symbol: string;
  isPositive: boolean; // True for gainers, False for losers
}

/**
 * Mini candlestick chart component for radar gainers/losers.
 * Renders 5 small candles (or fewer if data is sparse) with hover tooltips.
 * Compact and responsive design optimized for embedded display.
 */
export const TrendCandles = memo(({ candles, symbol, isPositive }: TrendCandlesProps) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!candles || candles.length === 0) {
    return (
      <div className="flex items-center justify-center h-10 text-xs text-gray-500 bg-gray-900/20 rounded px-2 py-1">
        No data
      </div>
    );
  }

  // Take last 5 candles for trend display
  const displayCandles = candles.slice(-5);
  
  if (displayCandles.length === 0) {
    return (
      <div className="flex items-center justify-center h-10 text-xs text-gray-500 bg-gray-900/20 rounded px-2 py-1">
        No data
      </div>
    );
  }

  // Find min/max for scaling
  const allLows = displayCandles.map(c => c.low);
  const allHighs = displayCandles.map(c => c.high);
  const minPrice = Math.min(...allLows);
  const maxPrice = Math.max(...allHighs);
  const priceRange = maxPrice - minPrice || 1;

  // Scale height (0 to 1) for positioning
  const scalePrice = (price: number) => (price - minPrice) / priceRange;

  const candleHeight = 32; // px

  return (
    <div className="flex items-end gap-0.5 h-10 bg-gray-900/10 rounded px-2 py-1relative">
      {displayCandles.map((candle, idx) => {
        const isBullish = candle.close >= candle.open;
        const bodyTop = Math.min(candle.open, candle.close);
        const bodyBottom = Math.max(candle.open, candle.close);
        const bodySize = Math.max(bodyBottom - bodyTop, 0.001); // Prevent NaN

        const topScale = scalePrice(candle.high);
        const bottomScale = scalePrice(candle.low);
        const openScale = scalePrice(candle.open);
        const closeScale = scalePrice(candle.close);

        const wickTop = (1 - topScale) * candleHeight; // Wick to high
        const wickBottom = (1 - bottomScale) * candleHeight; // Wick to low
        const bodyTopPx = (1 - Math.max(openScale, closeScale)) * candleHeight;
        const bodyHeightPx = Math.max((bodySize / priceRange) * candleHeight, 1);

        const candleColor = isBullish
          ? isPositive
            ? 'text-emerald-500' // Green for bullish gainers
            : 'text-emerald-600' // Slightly darker green for bullish losers
          : isPositive
            ? 'text-red-600' // Darker red for bearish gainers
            : 'text-red-500'; // Red for bearish losers

        const hoverBg = hoveredIdx === idx ? 'bg-white/10' : 'bg-transparent';

        return (
          <div
            key={idx}
            className={`flex flex-col items-center cursor-pointer transition ${hoverBg} rounded px-0.5`}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            title={`${new Date(candle.timestamp).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' })}`}
          >
            {/* Hover tooltip */}
            {hoveredIdx === idx && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 whitespace-nowrap z-10 pointer-events-none">
                <div>O: {candle.open.toFixed(2)}</div>
                <div>H: {candle.high.toFixed(2)}</div>
                <div>L: {candle.low.toFixed(2)}</div>
                <div>C: {candle.close.toFixed(2)}</div>
              </div>
            )}

            {/* Candlestick SVG */}
            <svg width="12" height={candleHeight} viewBox={`0 0 12 ${candleHeight}`} className="relative z-0">
              {/* Wick line */}
              <line
                x1="6"
                y1={wickTop}
                x2="6"
                y2={wickBottom}
                stroke="currentColor"
                strokeWidth="0.8"
                className={candleColor}
                opacity="0.6"
              />

              {/* Body rectangle */}
              <rect
                x="2"
                y={bodyTopPx}
                width="8"
                height={bodyHeightPx}
                fill="currentColor"
                className={candleColor}
                opacity={hoveredIdx === idx ? '0.9' : '0.7'}
              />
              {!isBullish && (
                <rect
                  x="2"
                  y={bodyTopPx}
                  width="8"
                  height={bodyHeightPx}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className={candleColor}
                  opacity="0.5"
                />
              )}
            </svg>

            {/* Date label (visible on first or every other candle on small screens) */}
            {idx === 0 || idx === displayCandles.length - 1 ? (
              <div className="text-xs text-gray-600 mt-0.5">
                {new Date(candle.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});

TrendCandles.displayName = 'TrendCandles';
