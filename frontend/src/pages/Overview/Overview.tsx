import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { KpiStrip } from './KpiStrip';
import { LiveFeed } from './LiveFeed';
import { CuHealthGrid } from './CuHealthGrid';
import { IngestionTimeline } from './IngestionTimeline';
import { useHourlyRows } from '../../hooks/useOverviewKpis';

function HourlyRowsChart() {
  const { data } = useHourlyRows();
  if (!data?.length) return null;

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-white mb-4">Rows Processed — Hourly</h2>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={h => `${h}:00`}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#60a5fa' }}
            formatter={(v: number) => [v.toLocaleString(), 'Rows']}
            labelFormatter={h => `${h}:00`}
          />
          <Bar dataKey="totalRows" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Overview() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Overview</h1>
        <p className="text-xs text-gray-500 mt-0.5">Today's pipeline health at a glance</p>
      </div>

      <KpiStrip />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <LiveFeed />
        </div>
        <div>
          <HourlyRowsChart />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white mb-3">CU Health Grid</h2>
        <CuHealthGrid />
      </div>

      <IngestionTimeline />
    </div>
  );
}
