import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { api, type InstrumentSearchRequest } from '../services/api';
import {
  formatCompactNumber,
  formatPercent,
  formatPrice,
} from '../utils/formatters';

type SortDirection = 'asc' | 'desc';

const PAGE_SIZES = [20, 50, 100];

interface StockFilters {
  search: string;
  exchange: string;
  sector: string;
  industry: string;
  instrumentType: string;
  derivativesEnabled: '' | 'true' | 'false';
  trend: string;
  minSetupScore: string;
  maxSetupScore: string;
  minAdx: string;
  rsiBelow: string;
  rsiAbove: string;
  minMarketCap: string;
  maxMarketCap: string;
  minChangePercent: string;
  maxChangePercent: string;
  hasRecommendation: '' | 'true' | 'false';
}

const DEFAULT_FILTERS: StockFilters = {
  search: '',
  exchange: '',
  sector: '',
  industry: '',
  instrumentType: '',
  derivativesEnabled: '',
  trend: '',
  minSetupScore: '',
  maxSetupScore: '',
  minAdx: '',
  rsiBelow: '',
  rsiAbove: '',
  minMarketCap: '',
  maxMarketCap: '',
  minChangePercent: '',
  maxChangePercent: '',
  hasRecommendation: '',
};

export const StockExplorer = () => {
  const [filters, setFilters] = useState<StockFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(true);
  const [sortBy, setSortBy] = useState('setupScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const request = useMemo<InstrumentSearchRequest>(
    () => ({
      search: filters.search || undefined,
      exchange: filters.exchange || undefined,
      sector: filters.sector || undefined,
      industry: filters.industry || undefined,
      instrumentType: filters.instrumentType || undefined,
      derivativesEnabled:
        filters.derivativesEnabled === ''
          ? undefined
          : filters.derivativesEnabled === 'true',
      trend: filters.trend || undefined,
      minSetupScore: filters.minSetupScore === '' ? undefined : Number(filters.minSetupScore),
      maxSetupScore: filters.maxSetupScore === '' ? undefined : Number(filters.maxSetupScore),
      minAdx: filters.minAdx === '' ? undefined : Number(filters.minAdx),
      rsiBelow: filters.rsiBelow === '' ? undefined : Number(filters.rsiBelow),
      rsiAbove: filters.rsiAbove === '' ? undefined : Number(filters.rsiAbove),
      minMarketCap: filters.minMarketCap === '' ? undefined : Number(filters.minMarketCap),
      maxMarketCap: filters.maxMarketCap === '' ? undefined : Number(filters.maxMarketCap),
      minChangePercent:
        filters.minChangePercent === '' ? undefined : Number(filters.minChangePercent),
      maxChangePercent:
        filters.maxChangePercent === '' ? undefined : Number(filters.maxChangePercent),
      hasRecommendation:
        filters.hasRecommendation === ''
          ? undefined
          : filters.hasRecommendation === 'true',
      priceTimeframe: '1D',
      scanTimeframe: 15,
      sortBy,
      sortDirection,
      page,
      pageSize,
    }),
    [filters, page, pageSize, sortBy, sortDirection]
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['instrument-search', request],
    queryFn: () => api.instruments.search(request),
    placeholderData: (previous) => previous,
  });

  const activeFilterCount = Object.values(filters).filter((value) => value !== '').length;

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const updateFilter = <K extends keyof StockFilters>(key: K, value: StockFilters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSortBy('setupScore');
    setSortDirection('desc');
    setPage(1);
    setPageSize(20);
  };

  const paginationStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const paginationEnd = Math.min(page * pageSize, totalCount);

  const visiblePageNumbers = (() => {
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, page - half);
    const end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  })();

  const renderSortCaret = (column: string) => {
    if (sortBy !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const maxPageDisabled = page >= totalPages;

  const getTrendBadgeLabel = (trend?: string) => {
    if (!trend) return 'NONE';
    return trend.toUpperCase();
  };

  const getTrendBadgeClass = (trend?: string) => {
    const value = (trend ?? 'NONE').toUpperCase();
    if (value === 'BULLISH') {
      return 'text-green-400 bg-green-500/10 border-green-500/20';
    }
    if (value === 'BEARISH') {
      return 'text-red-400 bg-red-500/10 border-red-500/20';
    }
    return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  };

  const filterInputClass =
    'w-full bg-[#0a0a0f]/70 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/70';

  const filterLabelClass = 'text-xs text-gray-500 mb-1 block';

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Stock Explorer</h1>
          <p className="text-gray-400">Discover and analyze trading opportunities</p>
        </div>
        <button
          onClick={() => setShowFilters((previous) => !previous)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:text-white hover:border-indigo-500/50 transition"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-indigo-500/30 px-2 py-0.5 text-xs text-indigo-300">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-5 mb-6">
        <label className={filterLabelClass}>Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Search by symbol or company name..."
            className="w-full bg-[#0a0a0f]/70 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
          />
        </div>

        {showFilters && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              <div>
                <label className={filterLabelClass}>Exchange</label>
                <select
                  value={filters.exchange}
                  onChange={(event) => updateFilter('exchange', event.target.value)}
                  className={filterInputClass}
                >
                  <option value="">All</option>
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>

              <div>
                <label className={filterLabelClass}>Instrument Type</label>
                <select
                  value={filters.instrumentType}
                  onChange={(event) => updateFilter('instrumentType', event.target.value)}
                  className={filterInputClass}
                >
                  <option value="">All</option>
                  <option value="STOCK">STOCK</option>
                  <option value="INDEX">INDEX</option>
                </select>
              </div>

              <div>
                <label className={filterLabelClass}>Sector</label>
                <input
                  type="text"
                  value={filters.sector}
                  onChange={(event) => updateFilter('sector', event.target.value)}
                  placeholder="Banking, IT..."
                  className={filterInputClass}
                />
              </div>

              <div>
                <label className={filterLabelClass}>Industry</label>
                <input
                  type="text"
                  value={filters.industry}
                  onChange={(event) => updateFilter('industry', event.target.value)}
                  placeholder="Private Banks..."
                  className={filterInputClass}
                />
              </div>

              <div>
                <label className={filterLabelClass}>Trend</label>
                <select
                  value={filters.trend}
                  onChange={(event) => updateFilter('trend', event.target.value)}
                  className={filterInputClass}
                >
                  <option value="">All</option>
                  <option value="BULLISH">Bullish</option>
                  <option value="BEARISH">Bearish</option>
                  <option value="NONE">None / Sideways</option>
                </select>
              </div>

              <div>
                <label className={filterLabelClass}>Has Recommendation</label>
                <select
                  value={filters.hasRecommendation}
                  onChange={(event) =>
                    updateFilter(
                      'hasRecommendation',
                      event.target.value as '' | 'true' | 'false'
                    )
                  }
                  className={filterInputClass}
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className={filterLabelClass}>F&O Enabled</label>
                <select
                  value={filters.derivativesEnabled}
                  onChange={(event) =>
                    updateFilter(
                      'derivativesEnabled',
                      event.target.value as '' | 'true' | 'false'
                    )
                  }
                  className={filterInputClass}
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className={filterLabelClass}>Min Score</label>
                <input
                  type="number"
                  value={filters.minSetupScore}
                  onChange={(event) => updateFilter('minSetupScore', event.target.value)}
                  placeholder="70"
                  className={filterInputClass}
                />
              </div>

              <div>
                <label className={filterLabelClass}>Max Score</label>
                <input
                  type="number"
                  value={filters.maxSetupScore}
                  onChange={(event) => updateFilter('maxSetupScore', event.target.value)}
                  placeholder="100"
                  className={filterInputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mt-4">
              <div>
                <label className={filterLabelClass}>Min ADX</label>
                <input
                  type="number"
                  value={filters.minAdx}
                  onChange={(event) => updateFilter('minAdx', event.target.value)}
                  placeholder="25"
                  className={filterInputClass}
                />
              </div>
              <div>
                <label className={filterLabelClass}>RSI Below</label>
                <input
                  type="number"
                  value={filters.rsiBelow}
                  onChange={(event) => updateFilter('rsiBelow', event.target.value)}
                  placeholder="35"
                  className={filterInputClass}
                />
              </div>
              <div>
                <label className={filterLabelClass}>RSI Above</label>
                <input
                  type="number"
                  value={filters.rsiAbove}
                  onChange={(event) => updateFilter('rsiAbove', event.target.value)}
                  placeholder="65"
                  className={filterInputClass}
                />
              </div>
              <div>
                <label className={filterLabelClass}>Min Mkt Cap</label>
                <input
                  type="number"
                  value={filters.minMarketCap}
                  onChange={(event) => updateFilter('minMarketCap', event.target.value)}
                  placeholder="1000000000"
                  className={filterInputClass}
                />
              </div>
              <div>
                <label className={filterLabelClass}>Max Mkt Cap</label>
                <input
                  type="number"
                  value={filters.maxMarketCap}
                  onChange={(event) => updateFilter('maxMarketCap', event.target.value)}
                  placeholder="1000000000000"
                  className={filterInputClass}
                />
              </div>
              <div>
                <label className={filterLabelClass}>Min Change %</label>
                <input
                  type="number"
                  step="0.1"
                  value={filters.minChangePercent}
                  onChange={(event) => updateFilter('minChangePercent', event.target.value)}
                  placeholder="-2"
                  className={filterInputClass}
                />
              </div>
              <div>
                <label className={filterLabelClass}>Max Change %</label>
                <input
                  type="number"
                  step="0.1"
                  value={filters.maxChangePercent}
                  onChange={(event) => updateFilter('maxChangePercent', event.target.value)}
                  placeholder="5"
                  className={filterInputClass}
                />
              </div>
              <div>
                <label className={filterLabelClass}>Page Size</label>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className={filterInputClass}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => {
                  updateFilter('minSetupScore', '70');
                  updateFilter('trend', 'BULLISH');
                }}
                className="text-xs rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-indigo-300 hover:bg-indigo-500/25 transition"
              >
                High Quality Momentum
              </button>
              <button
                onClick={() => {
                  updateFilter('trend', 'BULLISH');
                  updateFilter('minAdx', '20');
                }}
                className="text-xs rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-indigo-300 hover:bg-indigo-500/25 transition"
              >
                Pullback Candidates
              </button>
              <button
                onClick={() => {
                  updateFilter('derivativesEnabled', 'true');
                  updateFilter('hasRecommendation', 'true');
                }}
                className="text-xs rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-indigo-300 hover:bg-indigo-500/25 transition"
              >
                F&O with Signals
              </button>
              <button
                onClick={resetFilters}
                className="text-xs rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-red-300 hover:bg-red-500/20 transition"
              >
                Reset All
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-400">
          Showing <span className="text-white font-semibold">{paginationStart}</span>-
          <span className="text-white font-semibold">{paginationEnd}</span> of{' '}
          <span className="text-white font-semibold">{totalCount}</span>
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => handleSort('setupScore')}
            className="text-xs border border-gray-700 rounded-md px-2.5 py-1.5 text-gray-300 hover:text-white transition"
          >
            Score {renderSortCaret('setupScore')}
          </button>
          <button
            onClick={() => handleSort('change')}
            className="text-xs border border-gray-700 rounded-md px-2.5 py-1.5 text-gray-300 hover:text-white transition"
          >
            Change {renderSortCaret('change')}
          </button>
          <button
            onClick={() => handleSort('volume')}
            className="text-xs border border-gray-700 rounded-md px-2.5 py-1.5 text-gray-300 hover:text-white transition"
          >
            Volume {renderSortCaret('volume')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {Array.from({ length: pageSize }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse bg-[#0a0a0f]/30" />
            ))}
          </div>
        </div>
      ) : (
        <div
          className={`bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl overflow-hidden ${
            isFetching ? 'opacity-70' : ''
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-[#0a0a0f]/50 border-b border-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                    Symbol
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                    Price
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                    Change
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                    Trend
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                    Confidence
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                    Volume
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                    Market Cap
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                    Signal Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center text-gray-500">
                      No stocks match the current filters.
                    </td>
                  </tr>
                )}
                {items.map((stock) => (
                  <tr key={`${stock.id}-${stock.symbol}`} className="hover:bg-[#0a0a0f]/50 transition">
                    <td className="px-4 py-3">
                      <Link
                        to={`/stocks/${stock.symbol}`}
                        className="font-semibold text-white hover:text-indigo-400 transition"
                      >
                        {stock.symbol}
                      </Link>
                      <p className="text-xs text-gray-600 mt-0.5">{stock.exchange}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-200">{stock.name}</p>
                      <p className="text-xs text-gray-600">{stock.sector ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {stock.price !== undefined ? formatPrice(stock.price) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          (stock.changePercent ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }
                      >
                        {formatPercent(stock.changePercent)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded border ${getTrendBadgeClass(stock.trend)}`}
                      >
                        {getTrendBadgeLabel(stock.trend)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {stock.setupScore !== undefined ? stock.setupScore : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {stock.volume !== undefined ? formatCompactNumber(stock.volume) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {stock.marketCap !== undefined ? formatCompactNumber(stock.marketCap) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="space-y-0.5">
                        <p className="text-gray-300">
                          Entry: {stock.entryPrice !== undefined ? formatPrice(stock.entryPrice) : '—'}
                        </p>
                        <p className="text-red-300">
                          SL: {stock.stopLoss !== undefined ? formatPrice(stock.stopLoss) : '—'}
                        </p>
                        <p className="text-green-300">
                          Target: {stock.exitPrice !== undefined ? formatPrice(stock.exitPrice) : '—'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Page <span className="text-white font-medium">{page}</span> of{' '}
          <span className="text-white font-medium">{totalPages}</span>
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-2 py-1.5 rounded border border-gray-700 text-gray-300 disabled:opacity-40"
          >
            First
          </button>
          <button
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            disabled={page === 1}
            className="px-2 py-1.5 rounded border border-gray-700 text-gray-300 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {visiblePageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              onClick={() => setPage(pageNumber)}
              className={`w-8 h-8 rounded border text-sm ${
                pageNumber === page
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                  : 'border-gray-700 text-gray-300'
              }`}
            >
              {pageNumber}
            </button>
          ))}

          <button
            onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
            disabled={maxPageDisabled}
            className="px-2 py-1.5 rounded border border-gray-700 text-gray-300 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={maxPageDisabled}
            className="px-2 py-1.5 rounded border border-gray-700 text-gray-300 disabled:opacity-40"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
};
