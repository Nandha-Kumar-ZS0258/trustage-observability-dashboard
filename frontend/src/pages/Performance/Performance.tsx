import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  useStageDurationHeatmap, useThroughputTrend, useSlowestRuns,
  useStageSplit, useMemoryTrend,
} from '../../hooks/usePerformance';
import { LoadingSpinner } from '../../components/LoadingSpinner';

function durationColor(ms: number | null) {
  if (ms == null) return 'bg-gray-800 text-gray-600';
  if (ms < 500)   return 'bg-emerald-900/60 text-emerald-300';
  if (ms < 2000)  return 'bg-amber-900/60 text-amber-300';
  return 'bg-red-900/60 text-red-300';
}

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b'];

export default function Performance() {
  const navigate = useNavigate();
  const { data: heatmap,    isLoading: loadHeat }   = useStageDurationHeatmap();
  const { data: throughput, isLoading: loadThru }   = useThroughputTrend();
  const { data: slowest,    isLoading: loadSlow }   = useSlowestRuns();
  const { data: split,      isLoading: loadSplit }  = useStageSplit();
  const { data: memory,     isLoading: loadMem }    = useMemoryTrend();

  const pieData = split ? [
    { name: 'Download', value: split.avgDownloadMs },
    { name: 'Process',  value: split.avgProcessMs  },
    { name: 'Persist',  value: split.avgPersistMs  },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Performance</h1>
        <p className="text-xs text-gray-500 mt-0.5">Stage durations, throughput, and memory trends</p>
      </div>

      {/* Heatmap */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Stage Duration Heatmap (avg ms)</h2>
        {loadHeat ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="pb-2 text-xs text-gray-500 font-medium text-left w-36">CU</th>
                  <th className="pb-2 text-xs text-gray-500 font-medium text-center">Download</th>
                  <th className="pb-2 text-xs text-gray-500 font-medium text-center">Process</th>
                  <th className="pb-2 text-xs text-gray-500 font-medium text-center">Persist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {heatmap?.map(row => (
                  <tr key={row.cuId}>
                    <td className="py-2 pr-4 text-xs font-mono text-gray-300">{row.cuId}</td>
                    {([row.avgDownloadMs, row.avgProcessMs, row.avgPersistMs] as (number | null)[]).map((v, i) => (
                      <td key={i} className="py-2 text-center">
                        <span className={clsx('text-xs font-mono px-2 py-0.5 rounded', durationColor(v))}>
                          {v != null ? `${Math.round(v).toLocaleString()}ms` : '—'}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Throughput */}
        <div className="xl:col-span-2 card">
          <h2 className="text-sm font-semibold text-white mb-4">Throughput Trend (rows/sec)</h2>
          {loadThru ? <LoadingSpinner /> : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={throughput} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="date" tickFormatter={d => format(new Date(d), 'MMM d')}
                  tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(v: number) => [`${v.toFixed(1)} rows/s`, 'Throughput']}
                  labelFormatter={d => format(new Date(d), 'MMM d HH:mm')}
                />
                <Line type="monotone" dataKey="throughputRowsPerSec" stroke="#10b981" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stage split pie */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Avg Stage Split</h2>
          {loadSplit ? <LoadingSpinner /> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={STAGE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(v: number) => [`${Math.round(v).toLocaleString()}ms`]}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Slowest runs */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Top 10 Slowest Runs</h2>
        {loadSlow ? <LoadingSpinner /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Rank', 'CU', 'File', 'Duration', 'Started'].map(h => (
                  <th key={h} className="pb-2 pr-4 text-xs text-gray-500 font-medium text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {slowest?.map((run, i) => (
                <tr
                  key={run.correlationId}
                  onClick={() => navigate(`/runs/${run.correlationId}`)}
                  className="table-row-hover"
                >
                  <td className="py-2 pr-4 text-gray-500 text-xs tabular-nums">#{i + 1}</td>
                  <td className="py-2 pr-4 text-xs font-mono text-gray-300">{run.cuId}</td>
                  <td className="py-2 pr-4 text-xs text-gray-400 truncate max-w-[160px]">{run.blobName ?? '—'}</td>
                  <td className="py-2 pr-4 text-xs tabular-nums text-amber-400 font-medium">
                    {run.totalProcessingDurationMs?.toLocaleString()}ms
                  </td>
                  <td className="py-2 text-xs text-gray-500">
                    {format(new Date(run.startedAt), 'MMM d, HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Memory trend */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Memory Usage Trend</h2>
        {loadMem ? <LoadingSpinner /> : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={memory} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={d => format(new Date(d), 'MMM d')}
                tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}MB`} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v: number) => [`${v.toFixed(1)} MB`, 'Memory']}
                labelFormatter={d => format(new Date(d), 'MMM d HH:mm')}
              />
              <Line type="monotone" dataKey="memoryUsedMb" stroke="#f59e0b" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
