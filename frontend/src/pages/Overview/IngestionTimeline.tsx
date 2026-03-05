import { format } from 'date-fns';
import { clsx } from 'clsx';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  Tooltip, Cell,
} from 'recharts';
import { useTodayTimeline } from '../../hooks/useOverviewKpis';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/EmptyState';

const STATUS_COLOR: Record<string, string> = {
  success: '#34d399',
  failed:  '#f87171',
  warning: '#fbbf24',
};

export function IngestionTimeline() {
  const { data, isLoading } = useTodayTimeline();

  if (isLoading) return <LoadingSpinner />;
  if (!data?.length) return <EmptyState message="No runs today" />;

  const cuIds = [...new Set(data.map(d => d.cuId))].sort();
  const cuIndex = Object.fromEntries(cuIds.map((id, i) => [id, i]));

  const points = data.map(d => ({
    x: new Date(d.startTime).getTime(),
    y: cuIndex[d.cuId],
    status: d.status,
    cuId: d.cuId,
    time: format(new Date(d.startTime), 'HH:mm:ss'),
  }));

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-white mb-4">Today's Ingestion Timeline</h2>
      <ResponsiveContainer width="100%" height={Math.max(120, cuIds.length * 40)}>
        <ScatterChart margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <XAxis
            dataKey="x"
            type="number"
            domain={['auto', 'auto']}
            tickFormatter={v => format(new Date(v), 'HH:mm')}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={[-0.5, cuIds.length - 0.5]}
            ticks={cuIds.map((_, i) => i)}
            tickFormatter={i => cuIds[i] ?? ''}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            width={100}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ payload }) => {
              const p = payload?.[0]?.payload;
              if (!p) return null;
              return (
                <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300">
                  <p className="font-medium text-white">{p.cuId}</p>
                  <p>{p.time}</p>
                  <p className={clsx({
                    'text-emerald-400': p.status === 'success',
                    'text-red-400':     p.status === 'failed',
                    'text-amber-400':   p.status === 'warning',
                  })}>{p.status}</p>
                </div>
              );
            }}
          />
          <Scatter data={points}>
            {points.map((p, i) => (
              <Cell key={i} fill={STATUS_COLOR[p.status] ?? '#6b7280'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
