import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { format, parseISO, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';
import type { CuFleetRow, HealthStatus } from '../../types/programme';
import { useCuStatusGrid } from '../../hooks/useTodaysFeeds';

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = parseISO(iso);
  if (isToday(d))      return `Today ${format(d, 'HH:mm')}`;
  if (isYesterday(d))  return `Yesterday ${format(d, 'HH:mm')}`;
  const days = differenceInCalendarDays(new Date(), d);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// ── Health status pill ────────────────────────────────────────────────────────

function HealthPill({ status }: { status: HealthStatus }) {
  const { cls, dot } =
    status === 'Healthy'  ? { cls: 'badge bg-emerald-500/15 text-emerald-400', dot: '●' } :
    status === 'Overdue'  ? { cls: 'badge bg-amber-500/15 text-amber-400',     dot: '●' } :
    status === 'Failed'   ? { cls: 'badge bg-red-500/15 text-red-400',         dot: '●' } :
                            { cls: 'badge bg-gray-700/60 text-gray-400',       dot: '⚫' };
  return <span className={cls}>{dot} {status}</span>;
}

// ── Card key-value row ────────────────────────────────────────────────────────

function CardRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={clsx('font-semibold text-gray-200', valueClass)}>{value}</span>
    </div>
  );
}

// ── BAU CU card ───────────────────────────────────────────────────────────────

function BauCard({ row, onClick }: { row: CuFleetRow; onClick: () => void }) {
  const hasException = row.healthStatus === 'Failed';

  return (
    <button
      onClick={onClick}
      className={clsx(
        'bg-gray-900 border border-gray-800 rounded-xl p-4 text-left w-full',
        'transition-all duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-black/25 hover:border-gray-700',
      )}
    >
      {/* Status pill top */}
      <div className="flex items-start justify-between mb-2">
        <HealthPill status={row.healthStatus} />
      </div>

      {/* CU name */}
      <p className="text-sm font-bold text-white mb-0.5 leading-tight">{row.cuName}</p>

      {/* Platform */}
      <p className="text-[11px] text-gray-500 mb-3">{row.coreBankingPlatform}</p>

      {/* Key-value rows */}
      <div className="space-y-0">
        <CardRow
          label="Last delivery"
          value={relativeDate(row.lastFeedDeliveredAt)}
        />
        <CardRow
          label="Member records"
          value={
            row.lastFeedMemberRecords !== null
              ? row.lastFeedMemberRecords.toLocaleString()
              : '—'
          }
        />
        <CardRow
          label="Data alignment"
          value="—"
        />
      </div>

      {/* Exception indicator */}
      {hasException && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-red-400 bg-red-950/30 rounded-lg px-3 py-1.5">
          <span>⚠</span>
          <span>Active feed exception</span>
        </div>
      )}
    </button>
  );
}

// ── "Awaiting first feed delivery" muted card ─────────────────────────────────

function AwaitingCard({ row, onClick }: { row: CuFleetRow; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'bg-gray-900 border border-gray-800 rounded-xl p-4 text-left w-full opacity-60',
        'transition-all duration-150 hover:opacity-80 hover:-translate-y-px',
      )}
    >
      <div className="mb-2">
        <span className="badge bg-gray-700/60 text-gray-400">⚫ Awaiting</span>
      </div>
      <p className="text-sm font-bold text-white mb-0.5 leading-tight">{row.cuName}</p>
      <p className="text-[11px] text-gray-500 mb-3">{row.coreBankingPlatform}</p>
      <p className="text-xs text-gray-500 italic">Awaiting first feed delivery</p>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CuStatusGrid() {
  const navigate = useNavigate();
  const { data: rawData, isLoading } = useCuStatusGrid();
  const rows: CuFleetRow[] = Array.isArray(rawData) ? rawData : [];

  // Separate BAU from Ready for First Feed; skip Onboarding from this grid
  const bau     = rows.filter(r => r.lifecycleState === 'BAU');
  const ready   = rows.filter(r => r.lifecycleState === 'ReadyForFirstFeed');

  if (isLoading) {
    return <p className="text-sm text-gray-500 py-8 text-center">Loading CU Partner status…</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No CU partner data available.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">CU Partner Status</h3>
        <span className="text-[11px] text-gray-500">
          {bau.length} BAU · {ready.length} awaiting first feed
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {/* BAU partners first */}
        {bau.map(row => (
          <BauCard
            key={row.cuId}
            row={row}
            onClick={() => navigate(`/cu/${row.cuId}`)}
          />
        ))}

        {/* Ready for First Feed — muted */}
        {ready.map(row => (
          <AwaitingCard
            key={row.cuId}
            row={row}
            onClick={() => navigate(`/cu/${row.cuId}`)}
          />
        ))}
      </div>
    </div>
  );
}
