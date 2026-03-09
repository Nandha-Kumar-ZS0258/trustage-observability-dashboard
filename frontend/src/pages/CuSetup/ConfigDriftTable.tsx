import { useState } from 'react';
import { clsx } from 'clsx';
import { useCuDrift } from '../../hooks/useCuSetup';

export function ConfigDriftTable() {
  const { data, isLoading } = useCuDrift();
  const [filterCu, setFilterCu] = useState('');

  const rows = filterCu
    ? data?.filter(r => r.displayName.toLowerCase().includes(filterCu.toLowerCase()))
    : data;

  const driftCount = data?.filter(r => r.isDrift).length ?? 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Config vs Reality Drift</h2>
          {driftCount > 0 && (
            <p className="text-xs text-red-400 mt-0.5">{driftCount} drift{driftCount !== 1 ? 's' : ''} detected</p>
          )}
        </div>
        <input
          className="input w-48"
          placeholder="Filter by CU..."
          value={filterCu}
          onChange={e => setFilterCu(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-500 py-4">Loading...</p>
      ) : !rows?.length ? (
        <p className="text-xs text-gray-500 py-4">No drift data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">CU Name</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Field</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Configured</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Observed</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.cuId}-${row.field}-${i}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-gray-200 font-medium">{row.displayName}</td>
                  <td className="py-2 px-3 text-gray-400 font-mono text-xs">{row.field}</td>
                  <td className="py-2 px-3 text-gray-300 font-mono text-xs">{row.configured}</td>
                  <td className="py-2 px-3 text-gray-300 font-mono text-xs">{row.observed ?? '—'}</td>
                  <td className="py-2 px-3">
                    <span className={clsx(
                      'badge',
                      row.isDrift
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    )}>
                      {row.isDrift ? 'DRIFT' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
