import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useAdapterSpread, useMappingSpread } from '../../hooks/useCuSetup';

const tooltipStyle = {
  contentStyle: { background: '#1f2937', border: '1px solid #374151', borderRadius: 8 },
  labelStyle: { color: '#9ca3af' },
  itemStyle: { color: '#a78bfa' },
};

export function AdapterMappingCharts() {
  const { data: adapters } = useAdapterSpread();
  const { data: mappings }  = useMappingSpread();

  return (
    <div className="card space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">CU Connector Distribution</h2>
        {adapters?.length ? (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={adapters} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="adapterId" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" name="CUs" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-500">No data</p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Standardisation Rules Version Spread</h2>
        {mappings?.length ? (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={mappings} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="mappingVersion" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" name="CUs" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-500">No data</p>
        )}
      </div>
    </div>
  );
}
