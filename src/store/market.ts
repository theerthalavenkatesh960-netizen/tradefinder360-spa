import { create } from 'zustand';

interface MarketState {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null;
  lastUpdated: Date | null;
  setSentiment: (sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL') => void;
  updateTimestamp: () => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  sentiment: null,
  lastUpdated: null,
  setSentiment: (sentiment) => set({ sentiment, lastUpdated: new Date() }),
  updateTimestamp: () => set({ lastUpdated: new Date() }),
}));
