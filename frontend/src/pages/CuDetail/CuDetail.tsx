import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import {
  useCuSummary, useCuDurationTrend, useCuDailyVolume,
  useCuValidationTrend, useCuStepTimingTrend, useCuErrorHistory,
} from '../../hooks/useCuDetail';
import { useCuFleet } from '../../hooks/useProgramme';
import { useExceptions } from '../../hooks/useExceptions';
import { useFeedList } from '../../hooks/useFeedHistory';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { DeliveryGantt } from '../TodaysFeeds/DeliveryGantt';
import { FeedDetail } from '../FeedHistory/FeedDetail/FeedDetail';
import type { FeedStatus, LifecycleState } from '../../types/programme';

const DAYS_OPTIONS = [30, 60, 90] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function lifecyclePillClasses(state: LifecycleState): string {
  switch (state) {
    case 'BAU':                 return 'bg-green-900/40 text-green-400 border border-green-700/40';
    case 'Onboarding':          return 'bg-blue-900/40 text-blue-400 border border-blue-700/40';
    case 'Ready for First Feed': return 'bg-amber-900/40 text-amber-400 border border-amber-700/40';
  }
}

function statusPillClasses(status: FeedStatus): string {
  switch (status) {
    case 'Delivered':  return 'bg-green-900/40 text-green-400';
    case 'Failed':     return 'bg-red-900/40 text-red-400';
    case 'Partial':    return 'bg-amber-900/40 text-amber-400';
    case 'InProgress': return 'bg-blue-900/40 text-blue-400';
    default:           return 'bg-gray-800 text-gray-400';
  }
}

function scoreColour(score: number | null): string {
  if (score == null) return 'text-gray-500';
  if (score >= 95)   return 'text-green-400';
  if (score >= 80)   return 'text-amber-400';
  return 'text-red-400';
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

// ── CU-scoped exception banner ────────────────────────────────────────────────

function CuExceptionBanner({ cuId }: { cuId: string }) {
  const { data: exceptions = [] } = useExceptions({ cuId, status: 'unresolved' });
  if (!exceptions.length) return null;
  const count = exceptions.length;
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-5 text-sm
                 bg-red-950/50 border border-red-900/50 border-l-4 border-l-red-500"
      role="alert"
    >
      <span className="shrink-0 text-base" aria-hidden="true">🔴</span>
      <span className="flex-1 text-red-300 font-medium">
        {count} active feed {count === 1 ? 'exception' : 'exceptions'} for this CU
        partner — unresolved
      </span>
      <a
        href="/exceptions"
        className="shrink-0 text-red-400 hover:text-red-200 font-semibold transition-colors"
      >
        View Exceptions →
      </a>
    </div>
  );
}

