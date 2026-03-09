import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { useFirstDeliveryGap } from '../../hooks/useCuSetup';

export function FirstDeliveryGapChart() {
  const { data } = useFirstDeliveryGap();

  if (!data?.length) return null;

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-white mb-1">First Delivery Gap</h2>
      <p className="text-xs text-gray-500 mb-4">Days from onboarding date to first pipeline run</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="displayName"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={76}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value, _name, props) => [
              value === null ? 'No run yet' : `${value} days`,
              props.payload?.onboardingStatus === 'onboarding' ? 'Gap (still onboarding)' : 'Gap',
            ]}
          />
          <Bar dataKey="gapDays" name="Gap (days)" radius={[0, 3, 3, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.onboardingStatus === 'onboarding' ? '#f59e0b' : '#3b82f6'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-600 mt-2">Amber = currently in onboarding</p>
    </div>
  );
}
