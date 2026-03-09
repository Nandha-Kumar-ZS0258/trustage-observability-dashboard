import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { useCuDriftDetail } from '../../hooks/useCuSetup';
import type { CuConfiguration } from '../../types/telemetry';

interface Props {
  cu: CuConfiguration | null;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-2 border-b border-gray-800/60">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-200 mt-0.5 font-mono break-all">{value ?? '—'}</p>
    </div>
  );
}

export function CuConfigDrawer({ cu, onClose }: Props) {
  const { data: driftRows } = useCuDriftDetail(cu?.cuId ?? '');

  if (!cu) return null;

  const statusColor =
    cu.onboardingStatus === 'active'     ? 'text-emerald-400' :
    cu.onboardingStatus === 'onboarding' ? 'text-amber-400'   : 'text-gray-400';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-gray-900 border-l border-gray-800 overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <div>
            <h2 className="text-sm font-semibold text-white">{cu.displayName}</h2>
            <p className={clsx('text-xs mt-0.5 capitalize', statusColor)}>{cu.onboardingStatus}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Configuration */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Configuration</h3>
            <Field label="CU ID"           value={cu.cuId} />
            <Field label="Adapter"          value={cu.adapterId} />
            <Field label="Container"        value={cu.containerName} />
            <Field label="File Types"       value={cu.fileTypes} />
            <Field label="Mapping Version"  value={cu.mappingVersion} />
            <Field label="SLA Threshold"    value={`${(cu.slaThresholdMs / 1000).toFixed(0)}s`} />
            <Field label="Environment"      value={cu.environment} />
            <Field label="Onboarding Date"  value={cu.onboardingDate} />
            <Field label="Owner Team"       value={cu.ownerTeam} />
            {cu.notes && <Field label="Notes" value={cu.notes} />}
          </div>

          {/* Right: Live observed vs configured */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Observed vs Configured
            </h3>
            <Field label="First Run At" value={cu.firstRunAt ? new Date(cu.firstRunAt).toLocaleDateString() : 'Never'} />

            {driftRows?.map(row => (
              <div key={row.field} className="py-2 border-b border-gray-800/60">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">{row.field}</p>
                <div className="flex items-start justify-between mt-0.5 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-600">Configured</p>
                    <p className="text-xs text-gray-300 font-mono">{row.configured}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-600">Observed</p>
                    <p className="text-xs text-gray-300 font-mono">{row.observed ?? '—'}</p>
                  </div>
                  <span className={clsx(
                    'badge shrink-0 mt-3',
                    row.isDrift
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-emerald-500/10 text-emerald-400'
                  )}>
                    {row.isDrift ? 'DRIFT' : 'OK'}
                  </span>
                </div>
              </div>
            ))}

            {!driftRows?.length && (
              <p className="text-xs text-gray-500 mt-2">No event data yet for this CU.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