// ── Recharts tooltip style (shared) ──────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1f2937', border: '1px solid #374151', borderRadius: 8 },
  labelStyle:   { color: '#9ca3af' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CuDetail() {
  const { cuId } = useParams<{ cuId: string }>();
  const [days, setDays]                 = useState<30 | 60 | 90>(30);
  const [selectedFeedRefId, setFeedRef] = useState<string | null>(null);
  const id = cuId ?? '';

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: summary, isLoading }  = useCuSummary(id);
  const { data: durationTrend }       = useCuDurationTrend(id, days);
  const { data: dailyVolume }         = useCuDailyVolume(id);
  const { data: valTrend }            = useCuValidationTrend(id);
  const { data: stepTimingTrend }     = useCuStepTimingTrend(id);
  const { data: errorHistory }        = useCuErrorHistory(id);
  const { data: fleet }               = useCuFleet({});
  const { data: recentFeeds = [] }    = useFeedList({ cuId: id });

  if (isLoading) return <div className="p-6"><LoadingSpinner /></div>;
  if (!summary)  return <div className="p-6 text-gray-400 text-sm">CU not found.</div>;

  const fleetRow     = fleet?.find(row => row.cuId === id);
  const cuName       = fleetRow?.cuName ?? id;
  const slaThreshold = durationTrend?.find(d => d.slaThresholdMs != null)?.slaThresholdMs;
  const avgDurSecs   = summary.avgDurationMs != null
    ? `${(summary.avgDurationMs / 1000).toFixed(1)}s`
    : '—';
  const deliveredCount = Math.round(summary.totalRuns * summary.successRate / 100);

  return (
    <div className="p-6 space-y-5">

      {/* ── CU-scoped exception banner ─────────────────────────────────────── */}
      <CuExceptionBanner cuId={id} />

      {/* ── Breadcrumbs ─────────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        <Link to="/" className="text-blue-400 hover:text-blue-300 transition-colors">
          CU Programme View
        </Link>
        <span className="text-gray-600">/</span>
        <span className="text-gray-300">{cuName}</span>
      </nav>

      {/* ── CU Header — full-width navy bar ────────────────────────────────── */}
      <div className="bg-[#0F2744] rounded-xl px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">
          CU Detail
        </p>
        <h1 className="text-[22px] font-extrabold text-white mb-3 leading-tight">
          {cuName}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
          {/* Lifecycle State pill */}
          {fleetRow?.lifecycleState && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold
                          px-2.5 py-0.5 rounded-full ${lifecyclePillClasses(fleetRow.lifecycleState)}`}
            >
              ● {fleetRow.lifecycleState}
            </span>
          )}

          {/* Core Banking Platform */}
          {fleetRow?.coreBankingPlatform && (
            <span className="text-[12px] text-white/60">{fleetRow.coreBankingPlatform}</span>
          )}

          {/* CU Connector ID — replaces old "Adapter ID" label */}
          {summary.adapterId && (
            <span className="text-[12px] text-white/60">
              CU Connector ID:{' '}
              <span className="font-mono text-white/80">{summary.adapterId}</span>
            </span>
          )}

          {/* Onboarding date */}
          {(fleetRow?.createdAt ?? summary.firstFileReceived) && (
            <span className="text-[12px] text-white/60">
              Onboarded:{' '}
              {format(
                parseISO(fleetRow?.createdAt ?? summary.firstFileReceived!),
                'MMM d, yyyy',
              )}
            </span>
          )}

          {/* Assigned Engineer */}
          {fleetRow?.assignedEngineer && (
            <span className="text-[12px] text-white/60">
              Engineer: {fleetRow.assignedEngineer}
            </span>
          )}

          {/* Environment */}
          <span className="text-[12px] text-white/60">Production</span>
        </div>
      </div>

      {/* ── Summary Stats — four cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          {
            label:  'Total Feeds Delivered',
            value:  summary.totalRuns.toLocaleString(),
            sub:    'All time',
            accent: 'bg-teal-500',
          },
          {
            label:  'Successful Delivery Rate',
            value:  `${summary.successRate.toFixed(1)}%`,
            sub:    `${deliveredCount} of ${summary.totalRuns} feeds clean`,
            accent: 'bg-green-500',
          },
          {
            label:  'Avg. Delivery Duration',
            value:  avgDurSecs,
            sub:    'Last 30 feeds',
            accent: 'bg-blue-500',
          },
          {
            label:  'Member Records Written to TruStage Standard',
            value:  formatCompact(summary.totalRowsProcessed),
            sub:    'All time',
            accent: 'bg-gray-500',
          },
        ]).map(({ label, value, sub, accent }) => (
          <div key={label} className="card relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${accent}`} />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2 leading-snug">
              {label}
            </p>
            <p className="text-3xl font-bold text-white leading-none mb-1">{value}</p>
            <p className="text-xs text-gray-500">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Charts 2×2 ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Delivery Duration Trend */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Delivery Duration Trend</h2>
            <div className="flex gap-1">
              {DAYS_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                    days === d ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={durationTrend} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={d => format(new Date(d), 'MMM d')}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(1)}s`}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v: number) => [`${(v / 1000).toFixed(1)}s`, 'Feed Duration']}
                labelFormatter={d => format(new Date(d), 'MMM d HH:mm')}
              />
              {slaThreshold && (
                <ReferenceLine
                  y={slaThreshold} stroke="#ef4444" strokeDasharray="4 4"
                  label={{ value: 'SLA', fill: '#ef4444', fontSize: 10 }}
                />
              )}
              <Line
                type="monotone" dataKey="durationMs"
                stroke="#3b82f6" dot={false} strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Data Alignment Score Over Time */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">
            Data Alignment Score Over Time
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={valTrend} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={d => format(new Date(d), 'MMM d')}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v: number) => [`${v}%`, 'Data Alignment Score']}
                labelFormatter={d => format(new Date(d), 'MMM d HH:mm')}
              />
              <ReferenceLine
                y={95} stroke="#ef4444" strokeDasharray="4 4"
                label={{ value: '95%', fill: '#ef4444', fontSize: 10 }}
              />
              <Line
                type="monotone" dataKey="schemaMatchScore"
                stroke="#10b981" dot={false} strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Step Timing Trend — stacked area, last 30 feeds */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Step Timing Trend</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart
              data={stepTimingTrend ?? []}
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={d => format(new Date(d), 'MMM d')}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(1)}s`}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v: number, name: string) => [
                  `${(v / 1000).toFixed(2)}s`, name,
                ]}
                labelFormatter={d => format(new Date(d), 'MMM d HH:mm')}
              />
              <Legend
                iconType="square" iconSize={8}
                wrapperStyle={{ fontSize: 10, color: '#9ca3af' }}
              />
              <Area stackId="1" type="monotone" dataKey="receiveCuFileMs"
                name="Receive CU File"
                stroke="#1A6DB5" fill="#1A6DB5" fillOpacity={0.85} />
              <Area stackId="1" type="monotone" dataKey="dataValidationMs"
                name="Data Validation Check"
                stroke="#0E7490" fill="#0E7490" fillOpacity={0.85} />
              <Area stackId="1" type="monotone" dataKey="applyStandardisationMs"
                name="Apply Standardisation Rules"
                stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.85} />
              <Area stackId="1" type="monotone" dataKey="standardiseTransformMs"
                name="Standardise & Transform"
                stroke="#D97706" fill="#D97706" fillOpacity={0.85} />
              <Area stackId="1" type="monotone" dataKey="writeToStandardMs"
                name="Write to TruStage Standard"
                stroke="#16A34A" fill="#16A34A" fillOpacity={0.85} />
            </AreaChart>
          </ResponsiveContainer>
          {(!stepTimingTrend || stepTimingTrend.length === 0) && (
            <p className="text-xs text-gray-600 text-center mt-1">
              No step timing data yet
            </p>
          )}
        </div>

        {/* Member Records Volume Trend */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">
            Member Records Volume Trend
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={dailyVolume}
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={d => format(new Date(d), 'MMM d')}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                yAxisId="records" orientation="left"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
              />
              <YAxis
                yAxisId="feeds" orientation="right"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                labelFormatter={d => format(new Date(d), 'MMM d')}
              />
              <Legend
                iconType="circle" iconSize={8}
                wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
              />
              <Bar
                yAxisId="records" dataKey="totalRows"
                name="Member Records" fill="#3b82f6" radius={[3, 3, 0, 0]}
              />
              <Bar
                yAxisId="feeds" dataKey="fileCount"
                name="Feed Deliveries" fill="#8b5cf6" radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Today's Delivery Gantt — scoped to this CU ────────────────────── */}
      <DeliveryGantt cuId={id} />

      {/* ── Recent Feeds ──────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Recent Feeds</h2>
        {recentFeeds.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No feeds found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  {[
                    'Date', 'Duration', 'Member Records',
                    'Records Rejected', 'Data Alignment Score', 'Status',
                  ].map(h => (
                    <th
                      key={h}
                      className="pb-2.5 pr-4 text-xs text-gray-500 font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {recentFeeds.slice(0, 20).map(feed => (
                  <tr
                    key={feed.feedReferenceId}
                    onClick={() => setFeedRef(feed.feedReferenceId)}
                    className="table-row-hover cursor-pointer"
                  >
                    {/* Date */}
                    <td className="py-2.5 pr-4 text-gray-400 text-xs whitespace-nowrap">
                      {format(new Date(feed.feedStarted), 'MMM d, yyyy HH:mm')}
                    </td>
                    {/* Duration */}
                    <td className="py-2.5 pr-4 text-gray-300 text-xs tabular-nums whitespace-nowrap">
                      {feed.totalDurationMs != null
                        ? `${(feed.totalDurationMs / 1000).toFixed(1)}s`
                        : '—'}
                    </td>
                    {/* Member Records */}
                    <td className="py-2.5 pr-4 text-gray-300 text-xs tabular-nums">
                      {feed.memberRecordsProcessed?.toLocaleString() ?? '—'}
                    </td>
                    {/* Records Rejected */}
                    <td className="py-2.5 pr-4 text-xs tabular-nums">
                      <span
                        className={
                          (feed.recordsRejected ?? 0) > 0
                            ? 'text-red-400'
                            : 'text-green-500'
                        }
                      >
                        {feed.recordsRejected?.toLocaleString() ?? '0'}
                      </span>
                    </td>
                    {/* Data Alignment Score */}
                    <td className="py-2.5 pr-4 text-xs tabular-nums">
                      <span className={scoreColour(feed.dataAlignmentScore)}>
                        {feed.dataAlignmentScore != null
                          ? `${feed.dataAlignmentScore.toFixed(1)}%`
                          : '—'}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="py-2.5">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full
                                    ${statusPillClasses(feed.status)}`}
                      >
                        {feed.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Feed Exception History (existing — kept) ──────────────────────── */}
      {errorHistory && errorHistory.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Feed Exception History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="pb-2 text-xs text-gray-500 text-left font-medium">
                    Exception Code
                  </th>
                  <th className="pb-2 text-xs text-gray-500 text-right font-medium">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {errorHistory.map(e => (
                  <tr key={e.errorCode}>
                    <td className="py-2 text-sm text-gray-300 font-mono">{e.errorCode}</td>
                    <td className="py-2 text-sm text-right tabular-nums">
                      <span className="badge bg-red-500/15 text-red-400">{e.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Feed Detail slide-over ─────────────────────────────────────────── */}
      <FeedDetail
        feedReferenceId={selectedFeedRefId}
        onClose={() => setFeedRef(null)}
      />
    </div>
  );
}
