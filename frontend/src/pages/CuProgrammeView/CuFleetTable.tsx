import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import type { CuFleetRow, LifecycleState, HealthStatus } from '../../types/programme';
import { useCuFleet } from '../../hooks/useProgramme';

// ── Staleness thresholds ──────────────────────────────────────────────────────
const READY_STALE_DAYS = 7;
const BAU_STALE_DAYS   = 3;

// ── Pill renderers ────────────────────────────────────────────────────────────

function LifecyclePill({ state }: { state: LifecycleState }) {
  const cls =
    state === 'Onboarding'          ? 'badge bg-blue-500/15 text-blue-400'  :
    state === 'ReadyForFirstFeed' ? 'badge bg-amber-500/15 text-amber-400' :
                                       'badge bg-emerald-500/15 text-emerald-400';
  const label =
    state === 'Onboarding'        ? 'Onboarding' :
    state === 'ReadyForFirstFeed' ? 'Ready'       :
                                    'BAU';
  return <span className={cls}>{label}</span>;
}

function HealthPill({ status }: { status: HealthStatus }) {
  const cls =
    status === 'Healthy'  ? 'badge bg-emerald-500/15 text-emerald-400' :
    status === 'Overdue'  ? 'badge bg-amber-500/15 text-amber-400'     :
    status === 'Failed'   ? 'badge bg-red-500/15 text-red-400'         :
                            'badge bg-gray-700/60 text-gray-400';
  return <span className={cls}>{status}</span>;
}

function OwnerBadge({ name }: { name: string | null }) {
  if (!name) return <span className="text-gray-600 text-xs">—</span>;
  const initials = name
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="badge bg-gray-700/70 text-gray-300 text-[10px] font-semibold"
      title={name}
    >
      {initials}
    </span>
  );
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

type SortKey = keyof CuFleetRow | null;
type SortDir = 'asc' | 'desc';

function sortRows(rows: CuFleetRow[], key: SortKey, dir: SortDir): CuFleetRow[] {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const av = a[key] ?? '';
    const bv = b[key] ?? '';
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === 'asc' ? cmp : -cmp;
  });
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (column !== sortKey) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-30" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 ml-1 text-blue-400" />
    : <ChevronDown className="w-3 h-3 ml-1 text-blue-400" />;
}

// ── Date / duration helpers ───────────────────────────────────────────────────

function fmtDate(iso: string | null, fallback = 'Not yet') {
  if (!iso) return <span className="text-gray-600">{fallback}</span>;
  return <span>{format(parseISO(iso), 'dd MMM, HH:mm')}</span>;
}

function fmtDuration(ms: number | null | undefined) {
  if (ms == null) return <span className="text-gray-600">—</span>;
  return <span>{(ms / 1000).toFixed(1)}s</span>;
}

// ── Days-in-state cell ────────────────────────────────────────────────────────

function DaysCell({ row }: { row: CuFleetRow }) {
  const isStale =
    (row.lifecycleState === 'ReadyForFirstFeed' && row.daysInState > READY_STALE_DAYS) ||
    (row.lifecycleState === 'BAU'                  && row.daysInState > BAU_STALE_DAYS);

  if (!isStale) return <span className="text-gray-300">{row.daysInState}</span>;

  return (
    <span className="badge bg-amber-500/15 text-amber-400 text-[10px] font-semibold whitespace-nowrap">
      {row.daysInState} days ⚠
    </span>
  );
}

// ── Column header button ──────────────────────────────────────────────────────

interface ThProps {
  label: string;
  colKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}

