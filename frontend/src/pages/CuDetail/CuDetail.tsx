import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine, BarChart, Bar, Legend,
} from 'recharts';
import {
  useCuSummary, useCuDurationTrend, useCuDailyVolume,
  useCuValidationTrend, useCuRecentRuns, useCuErrorHistory,
} from '../../hooks/useCuDetail';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { RunTable } from '../RunExplorer/RunTable';

const DAYS_OPTIONS = [30, 60, 90] as const;

export default function CuDetail() {
  const { cuId } = useParams<{ cuId: string }>();
  const navigate = useNavigate();
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const id = cuId ?? '';

  const { data: summary, isLoading } = useCuSummary(id);
  const { data: durationTrend } = useCuDurationTrend(id, days);
  const { data: dailyVolume }   = useCuDailyVolume(id);
  const { data: valTrend }      = useCuValidationTrend(id);
  const { data: recentRuns }    = useCuRecentRuns(id);
  const { data: errorHistory }  = useCuErrorHistory(id);

  if (isLoading) return <div className="p-6"><LoadingSpinner /></div>;
  if (!summary)  return <div className="p-6 text-gray-400 text-sm">CU not found.</div>;

  const slaThreshold = durationTrend?.find(d => d.slaThresholdMs != null)?.slaThresholdMs;

  return (
    <div className="p-6 space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />Back
      </button>

      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white">{summary.cuId}</h1>
        {summary.adapterId && <p className="text-xs text-gray-500 mt-0.5 font-mono">{summary.adapterId}</p>}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ['Total Runs',     summary.totalRuns.toLocaleString()],
          ['Success Rate',   `${summary.successRate.toFixed(1)}%`],
          ['Avg Duration',   summary.avgDurationMs != null ? `${Math.round(summary.avgDurationMs).toLocaleString()}ms` : '—'],
          ['Total Rows',     summary.totalRowsProcessed.toLocaleString()],
          ['SLA Breaches',   summary.slaBreachCount.toLocaleString()],
          ['First File',     summary.firstFileReceived ? format(new Date(summary.firstFileReceived), 'MMM d yyyy') : '—'],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Duration trend */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Run Duration Trend</h2>
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
            <XAxis dataKey="date" tickFormatter={d => format(new Date(d), 'MMM d')}
              tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => `${(v/1000).toFixed(1)}s`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(v: number) => [`${v.toLocaleString()}ms`, 'Duration']}
              labelFormatter={d => format(new Date(d), 'MMM d HH:mm')}
            />
            {slaThreshold && (
              <ReferenceLine y={slaThreshold} stroke="#ef4444" strokeDasharray="4 4"
                label={{ value: 'SLA', fill: '#ef4444', fontSize: 10 }} />
            )}
            <Line type="monotone" dataKey="durationMs" stroke="#3b82f6" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Daily volume */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Daily File Volume (30 days)</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dailyVolume} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="date" tickFormatter={d => format(new Date(d), 'MMM d')}
              tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="files" orientation="left" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="rows" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => v.toLocaleString()} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelFormatter={d => format(new Date(d), 'MMM d')}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            <Bar yAxisId="files" dataKey="fileCount" name="Files" fill="#8b5cf6" radius={[3,3,0,0]} />
            <Bar yAxisId="rows"  dataKey="totalRows"  name="Rows"  fill="#3b82f6" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Validation trend */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Schema Match Score Over Time</h2>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={valTrend} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="date" tickFormatter={d => format(new Date(d), 'MMM d')}
              tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => [`${v}%`, 'Schema Score']}
              labelFormatter={d => format(new Date(d), 'MMM d HH:mm')}
            />
            <ReferenceLine y={95} stroke="#ef4444" strokeDasharray="4 4"
              label={{ value: '95%', fill: '#ef4444', fontSize: 10 }} />
            <Line type="monotone" dataKey="schemaMatchScore" stroke="#10b981" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent runs */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Recent Runs</h2>
        <RunTable runs={recentRuns ?? []} />
      </div>

      {/* Error history */}
      {errorHistory && errorHistory.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Error History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="pb-2 text-xs text-gray-500 text-left font-medium">Error Code</th>
                  <th className="pb-2 text-xs text-gray-500 text-right font-medium">Count</th>
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
    </div>
  );
}
