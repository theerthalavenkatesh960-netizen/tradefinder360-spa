import { create } from 'zustand';

interface BacktestUIState {
  selectedTradeId: string | null;
  hoveredTradeId: string | null;
  setSelectedTrade: (id: string | null) => void;
  setHoveredTrade: (id: string | null) => void;
  clearSelection: () => void;
}

export const useBacktestStore = create<BacktestUIState>((set) => ({
  selectedTradeId: null,
  hoveredTradeId: null,
  setSelectedTrade: (id) => set({ selectedTradeId: id }),
  setHoveredTrade: (id) => set({ hoveredTradeId: id }),
  clearSelection: () => set({ selectedTradeId: null, hoveredTradeId: null }),
}));