function Th({ label, colKey, sortKey, sortDir, onSort, className }: ThProps) {
  return (
    <th
      className={clsx(
        'px-4 py-3 text-left text-[11px] font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap',
        'cursor-pointer select-none hover:text-white transition-colors',
        className,
      )}
      onClick={() => onSort(colKey)}
    >
      <span className="inline-flex items-center">
        {label}
        <SortIcon column={colKey} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </th>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  state: string;
  platform: string;
  health: string;
}

const PLATFORM_OPTIONS = ['Symitar', 'Corelation', 'Fiserv', 'DNA'];
const LIFECYCLE_OPTIONS: LifecycleState[] = ['Onboarding', 'ReadyForFirstFeed', 'BAU'];
const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  Onboarding: 'Onboarding',
  ReadyForFirstFeed: 'Ready for First Feed',
  BAU: 'BAU',
};
const HEALTH_OPTIONS: HealthStatus[] = ['Healthy', 'Overdue', 'Failed', 'Awaiting'];

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <input
        type="search"
        className="input text-sm py-1.5 w-52"
        placeholder="Search CU partner…"
        value={filters.search}
        onChange={e => set({ search: e.target.value })}
      />
      <select className="select text-sm py-1.5" value={filters.state} onChange={e => set({ state: e.target.value })}>
        <option value="">All Lifecycle States</option>
        {LIFECYCLE_OPTIONS.map(s => <option key={s} value={s}>{LIFECYCLE_LABELS[s]}</option>)}
      </select>
      <select className="select text-sm py-1.5" value={filters.platform} onChange={e => set({ platform: e.target.value })}>
        <option value="">All Platforms</option>
        {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <select className="select text-sm py-1.5" value={filters.health} onChange={e => set({ health: e.target.value })}>
        <option value="">All Health Statuses</option>
        {HEALTH_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CuFleetTable() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<Filters>({
    search: '', state: '', platform: '', health: '',
  });
  const [sortKey, setSortKey] = useState<SortKey>('cuName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Pass server-side filters (state/platform/health) to hook; search is client-side
  const { data: rawRows, isLoading } = useCuFleet({
    state:    filters.state    || undefined,
    platform: filters.platform || undefined,
    health:   filters.health   || undefined,
  });
  const rows: CuFleetRow[] = Array.isArray(rawRows) ? rawRows : [];

  const displayed = useMemo(() => {
    const q = filters.search.toLowerCase();
    const filtered = q
      ? rows.filter(r =>
          r.cuName.toLowerCase().includes(q) ||
          r.coreBankingPlatform.toLowerCase().includes(q),
        )
      : rows;
    return sortRows(filtered, sortKey, sortDir);
  }, [rows, filters.search, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const thProps = { sortKey, sortDir, onSort: handleSort };

  return (
    <div>
      <FilterBar filters={filters} onChange={setFilters} />

      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0F2744] border-b border-gray-700">
                <Th label="CU Partner Name"        colKey="cuName"                  {...thProps} />
                <Th label="Core Banking Platform"  colKey="coreBankingPlatform"     {...thProps} />
                <Th label="Lifecycle State"        colKey="lifecycleState"          {...thProps} />
                <Th label="Days in State"          colKey="daysInState"             {...thProps} />
                <Th label="Last Feed Delivered"    colKey="lastFeedDeliveredAt"     {...thProps} />
                <Th label="Next Feed Expected"     colKey="nextFeedExpectedAt"      {...thProps} />
                <Th label="Last Feed Duration"     colKey="lastFeedDurationMs"      {...thProps} />
                <Th label="Member Records (last)"  colKey="lastFeedMemberRecords"   {...thProps} />
                <Th label="Records Rejected (last)" colKey="lastFeedRecordsRejected" {...thProps} />
                <Th label="Health"                 colKey="healthStatus"            {...thProps} />
                <Th label="Owner"                  colKey="assignedEngineer"        {...thProps} />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-gray-500 text-sm">
                    Loading…
                  </td>
                </tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-gray-500 text-sm">
                    No CU partners match the current filters.
                  </td>
                </tr>
              ) : (
                displayed.map((row, i) => (
                  <tr
                    key={row.cuId}
                    className={clsx(
                      'border-b border-gray-800 transition-colors hover:bg-gray-800/40',
                      i % 2 === 1 && 'bg-gray-900/30',
                    )}
                  >
                    {/* CU Partner Name */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        className="text-blue-400 hover:text-blue-300 font-semibold text-sm text-left"
                        onClick={() => navigate(`/cu/${row.cuId}`)}
                      >
                        {row.cuName}
                      </button>
                    </td>

                    {/* Core Banking Platform */}
                    <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                      {row.coreBankingPlatform}
                    </td>

                    {/* Lifecycle State */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <LifecyclePill state={row.lifecycleState} />
                    </td>

                    {/* Days in State */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <DaysCell row={row} />
                    </td>

                    {/* Last Feed Delivered */}
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap text-sm">
                      {fmtDate(row.lastFeedDeliveredAt, 'Not yet')}
                    </td>

                    {/* Next Feed Expected */}
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap text-sm">
                      {fmtDate(row.nextFeedExpectedAt, 'Not scheduled')}
                    </td>

                    {/* Last Feed Duration */}
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap text-sm">
                      {fmtDuration(row.lastFeedDurationMs)}
                    </td>

                    {/* Member Records (last) */}
                    <td className="px-4 py-3 text-gray-300 text-sm tabular-nums">
                      {row.lastFeedMemberRecords !== null
                        ? row.lastFeedMemberRecords.toLocaleString()
                        : <span className="text-gray-600">—</span>}
                    </td>

                    {/* Records Rejected (last) */}
                    <td className="px-4 py-3 text-sm tabular-nums">
                      {row.lastFeedRecordsRejected !== null ? (
                        <span className={row.lastFeedRecordsRejected > 0 ? 'text-red-400 font-semibold' : 'text-gray-300'}>
                          {row.lastFeedRecordsRejected.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>

                    {/* Health */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <HealthPill status={row.healthStatus} />
                    </td>

                    {/* Owner */}
                    <td className="px-4 py-3">
                      <OwnerBadge name={row.assignedEngineer} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Row count footer */}
        {!isLoading && (
          <div className="px-4 py-2.5 border-t border-gray-800 bg-gray-900/50">
            <p className="text-[11px] text-gray-600">
              {displayed.length} CU partner{displayed.length !== 1 ? 's' : ''}
              {displayed.length !== rows.length && ` (filtered from ${rows.length})`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
