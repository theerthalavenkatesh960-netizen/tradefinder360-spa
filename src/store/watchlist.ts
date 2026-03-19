import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WatchlistState {
  symbols: string[];
  add: (symbol: string) => void;
  remove: (symbol: string) => void;
  toggle: (symbol: string) => void;
  isWatched: (symbol: string) => boolean;
  clear: () => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      symbols: [],
      add: (symbol) => {
        const current = get().symbols;
        if (!current.includes(symbol)) {
          set({ symbols: [...current, symbol] });
        }
      },
      remove: (symbol) => {
        set({ symbols: get().symbols.filter((s) => s !== symbol) });
      },
      toggle: (symbol) => {
        const current = get().symbols;
        if (current.includes(symbol)) {
          set({ symbols: current.filter((s) => s !== symbol) });
        } else {
          set({ symbols: [...current, symbol] });
        }
      },
      isWatched: (symbol) => {
        return get().symbols.includes(symbol);
      },
      clear: () => {
        set({ symbols: [] });
      },
    }),
    {
      name: 'watchlist-storage',
    }
  )
);
