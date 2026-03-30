import { format, formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const IST_TIMEZONE = 'Asia/Kolkata';

export const formatUTCToIST = (utcTimestamp: number): string => {
  const date = new Date(utcTimestamp * 1000);
  const istDate = toZonedTime(date, IST_TIMEZONE);
  return format(istDate, 'dd MMM, HH:mm');
};

export const formatUTCToISTFull = (utcTimestamp: number): string => {
  const date = new Date(utcTimestamp * 1000);
  const istDate = toZonedTime(date, IST_TIMEZONE);
  return format(istDate, 'dd MMM yyyy, HH:mm:ss');
};

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

export const formatPercent = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-IN').format(value);
};

export const formatCompactNumber = (value: number): string => {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  } else if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`;
  } else if (value >= 1000) {
    return `₹${(value / 1000).toFixed(2)}K`;
  }
  return `₹${value.toFixed(2)}`;
};

export const formatDateIST = (dateString: string): string => {
  const date = new Date(dateString);
  const istDate = toZonedTime(date, 'Asia/Kolkata');
  return format(istDate, 'dd MMM yyyy, HH:mm:ss');
};

export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  return formatDistanceToNow(date, { addSuffix: true });
};

export const getTrendStateColor = (state: string): string => {
  switch (state) {
    case 'TRENDING_BULLISH':
    case 'PULLBACK_READY':
      return 'text-green-400 bg-green-500/10 border-green-500/20';
    case 'TRENDING_BEARISH':
      return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'SIDEWAYS':
    default:
      return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
};

export const getBiasColor = (bias: string): string => {
  switch (bias) {
    case 'BULLISH':
      return 'text-green-400 bg-green-500/10';
    case 'BEARISH':
      return 'text-red-400 bg-red-500/10';
    default:
      return 'text-gray-400 bg-gray-500/10';
  }
};

export const getSignalColor = (direction: string): string => {
  switch (direction) {
    case 'BUY':
      return 'text-green-400 bg-green-500/10 border-green-500/20';
    case 'SELL':
      return 'text-red-400 bg-red-500/10 border-red-500/20';
    default:
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
  }
};

export const getRSIZone = (rsi: number): { label: string; color: string } => {
  if (rsi >= 70) return { label: 'Overbought', color: 'text-red-400' };
  if (rsi <= 30) return { label: 'Oversold', color: 'text-green-400' };
  return { label: 'Neutral', color: 'text-gray-400' };
};

export const getADXStrength = (adx: number): { label: string; color: string } => {
  if (adx >= 50) return { label: 'Very Strong', color: 'text-green-400' };
  if (adx >= 25) return { label: 'Strong', color: 'text-blue-400' };
  if (adx >= 20) return { label: 'Moderate', color: 'text-yellow-400' };
  return { label: 'Weak', color: 'text-gray-400' };
};
