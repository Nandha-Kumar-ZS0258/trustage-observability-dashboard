import { format, parseISO } from 'date-fns';
import type { FeedDetailSummary } from '../../../hooks/useFeedHistory';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return format(parseISO(iso), "MMM d, yyyy · HH:mm:ss 'UTC'");
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—';
  return `${ms.toLocaleString()} ms (${(ms / 1000).toFixed(1)} seconds)`;
}

// ── Key-value row ─────────────────────────────────────────────────────────────

interface KvProps {
  label: string;
  children: React.ReactNode;
}

function Kv({ label, children }: KvProps) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-800 last:border-0 text-sm">
      <span className="w-44 shrink-0 font-semibold text-gray-400 leading-relaxed">{label}</span>
      <span className="flex-1 text-gray-200 leading-relaxed min-w-0">{children}</span>
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'Delivered'  ? 'badge bg-emerald-500/15 text-emerald-400' :
    status === 'Failed'     ? 'badge bg-red-500/15 text-red-400'         :
    status === 'Partial'    ? 'badge bg-amber-500/15 text-amber-400'     :
    status === 'InProgress' ? 'badge bg-blue-500/15 text-blue-400'       :
                              'badge bg-gray-700/60 text-gray-400';
  const label =
    status === 'InProgress' ? 'In Progress' : status;
  return <span className={cls}>{label}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  summary: FeedDetailSummary;
}

export function FeedSummary({ summary: s }: Props) {
  // On time indicator
  const onTimeNode = s.onTime === null ? (
    <span className="text-gray-500">—</span>
  ) : s.onTime ? (
    <span>
      {s.nextFeedExpectedAt ? format(parseISO(s.nextFeedExpectedAt), 'HH:mm') + ' ' : ''}
      <span className="text-emerald-400 font-semibold">✓ On time</span>
    </span>
  ) : (
    <span>
      {s.nextFeedExpectedAt ? format(parseISO(s.nextFeedExpectedAt), 'HH:mm') + ' ' : ''}
      <span className="text-red-400 font-semibold">✗ Late</span>
    </span>
  );

  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Feed Summary
      </p>

      <div className="bg-gray-950 border border-gray-800 rounded-lg px-4">
        <Kv label="CU Partner">
          <strong className="text-white">{s.cuName}</strong>
        </Kv>

        <Kv label="Feed Reference ID">
          <span className="font-mono text-gray-300 text-[12px]">{s.feedReferenceId}</span>
        </Kv>

        {s.mappingVersion && (
          <Kv label="Standardisation Rules">
            Version {s.mappingVersion}
          </Kv>
        )}

        <Kv label="Feed Received">
          {fmtDateTime(s.feedReceived)}
        </Kv>

        <Kv label="Feed Delivered">
          {s.feedDelivered ? fmtDateTime(s.feedDelivered) : <span className="text-gray-500">Not delivered</span>}
        </Kv>

        <Kv label="Total Duration">
          {fmtDuration(s.totalDurationMs)}
        </Kv>

        <Kv label="Expected by">
          {onTimeNode}
        </Kv>

        <Kv label="Member Records Written">
          {s.memberRecordsProcessed !== null ? (
            <span className={s.memberRecordsProcessed > 0 ? 'text-emerald-400 font-semibold' : 'text-gray-300'}>
              {s.memberRecordsProcessed.toLocaleString()}
            </span>
          ) : '—'}
        </Kv>

        <Kv label="Records Rejected">
          {s.recordsRejected !== null ? (
            <span className={s.recordsRejected > 0 ? 'text-red-400 font-semibold' : 'text-gray-300'}>
              {s.recordsRejected.toLocaleString()}
            </span>
          ) : '—'}
        </Kv>

        {s.runType && (
          <Kv label="Feed Type">
            {s.runType}
          </Kv>
        )}

        <Kv label="Delivery Status">
          <StatusPill status={s.status} />
        </Kv>
      </div>
    </div>
  );
}
