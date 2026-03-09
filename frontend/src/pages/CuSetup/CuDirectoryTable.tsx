import { useState } from 'react';
import { clsx } from 'clsx';
import { useCuDirectory } from '../../hooks/useCuSetup';
import type { CuConfiguration, CuDirectoryFilters } from '../../types/telemetry';
import { CuConfigDrawer } from './CuConfigDrawer';

function CuStatusBadge({ status }: { status: string }) {
  const color =
    status === 'active'     ? 'bg-emerald-500/10 text-emerald-400' :
    status === 'onboarding' ? 'bg-amber-500/10 text-amber-400'     :
                              'bg-gray-500/10 text-gray-400';
  return <span className={clsx('badge capitalize', color)}>{status}</span>;
}

function EnvBadge({ env }: { env: string }) {
  return (
    <span className={clsx(
      'badge capitalize',
      env === 'production' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
    )}>
      {env}
    </span>
  );
}

export function CuDirectoryTable() {
  const [filters, setFilters] = useState<CuDirectoryFilters>({});
  const [selected, setSelected] = useState<CuConfiguration | null>(null);
  const { data, isLoading } = useCuDirectory(filters);

  const set = (key: keyof CuDirectoryFilters, value: string) =>
    setFilters(f => ({ ...f, [key]: value || undefined }));

  return (
    <>
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-white mr-2">CU Directory</h2>

          <select className="select w-36" onChange={e => set('status', e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="onboarding">Onboarding</option>
            <option value="inactive">Inactive</option>
          </select>

          <select className="select w-36" onChange={e => set('environment', e.target.value)}>
            <option value="">All Environments</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
          </select>

          <input
            className="input w-40"
            placeholder="Owner team..."
            onChange={e => set('ownerTeam', e.target.value)}
          />

          <input
            className="input w-40"
            placeholder="Adapter ID..."
            onChange={e => set('adapterId', e.target.value)}
          />
        </div>

        {isLoading ? (
          <p className="text-xs text-gray-500 py-4">Loading...</p>
        ) : !data?.length ? (
          <p className="text-xs text-gray-500 py-4">No CUs match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['CU Name','CU ID','Status','Env','Owner Team','Adapter','Mapping','SLA','Onboarded','First Run','Drift'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(cu => (
                  <tr
                    key={cu.cuId}
                    className="border-b border-gray-800/50 table-row-hover"
                    onClick={() => setSelected(cu)}
                  >
                    <td className="py-2 px-3 text-gray-200 font-medium whitespace-nowrap">{cu.displayName}</td>
                    <td className="py-2 px-3 text-gray-400 font-mono text-xs">{cu.cuId}</td>
                    <td className="py-2 px-3"><CuStatusBadge status={cu.onboardingStatus} /></td>
                    <td className="py-2 px-3"><EnvBadge env={cu.environment} /></td>
                    <td className="py-2 px-3 text-gray-300 whitespace-nowrap">{cu.ownerTeam ?? '—'}</td>
                    <td className="py-2 px-3 text-gray-300 font-mono text-xs whitespace-nowrap">{cu.adapterId}</td>
                    <td className="py-2 px-3 text-gray-300 font-mono text-xs whitespace-nowrap">{cu.mappingVersion ?? '—'}</td>
                    <td className="py-2 px-3 text-gray-300 tabular-nums whitespace-nowrap">{(cu.slaThresholdMs / 1000).toFixed(0)}s</td>
                    <td className="py-2 px-3 text-gray-400 whitespace-nowrap">{cu.onboardingDate}</td>
                    <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                      {cu.firstRunAt ? new Date(cu.firstRunAt).toLocaleDateString() : <span className="text-amber-400">Never</span>}
                    </td>
                    <td className="py-2 px-3">
                      {cu.hasDrift
                        ? <span className="badge bg-red-500/10 text-red-400">DRIFT</span>
                        : <span className="badge bg-emerald-500/10 text-emerald-400">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CuConfigDrawer cu={selected} onClose={() => setSelected(null)} />
    </>
  );
}
