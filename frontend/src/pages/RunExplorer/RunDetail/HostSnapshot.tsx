import type { HostDetail } from '../../../types/telemetry';

interface HostSnapshotProps {
  host: HostDetail;
}

export function HostSnapshot({ host: h }: HostSnapshotProps) {
  const rows: [string, string | number | null][] = [
    ['Host Name',   h.hostName],
    ['Process ID',  h.processId],
    ['Thread ID',   h.threadId],
    ['Worker ID',   h.workerId],
    ['Memory Used', h.memoryUsedMb != null ? `${h.memoryUsedMb.toFixed(1)} MB` : null],
    ['CPU',         h.cpuUsagePercent != null ? `${h.cpuUsagePercent.toFixed(1)}%` : null],
    ['Environment', h.environment],
  ];

  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="bg-gray-800 rounded-lg p-2.5">
          <dt className="text-xs text-gray-500">{label}</dt>
          <dd className="text-sm text-white mt-0.5 font-mono truncate">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
