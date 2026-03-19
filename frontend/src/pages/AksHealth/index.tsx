import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Activity, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { KpiCard } from '../../components/KpiCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/EmptyState';
import {
  useAksSummary,
  useAdaptorHealth,
  useClusterEvents,
  useEventSummary,
  useNodeHealth,
  useAdaptorHistory,
  useAdaptorEvents,
  useAdaptorRuns,
  useRunContext,
} from '../../hooks/useAksHealth';
import type { AdaptorPodHealth, ClusterEvent, AdaptorRunSummary } from '../../types/aks';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—';
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); }
  catch { return iso; }
}

// ── Badges ────────────────────────────────────────────────────────────────────

function ReasonBadge({ reason }: { reason: string }) {
  const colour =
    reason === 'OOMKilling'         ? 'bg-red-500/15 text-red-400'
    : reason === 'Unhealthy'        ? 'bg-amber-500/15 text-amber-400'
    : reason === 'FailedScheduling' ? 'bg-orange-500/15 text-orange-400'
    : reason === 'NodeNotReady'     ? 'bg-red-500/15 text-red-400'
    : 'bg-gray-500/15 text-gray-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${colour}`}>
      {reason}
    </span>
  );
}

function ReadinessBadge({ isReady }: { isReady: boolean }) {
  return isReady
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-400"><CheckCircle className="w-3 h-3" />Ready</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/15 text-red-400"><XCircle className="w-3 h-3" />Not Ready</span>;
}

function UptimeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-gray-400">—</span>;
  const colour = pct >= 95 ? 'text-emerald-500' : pct >= 80 ? 'text-amber-500' : 'text-red-500';
  return <span className={`text-sm font-semibold tabular-nums ${colour}`}>{pct.toFixed(1)}%</span>;
}

// ── Adaptor drill-down panel ──────────────────────────────────────────────────

