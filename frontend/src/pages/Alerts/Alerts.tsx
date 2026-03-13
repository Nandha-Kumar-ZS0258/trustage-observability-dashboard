import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertOctagon } from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useSlaSummary, useSlaBreaches, useErrorSummary, useRetryRuns, useFailedRuns } from '../../hooks/useAlerts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/EmptyState';

const PIE_COLORS = ['#10b981', '#ef4444'];

export default function Alerts() {
  const navigate = useNavigate();
  const { data: slaSummary, isLoading: loadSla } = useSlaSummary();
  const { data: breaches,   isLoading: loadBr  } = useSlaBreaches();
  const { data: errors,     isLoading: loadErr } = useErrorSummary();
  const { data: retries,    isLoading: loadRet } = useRetryRuns();
  const { data: failed } = useFailedRuns();

  const slaPieData = slaSummary ? [
    { name: 'Met',     value: slaSummary.slaMetCount    },
    { name: 'Breached', value: slaSummary.slaBreachCount },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Alerts & SLA</h1>
        <p className="text-xs text-gray-500 mt-0.5">SLA compliance, errors, and failed feeds</p>
      </div>

      {/* Failed runs tray */}
      {failed && failed.length > 0 && (
        <div className="card border-red-500/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-white">
              Failed Feeds Pending Action ({failed.length})
            </h2>
          </div>
          <div className="space-y-2">
            {failed.map(f => (
              <div
                key={f.correlationId}
                onClick={() => navigate(`/runs/${f.correlationId}`)}
                className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 cursor-pointer hover:bg-red-500/15 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-mono text-red-300 mr-2">{f.cuId}</span>
                  <span className="text-xs text-gray-400">{f.blobName ?? '—'}</span>
                </div>
                <div className="text-xs text-right shrink-0">
                  <p className="text-red-400 font-medium">{f.errorCode ?? 'UNKNOWN'}</p>
                  <p className="text-gray-500">{format(new Date(f.timestamp), 'MMM d HH:mm')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SLA Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card">
          <h2 className="text-sm font-semibold text-white mb-4">SLA Summary (This Month)</h2>
          {loadSla ? <LoadingSpinner /> : slaSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Total Feeds',    slaSummary.totalRunsThisMonth.toLocaleString()],
                ['SLA Met',       `${slaSummary.slaMetCount.toLocaleString()} (${slaSummary.slaMetPercent.toFixed(1)}%)`],
                ['SLA Breached',  `${slaSummary.slaBreachCount.toLocaleString()} (${slaSummary.slaBreachPercent.toFixed(1)}%)`],
                ['Avg Duration',  slaSummary.avgDurationMs != null ? `${Math.round(slaSummary.avgDurationMs).toLocaleString()}ms` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-lg font-bold text-white mt-1">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">SLA Met vs Breached</h2>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={slaPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={40} outerRadius={60} paddingAngle={3}>
                {slaPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SLA breach log */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">SLA Breach Log</h2>
        {loadBr ? <LoadingSpinner /> : !breaches?.length ? <EmptyState message="No SLA breaches" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['CU', 'File', 'Duration', 'Threshold', 'Overage', 'Time'].map(h => (
                    <th key={h} className="pb-2 pr-4 text-xs text-gray-500 font-medium text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {breaches.map(b => (
                  <tr
                    key={b.correlationId}
                    onClick={() => navigate(`/runs/${b.correlationId}`)}
                    className="table-row-hover"
                  >
                    <td className="py-2 pr-4 text-xs font-mono text-gray-300">{b.cuId}</td>
                    <td className="py-2 pr-4 text-xs text-gray-400 truncate max-w-[140px]">{b.blobName ?? '—'}</td>
                    <td className="py-2 pr-4 text-xs text-red-400 tabular-nums font-medium">
                      {b.durationMs?.toLocaleString()}ms
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-500 tabular-nums">
                      {b.thresholdMs?.toLocaleString()}ms
                    </td>
                    <td className="py-2 pr-4">
                      <span className="badge bg-red-500/15 text-red-400 text-[10px]">
                        +{b.overageMs?.toLocaleString()}ms
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(b.timestamp), 'MMM d, HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error summary */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Error Summary by Code</h2>
          {loadErr ? <LoadingSpinner /> : !errors?.length ? <EmptyState message="No errors" /> : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={errors.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="errorCode" width={80}
                    tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  />
                  <Bar dataKey="count" fill="#ef4444" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <table className="w-full text-sm mt-4">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Code', 'Count', 'Affected CUs', 'Last Seen'].map(h => (
                      <th key={h} className="pb-2 pr-3 text-xs text-gray-500 font-medium text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {errors.map(e => (
                    <tr key={e.errorCode}>
                      <td className="py-2 pr-3 text-xs font-mono text-gray-300">{e.errorCode}</td>
                      <td className="py-2 pr-3"><span className="badge bg-red-500/15 text-red-400 text-[10px]">{e.count}</span></td>
                      <td className="py-2 pr-3 text-xs text-gray-400">{e.affectedCus}</td>
                      <td className="py-2 text-xs text-gray-500">
                        {e.lastSeen ? format(new Date(e.lastSeen), 'MMM d') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Retry analysis */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Retry Analysis</h2>
          {loadRet ? <LoadingSpinner /> : !retries?.length ? <EmptyState message="No retries recorded" /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['CU', 'File', 'Retries', 'Failed Stage', 'Time'].map(h => (
                    <th key={h} className="pb-2 pr-4 text-xs text-gray-500 font-medium text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {retries.map(r => (
                  <tr
                    key={r.correlationId}
                    onClick={() => navigate(`/runs/${r.correlationId}`)}
                    className="table-row-hover"
                  >
                    <td className="py-2 pr-4 text-xs font-mono text-gray-300">{r.cuId}</td>
                    <td className="py-2 pr-4 text-xs text-gray-400 truncate max-w-[120px]">{r.blobName ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <span className="badge bg-amber-500/15 text-amber-400 text-[10px]">
                        {r.retryAttemptNumber}x
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-400">{r.failedStage ?? '—'}</td>
                    <td className="py-2 text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(r.timestamp), 'MMM d, HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
