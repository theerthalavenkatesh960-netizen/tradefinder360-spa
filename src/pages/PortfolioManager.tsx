import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Play, Pause, Download, RefreshCw } from 'lucide-react';
import {
  api,
  PortfolioManagerCreateSessionRequest,
  PortfolioManagerSessionSummary,
  PortfolioManagerUpdateSessionRequest,
} from '../services/api';
import { formatPrice } from '../utils/formatters';
import { LearningPanel } from '../components/LearningPanel';
import { ConfigHistory } from '../components/ConfigHistory';

const DEFAULT_FORM: PortfolioManagerCreateSessionRequest = {
  sessionName: 'My Portfolio Session',
  budget: 1_000_000,
  riskProfile: 'balanced',
  preferredSectors: [],
  preferredThemes: [],
  autoRebalanceEnabled: false,
  maxPositions: 10,
  timeframeMinutes: 15,
  minConfidence: 60,
};

const parseCsvList = (value: string): string[] =>
  value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export const PortfolioManager = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PortfolioManagerCreateSessionRequest>(DEFAULT_FORM);
  const [sectorsInput, setSectorsInput] = useState('');
  const [themesInput, setThemesInput] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<PortfolioManagerUpdateSessionRequest>({
    sessionName: '',
    budget: 0,
    riskProfile: 'balanced',
    preferredSectors: [],
    preferredThemes: [],
    autoRebalanceEnabled: false,
    maxPositions: 10,
    timeframeMinutes: 15,
    minConfidence: 60,
  });
  const [editSectorsInput, setEditSectorsInput] = useState('');
  const [editThemesInput, setEditThemesInput] = useState('');

  const sessionsQuery = useQuery({
    queryKey: ['portfolio-manager-sessions'],
    queryFn: () => api.portfolioManager.getSessions(),
    refetchInterval: 60_000,
  });

  const selectedSession = useMemo(
    () => sessionsQuery.data?.find((x) => x.sessionId === selectedSessionId) ?? null,
    [sessionsQuery.data, selectedSessionId]
  );

  const detailQuery = useQuery({
    queryKey: ['portfolio-manager-session-detail', selectedSessionId],
    queryFn: () => api.portfolioManager.getSessionDetail(selectedSessionId as number),
    enabled: selectedSessionId !== null,
    refetchInterval: 60_000,
  });

  const newsQuery = useQuery({
    queryKey: ['portfolio-manager-session-news', selectedSessionId],
    queryFn: () => api.portfolioManager.getSessionNews(selectedSessionId as number, 24, 50),
    enabled: selectedSessionId !== null,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!selectedSessionId && sessionsQuery.data && sessionsQuery.data.length > 0) {
      setSelectedSessionId(sessionsQuery.data[0].sessionId);
    }
  }, [selectedSessionId, sessionsQuery.data]);

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    setEditForm({
      sessionName: detailQuery.data.summary.sessionName,
      budget: detailQuery.data.summary.budget,
      riskProfile: (detailQuery.data.summary.riskProfile.toLowerCase() as 'conservative' | 'balanced' | 'aggressive') ?? 'balanced',
      preferredSectors: detailQuery.data.preferredSectors,
      preferredThemes: detailQuery.data.preferredThemes,
      autoRebalanceEnabled: detailQuery.data.summary.autoRebalanceEnabled,
      maxPositions: detailQuery.data.summary.maxPositions,
      timeframeMinutes: detailQuery.data.summary.timeframeMinutes,
      minConfidence: detailQuery.data.summary.minConfidence,
    });
    setEditSectorsInput(detailQuery.data.preferredSectors.join(', '));
    setEditThemesInput(detailQuery.data.preferredThemes.join(', '));
  }, [detailQuery.data]);

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['portfolio-manager-sessions'] });
    if (selectedSessionId) {
      await queryClient.invalidateQueries({ queryKey: ['portfolio-manager-session-detail', selectedSessionId] });
      await queryClient.invalidateQueries({ queryKey: ['portfolio-manager-session-news', selectedSessionId] });
    }
  };

  const createSessionMutation = useMutation({
    mutationFn: () =>
      api.portfolioManager.createSession({
        ...form,
        preferredSectors: parseCsvList(sectorsInput),
        preferredThemes: parseCsvList(themesInput),
      }),
    onSuccess: async (created) => {
      setSelectedSessionId(created.sessionId);
      await refreshAll();
    },
  });

  const runMutation = useMutation({
    mutationFn: (sessionId: number) => api.portfolioManager.runSession(sessionId),
    onSuccess: async () => {
      await refreshAll();
    },
  });

  const startMutation = useMutation({
    mutationFn: (sessionId: number) => api.portfolioManager.startSession(sessionId),
    onSuccess: async () => {
      await refreshAll();
    },
  });

  const stopMutation = useMutation({
    mutationFn: (sessionId: number) => api.portfolioManager.stopSession(sessionId),
    onSuccess: async () => {
      await refreshAll();
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (session: PortfolioManagerSessionSummary) => {
      const blob = await api.portfolioManager.exportSessionCsv(session.sessionId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `portfolio-session-${session.sessionId}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (sessionId: number) =>
      api.portfolioManager.updateSession(sessionId, {
        ...editForm,
        preferredSectors: parseCsvList(editSectorsInput),
        preferredThemes: parseCsvList(editThemesInput),
      }),
    onSuccess: async () => {
      await refreshAll();
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (session: PortfolioManagerSessionSummary) => {
      const suggested = `${session.sessionName} Copy`;
      const cloneName = window.prompt('Enter clone session name', suggested);
      if (cloneName === null) {
        return null;
      }

      return api.portfolioManager.cloneSession(session.sessionId, { sessionName: cloneName.trim() || suggested });
    },
    onSuccess: async (cloned) => {
      if (cloned) {
        setSelectedSessionId(cloned.sessionId);
      }
      await refreshAll();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (session: PortfolioManagerSessionSummary) => {
      const confirmed = window.confirm(`Delete portfolio session \"${session.sessionName}\"? This cannot be undone.`);
      if (!confirmed) {
        return false;
      }

      await api.portfolioManager.deleteSession(session.sessionId);
      return true;
    },
    onSuccess: async (deleted) => {
      if (!deleted) {
        return;
      }

      const remaining = (sessionsQuery.data ?? []).filter((x) => x.sessionId !== selectedSessionId);
      setSelectedSessionId(remaining[0]?.sessionId ?? null);
      await refreshAll();
    },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center">
            <Briefcase className="w-8 h-8 mr-3 text-indigo-500" />
            Portfolio Manager
          </h1>
          <p className="text-gray-400">
            Define preferences, auto-build portfolio positions, run simulations, and review reasoning.
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-700 text-sm hover:bg-gray-800 transition"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Create Session</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <input
            className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-4 py-3"
            placeholder="Session name"
            value={form.sessionName}
            onChange={(e) => setForm((prev) => ({ ...prev, sessionName: e.target.value }))}
          />
          <input
            type="number"
            className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-4 py-3"
            placeholder="Budget"
            value={form.budget}
            onChange={(e) => setForm((prev) => ({ ...prev, budget: Number(e.target.value) }))}
          />
          <select
            className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-4 py-3"
            value={form.riskProfile}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                riskProfile: e.target.value as 'conservative' | 'balanced' | 'aggressive',
              }))
            }
          >
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
          <input
            className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-4 py-3"
            placeholder="Preferred sectors (comma separated)"
            value={sectorsInput}
            onChange={(e) => setSectorsInput(e.target.value)}
          />
          <input
            className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-4 py-3"
            placeholder="Preferred themes (comma separated)"
            value={themesInput}
            onChange={(e) => setThemesInput(e.target.value)}
          />
          <input
            type="number"
            className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-4 py-3"
            placeholder="Max positions"
            value={form.maxPositions}
            onChange={(e) => setForm((prev) => ({ ...prev, maxPositions: Number(e.target.value) }))}
          />
          <input
            type="number"
            className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-4 py-3"
            placeholder="Timeframe (minutes)"
            value={form.timeframeMinutes}
            onChange={(e) => setForm((prev) => ({ ...prev, timeframeMinutes: Number(e.target.value) }))}
          />
          <input
            type="number"
            className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-4 py-3"
            placeholder="Min confidence"
            value={form.minConfidence}
            onChange={(e) => setForm((prev) => ({ ...prev, minConfidence: Number(e.target.value) }))}
          />
          <label className="flex items-center gap-3 bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-4 py-3">
            <input
              type="checkbox"
              checked={form.autoRebalanceEnabled}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  autoRebalanceEnabled: e.target.checked,
                }))
              }
            />
            <span className="text-sm">Enable hourly scheduled mode</span>
          </label>
        </div>

        <div className="mt-4">
          <button
            onClick={() => createSessionMutation.mutate()}
            disabled={createSessionMutation.isLoading}
            className="px-5 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition"
          >
            {createSessionMutation.isLoading ? 'Creating...' : 'Create Portfolio Session'}
          </button>
          {createSessionMutation.error && (
            <p className="text-red-400 text-sm mt-2">{(createSessionMutation.error as Error).message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4 lg:col-span-1">
          <h3 className="text-lg font-semibold mb-3">Sessions</h3>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {(sessionsQuery.data ?? []).map((session) => (
              <button
                key={session.sessionId}
                onClick={() => setSelectedSessionId(session.sessionId)}
                className={`w-full text-left p-3 rounded-lg border transition ${
                  selectedSessionId === session.sessionId
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-gray-800 bg-[#0a0a0f]/50 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{session.sessionName}</p>
                  <span className="text-xs px-2 py-1 rounded bg-gray-800">{session.status}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{session.riskProfile} • {session.mode}</p>
                <p className="text-xs text-gray-400">Budget {formatPrice(session.budget)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-3">Session Detail</h3>
          {!selectedSession && <p className="text-gray-400">Select a session to view details.</p>}

          {selectedSession && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => runMutation.mutate(selectedSession.sessionId)}
                  disabled={runMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run Now
                </button>
                <button
                  onClick={() => startMutation.mutate(selectedSession.sessionId)}
                  disabled={startMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-60 transition"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Scheduled
                </button>
                <button
                  onClick={() => stopMutation.mutate(selectedSession.sessionId)}
                  disabled={stopMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 transition"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Stop Scheduled
                </button>
                <button
                  onClick={() => exportMutation.mutate(selectedSession)}
                  disabled={exportMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 disabled:opacity-60 transition"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </button>
                <button
                  onClick={() => cloneMutation.mutate(selectedSession)}
                  disabled={cloneMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-indigo-700 text-indigo-200 hover:bg-indigo-950/40 disabled:opacity-60 transition"
                >
                  Clone
                </button>
                <button
                  onClick={() => deleteMutation.mutate(selectedSession)}
                  disabled={deleteMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-red-700 text-red-200 hover:bg-red-950/40 disabled:opacity-60 transition"
                >
                  Delete
                </button>
              </div>

              <div className="bg-[#0a0a0f]/60 border border-gray-800 rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Session Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <input
                    className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-3 py-2"
                    placeholder="Session name"
                    value={editForm.sessionName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, sessionName: e.target.value }))}
                  />
                  <input
                    type="number"
                    className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-3 py-2"
                    placeholder="Budget"
                    value={editForm.budget}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, budget: Number(e.target.value) }))}
                  />
                  <select
                    className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-3 py-2"
                    value={editForm.riskProfile}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, riskProfile: e.target.value as 'conservative' | 'balanced' | 'aggressive' }))}
                  >
                    <option value="conservative">Conservative</option>
                    <option value="balanced">Balanced</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                  <input
                    className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-3 py-2"
                    placeholder="Preferred sectors"
                    value={editSectorsInput}
                    onChange={(e) => setEditSectorsInput(e.target.value)}
                  />
                  <input
                    className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-3 py-2"
                    placeholder="Preferred themes"
                    value={editThemesInput}
                    onChange={(e) => setEditThemesInput(e.target.value)}
                  />
                  <input
                    type="number"
                    className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-3 py-2"
                    placeholder="Max positions"
                    value={editForm.maxPositions}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, maxPositions: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-3 py-2"
                    placeholder="Timeframe minutes"
                    value={editForm.timeframeMinutes}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, timeframeMinutes: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-3 py-2"
                    placeholder="Min confidence"
                    value={editForm.minConfidence}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, minConfidence: Number(e.target.value) }))}
                  />
                  <label className="flex items-center gap-3 bg-[#0a0a0f]/50 border border-gray-800 rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={editForm.autoRebalanceEnabled}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, autoRebalanceEnabled: e.target.checked }))}
                    />
                    <span className="text-sm">Enable scheduled mode</span>
                  </label>
                </div>
                <button
                  onClick={() => updateMutation.mutate(selectedSession.sessionId)}
                  disabled={updateMutation.isLoading}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 transition"
                >
                  {updateMutation.isLoading ? 'Saving...' : 'Save Session Settings'}
                </button>
                {updateMutation.error && (
                  <p className="text-red-400 text-sm">{(updateMutation.error as Error).message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Allocated</p>
                  <p className="font-semibold">{formatPrice(selectedSession.allocatedCapital)}</p>
                </div>
                <div className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Unrealized PnL</p>
                  <p className="font-semibold">{formatPrice(selectedSession.unrealizedPnl)}</p>
                </div>
                <div className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Realized PnL</p>
                  <p className="font-semibold">{formatPrice(selectedSession.realizedPnl)}</p>
                </div>
                <div className="bg-[#0a0a0f]/50 border border-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Win Rate</p>
                  <p className="font-semibold">{selectedSession.winRatePercent.toFixed(2)}%</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="font-medium mb-2">Open Positions</h4>
                  <div className="overflow-x-auto border border-gray-800 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-[#0a0a0f]/70">
                        <tr>
                          <th className="text-left px-3 py-2">Symbol</th>
                          <th className="text-left px-3 py-2">Sector</th>
                          <th className="text-left px-3 py-2">Entry</th>
                          <th className="text-left px-3 py-2">Current</th>
                          <th className="text-left px-3 py-2">P/L%</th>
                          <th className="text-left px-3 py-2">Fusion Score</th>
                          <th className="text-left px-3 py-2">Diagnostics</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detailQuery.data?.openPositions ?? []).map((row) => (
                          <tr key={row.tradeId} className="border-t border-gray-800">
                            <td className="px-3 py-2">{row.symbol}</td>
                            <td className="px-3 py-2">{row.sector}</td>
                            <td className="px-3 py-2">{formatPrice(row.entryPrice)}</td>
                            <td className="px-3 py-2">{formatPrice(row.currentPrice)}</td>
                            <td className="px-3 py-2">{(row.pnlPercent ?? 0).toFixed(2)}%</td>
                            <td className="px-3 py-2 whitespace-nowrap">{(row.fusionScore ?? 0).toFixed(3)}</td>
                            <td className="px-3 py-2 text-xs text-gray-300 max-w-[360px]">
                              <div>
                                N {(row.fusionNewsSignal ?? 0).toFixed(2)} | T {(row.fusionTechnicalSignal ?? 0).toFixed(2)} | S {(row.fusionSectorSignal ?? 0).toFixed(2)}
                              </div>
                              <div className={row.fusionDirectionVeto ? 'text-red-300' : 'text-emerald-300'}>
                                {row.fusionDirectionVeto ? 'Directional veto: yes' : 'Directional veto: no'}
                              </div>
                              {row.fusionEvidence && <div className="text-gray-400 truncate" title={row.fusionEvidence}>{row.fusionEvidence}</div>}
                            </td>
                          </tr>
                        ))}
                        {(detailQuery.data?.openPositions ?? []).length === 0 && (
                          <tr>
                            <td className="px-3 py-3 text-gray-400" colSpan={7}>No open positions.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Closed Positions</h4>
                  <div className="overflow-x-auto border border-gray-800 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-[#0a0a0f]/70">
                        <tr>
                          <th className="text-left px-3 py-2">Symbol</th>
                          <th className="text-left px-3 py-2">Entry</th>
                          <th className="text-left px-3 py-2">Exit</th>
                          <th className="text-left px-3 py-2">PnL</th>
                          <th className="text-left px-3 py-2">Reasoning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detailQuery.data?.closedPositions ?? []).map((row) => (
                          <tr key={row.tradeId} className="border-t border-gray-800">
                            <td className="px-3 py-2">{row.symbol}</td>
                            <td className="px-3 py-2">{formatPrice(row.entryPrice)}</td>
                            <td className="px-3 py-2">{row.exitPrice ? formatPrice(row.exitPrice) : '-'}</td>
                            <td className="px-3 py-2">{row.pnl ? formatPrice(row.pnl) : '-'}</td>
                            <td className="px-3 py-2 text-gray-300 max-w-[420px] truncate" title={row.entryReasoning}>
                              {row.entryReasoning}
                            </td>
                          </tr>
                        ))}
                        {(detailQuery.data?.closedPositions ?? []).length === 0 && (
                          <tr>
                            <td className="px-3 py-3 text-gray-400" colSpan={5}>No closed positions.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">News Intelligence</h4>
                  <div className="overflow-x-auto border border-gray-800 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-[#0a0a0f]/70">
                        <tr>
                          <th className="text-left px-3 py-2">Time</th>
                          <th className="text-left px-3 py-2">Headline</th>
                          <th className="text-left px-3 py-2">Impact</th>
                          <th className="text-left px-3 py-2">Keywords</th>
                          <th className="text-left px-3 py-2">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(newsQuery.data ?? []).map((row) => (
                          <tr key={`${row.articleId}-${row.symbol}-${row.sector}`} className="border-t border-gray-800 align-top">
                            <td className="px-3 py-2 whitespace-nowrap text-gray-400">{new Date(row.publishedAt).toLocaleString()}</td>
                            <td className="px-3 py-2 max-w-[360px]">
                              <p className="font-medium">{row.headline}</p>
                              <p className="text-gray-400 text-xs mt-1">{row.summary}</p>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div>{row.direction}</div>
                              <div className="text-xs text-gray-400">score {row.impactScore.toFixed(2)} • conf {row.confidence.toFixed(2)}</div>
                              {(row.symbol || row.sector) && (
                                <div className="text-xs text-indigo-300 mt-1">{row.symbol || row.sector}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-300">{row.keywords.slice(0, 6).join(', ')}</td>
                            <td className="px-3 py-2 text-gray-400">{row.source}</td>
                          </tr>
                        ))}
                        {(newsQuery.data ?? []).length === 0 && (
                          <tr>
                            <td className="px-3 py-3 text-gray-400" colSpan={5}>No recent session-relevant news yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Portfolio Fusion Learning Section */}
      <div className="space-y-6">
        <LearningPanel onRefresh={refreshAll} />
        <ConfigHistory limit={20} />
      </div>
    </div>
  );
};