function AdaptorDrillDown({ adaptorId }: { adaptorId: string }) {
  const { data: history, isLoading: histLoading } = useAdaptorHistory(adaptorId);
  const { data: events,  isLoading: evtLoading  } = useAdaptorEvents(adaptorId);

  return (
    <tr>
      <td colSpan={7} className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Restart trend */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Restart Trend — Last 7 Days</p>
            {histLoading
              ? <div className="h-32 flex items-center justify-center"><LoadingSpinner /></div>
              : !history?.restartTrend?.length
                ? <p className="text-xs text-gray-400 py-4">No restart data yet</p>
                : (
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={history.restartTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                        formatter={(v: number) => [v, 'Restarts']}
                        labelFormatter={l => `Day: ${l}`}
                      />
                      <Bar dataKey="restartCount" fill="#6366f1" radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
            }
          </div>

          {/* Probe failure timeline */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Probe Failures — Last 24h (hourly)</p>
            {histLoading
              ? <div className="h-32 flex items-center justify-center"><LoadingSpinner /></div>
              : !history?.probeTimeline?.length
                ? <p className="text-xs text-gray-400 py-4">No probe failures in last 24h</p>
                : (
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={history.probeTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={h => h.slice(11, 16)} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                        formatter={(v: number) => [v, 'Failures']}
                        labelFormatter={l => `Hour: ${l}`}
                      />
                      <Bar dataKey="failureCount" fill="#f59e0b" radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
            }
          </div>
        </div>

        {/* Per-adaptor events */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Recent Events — Last 24h</p>
          {evtLoading
            ? <LoadingSpinner />
            : !events?.length
              ? <p className="text-xs text-gray-400">No events for this adaptor in the last 24h</p>
              : (
                <div className="rounded border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium text-gray-500">Reason</th>
                        <th className="px-3 py-1.5 text-left font-medium text-gray-500">Object</th>
                        <th className="px-3 py-1.5 text-left font-medium text-gray-500">Count</th>
                        <th className="px-3 py-1.5 text-left font-medium text-gray-500">Last Seen</th>
                        <th className="px-3 py-1.5 text-left font-medium text-gray-500">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {events.slice(0, 20).map((evt: ClusterEvent) => (
                        <tr key={evt.id} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5"><ReasonBadge reason={evt.reason} /></td>
                          <td className="px-3 py-1.5 font-mono text-gray-600 max-w-[180px] truncate">{evt.objectName}</td>
                          <td className="px-3 py-1.5 text-gray-500">×{evt.eventCount}</td>
                          <td className="px-3 py-1.5 text-gray-400">{timeAgo(evt.lastSeen)}</td>
                          <td className="px-3 py-1.5 text-gray-500 max-w-[300px] truncate">{evt.message || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          }
        </div>
      </td>
    </tr>
  );
}

// ── Adaptor Table (expandable) ────────────────────────────────────────────────

function AdaptorTable() {
  const { data, isLoading } = useAdaptorHealth();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <LoadingSpinner />;
  if (!data?.length) return (
    <EmptyState message="No adaptor pods found. Run the SQL migration and wait for the first sync." />
  );

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className="card overflow-hidden p-0">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Pod Health</h2>
        <p className="text-xs text-gray-400 mt-0.5">Click a row to see uptime, restart trend, probe failures, and events</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-2 text-left font-medium w-6" />
            <th className="px-4 py-2 text-left font-medium">Deployment</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="px-4 py-2 text-left font-medium">Uptime 24h</th>
            <th className="px-4 py-2 text-left font-medium">Restarts</th>
            <th className="px-4 py-2 text-left font-medium">Pod</th>
            <th className="px-4 py-2 text-left font-medium">Node</th>
            <th className="px-4 py-2 text-left font-medium">Running Since</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a: AdaptorPodHealth) => {
            const isOpen = expanded === a.adaptorId;
            return (
              <>
                <tr
                  key={a.adaptorId}
                  className="border-t border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => toggle(a.adaptorId)}
                >
                  <td className="px-4 py-3 text-gray-400">
                    {isOpen
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />
                    }
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{a.adaptorId}</td>
                  <td className="px-4 py-3"><ReadinessBadge isReady={a.isReady} /></td>
                  <td className="px-4 py-3">
                    <AdaptorUptimeCell adaptorId={a.adaptorId} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={a.restartCount > 5 ? 'text-red-500 font-semibold' : 'text-gray-600'}>
                      {a.restartCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{a.podName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{a.nodeName || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{timeAgo(a.podStartTime)}</td>
                </tr>
                {isOpen && <AdaptorDrillDown key={`drill-${a.adaptorId}`} adaptorId={a.adaptorId} />}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Inline uptime % cell — fetches its own data per adaptor row
function AdaptorUptimeCell({ adaptorId }: { adaptorId: string }) {
  const { data } = useAdaptorHistory(adaptorId);
  return <UptimeBadge pct={data?.uptime?.uptimePercent ?? null} />;
}

// ── Adaptor Runs Table ────────────────────────────────────────────────────────

function RunStagesDrillDown({ batchId }: { batchId: string }) {
  const { data, isLoading } = useRunContext(batchId);
  if (isLoading) return <p className="text-xs text-gray-400 py-2">Loading stages…</p>;
  if (!data?.stages?.length) return <p className="text-xs text-gray-400 py-2">No stage data available.</p>;
  return (
    <div className="space-y-1.5">
      {data.stages.map((s, i) => {
        const stageMs = i > 0
          ? new Date(s.stageTime).getTime() - new Date(data.stages[i - 1].stageTime).getTime()
          : null;
        const failed = s.outcome === 'Failed' || s.gateResult?.includes('FAIL');
        const passed = s.outcome === 'Passed' || s.gateResult?.includes('PASS');
        return (
          <div key={i} className="flex items-start gap-3 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${failed ? 'bg-red-500' : passed ? 'bg-emerald-500' : 'bg-gray-500'}`} />
            <span className="w-36 text-gray-300 shrink-0">{s.stage}</span>
            <span className="text-gray-500 w-24 shrink-0">{format(parseISO(s.stageTime), 'HH:mm:ss.SSS')}</span>
            {stageMs !== null && <span className="text-gray-500 w-14 shrink-0">{(stageMs / 1000).toFixed(2)}s</span>}
            <span className="text-gray-400 flex flex-wrap gap-x-3">
              {s.memberCount != null && <span>{s.memberCount.toLocaleString()} members</span>}
              {s.errorCount != null && s.errorCount > 0 && <span className="text-red-400">{s.errorCount} errors</span>}
              {s.warningCount != null && s.warningCount > 0 && <span className="text-amber-400">{s.warningCount} warnings</span>}
              {s.gateResult && <span className="text-gray-300">{s.gateResult}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AdaptorRunsTable() {
  const { data, isLoading } = useAdaptorRuns(50);
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();

  if (isLoading) return <LoadingSpinner />;
  if (!data?.length) return (
    <EmptyState message="No adaptor runs recorded yet. Data appears after the first sync cycle." />
  );

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className="card overflow-hidden p-0">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Recent Adaptor Runs</h2>
        <p className="text-xs text-gray-400 mt-0.5">Click a row to see stage timeline · Click batch ID to open full run detail</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-2 text-left font-medium w-6" />
            <th className="px-4 py-2 text-left font-medium">Batch ID</th>
            <th className="px-4 py-2 text-left font-medium">CU</th>
            <th className="px-4 py-2 text-left font-medium">File</th>
            <th className="px-4 py-2 text-left font-medium">Pod</th>
            <th className="px-4 py-2 text-left font-medium">Node</th>
            <th className="px-4 py-2 text-left font-medium">Duration</th>
            <th className="px-4 py-2 text-left font-medium">Started</th>
            <th className="px-4 py-2 text-left font-medium">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {data.map((run: AdaptorRunSummary) => {
            const isOpen  = expanded === run.batchId;
            const passed  = run.finalOutcome === 'Passed';
            const failed  = run.finalOutcome === 'Failed';
            const durSec  = (run.totalDurationMs / 1000).toFixed(1);
            return (
              <>
                <tr
                  key={run.batchId}
                  className="border-t border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => toggle(run.batchId)}
                >
                  <td className="px-4 py-3 text-gray-400">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="font-mono text-xs text-blue-500 hover:text-blue-700 hover:underline"
                      onClick={e => { e.stopPropagation(); navigate(`/runs/${run.batchId}`); }}
                    >
                      {run.batchId.slice(0, 8)}…
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{run.cuId}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[160px]">
                    {run.fileName ? run.fileName.split('/').pop() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono truncate max-w-[140px]">
                    {run.podName.split('-').slice(-2).join('-')}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {run.nodeName?.split('-').slice(-1)[0] ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{durSec}s</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{timeAgo(run.runStart)}</td>
                  <td className="px-4 py-3">
                    {failed
                      ? <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium"><XCircle className="w-3.5 h-3.5" />Failed</span>
                      : passed
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium"><CheckCircle className="w-3.5 h-3.5" />Passed</span>
                        : <span className="text-xs text-gray-400">—</span>
                    }
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${run.batchId}-drill`} className="border-t border-gray-100">
                    <td colSpan={9} className="bg-gray-50 px-8 py-4">
                      <RunStagesDrillDown batchId={run.batchId} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Event Summary ─────────────────────────────────────────────────────────────

function EventSummarySection() {
  const { data, isLoading } = useEventSummary(24);
  if (isLoading) return <LoadingSpinner />;
  if (!data?.length) return null;
  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Event Summary — Last 24h</h2>
      <div className="flex flex-wrap gap-2">
        {data.map(e => (
          <div key={`${e.reason}-${e.objectKind}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
            <ReasonBadge reason={e.reason} />
            <span className="text-xs text-gray-500">{e.objectKind}</span>
            <span className="text-sm font-bold text-gray-800">{e.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Warning Events Feed ───────────────────────────────────────────────────────

function EventFeed() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading } = useClusterEvents(24);

  if (isLoading) return <LoadingSpinner />;
  if (!data?.length) return <EmptyState message="No warning events in the last 24 hours." />;

  return (
    <div className="card overflow-hidden p-0">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Warning Events</h2>
        <p className="text-xs text-gray-400 mt-0.5">Last 24 hours — newest first</p>
      </div>
      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {data.map((evt: ClusterEvent) => (
          <div key={evt.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => setExpanded(expanded === evt.id ? null : evt.id)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <ReasonBadge reason={evt.reason} />
                <span className="text-xs text-gray-500">{evt.objectKind}</span>
                <span className="text-xs font-mono text-gray-700 truncate max-w-[200px]">{evt.objectName}</span>
                {evt.namespace && <span className="text-xs text-gray-400">ns:{evt.namespace}</span>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">×{evt.eventCount}</span>
                <span className="text-xs text-gray-400">{timeAgo(evt.lastSeen)}</span>
              </div>
            </div>
            {expanded === evt.id && evt.message && (
              <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2 font-mono break-words">
                {evt.message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Node Health ───────────────────────────────────────────────────────────────

function NodeTable() {
  const { data, isLoading } = useNodeHealth();
  if (isLoading) return <LoadingSpinner />;
  if (!data?.length) return <EmptyState message="No node data available." />;
  return (
    <div className="card overflow-hidden p-0">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Node Health</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-2 text-left font-medium">Node</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="px-4 py-2 text-left font-medium">OS</th>
            <th className="px-4 py-2 text-left font-medium">Agent Version</th>
            <th className="px-4 py-2 text-left font-medium">Last Heartbeat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map(n => (
            <tr key={n.nodeName} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-gray-700">{n.nodeName}</td>
              <td className="px-4 py-3">
                {n.isOnline
                  ? <span className="inline-flex items-center gap-1 text-xs text-emerald-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Online</span>
                  : <span className="inline-flex items-center gap-1 text-xs text-red-500"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />Offline</span>
                }
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">{n.osType || '—'}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">{n.agentVersion || '—'}</td>
              <td className="px-4 py-3 text-gray-400 text-xs">{timeAgo(n.lastHeartbeat)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AksHealth() {
  const { data: kpis, isLoading: kpisLoading } = useAksSummary();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-500" />
            AKS Health
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Cluster: trustage · syncs every 2 min from Log Analytics</p>
        </div>
        <span className="text-xs text-gray-400">Auto-refreshes every 30s</span>
      </div>

      {/* KPI strip */}
      {kpisLoading ? (
        <LoadingSpinner />
      ) : kpis ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard
            label="Nodes Online"
            value={`${kpis.nodesOnline}/${kpis.nodesTotal}`}
            severity={kpis.nodesOnline === kpis.nodesTotal ? 'good' : 'critical'}
            icon={<Activity className="w-4 h-4" />}
          />
          <KpiCard
            label="Pods Ready"
            value={`${kpis.adaptorsReady}/${kpis.adaptorsTotal}`}
            severity={kpis.adaptorsReady === kpis.adaptorsTotal && kpis.adaptorsTotal > 0 ? 'good' : 'critical'}
            icon={<Server className="w-4 h-4" />}
          />
          <KpiCard
            label="Pods Running"
            value={kpis.podsRunning}
            severity="neutral"
          />
          <KpiCard
            label="Warnings / 24h"
            value={kpis.warningsLast24h}
            severity={kpis.warningsLast24h === 0 ? 'good' : kpis.warningsLast24h < 50 ? 'warning' : 'critical'}
            icon={<AlertTriangle className="w-4 h-4" />}
          />
          <KpiCard
            label="OOMKills / 24h"
            value={kpis.oomKillsLast24h}
            severity={kpis.oomKillsLast24h === 0 ? 'good' : 'critical'}
          />
          <KpiCard
            label="Total Restarts"
            value={kpis.totalRestarts}
            severity={kpis.totalRestarts === 0 ? 'good' : kpis.totalRestarts < 10 ? 'warning' : 'critical'}
          />
        </div>
      ) : null}

      {/* Adaptor health — expandable rows with drill-down charts */}
      <AdaptorTable />

      {/* Recent adaptor runs — stage timeline + deep-link to run detail */}
      <AdaptorRunsTable />

      {/* Event summary chips */}
      <EventSummarySection />

      {/* Warning events feed */}
      <EventFeed />

      {/* Node health */}
      <NodeTable />
    </div>
  );
}
