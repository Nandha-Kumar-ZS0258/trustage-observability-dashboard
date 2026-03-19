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
    state === 'Onboarding'      ? 'badge bg-[#DBEAFE] text-[#1D4ED8]'  :
    state === 'ReadyForFirstFeed' ? 'badge bg-[#FEF3C7] text-[#92400E]' :
                                    'badge bg-[#DCFCE7] text-[#166534]';
  const label =
    state === 'Onboarding'        ? '● Onboarding' :
    state === 'ReadyForFirstFeed' ? '● Ready'       :
                                    '● BAU';
  return <span className={cls}>{label}</span>;
}

function HealthPill({ status }: { status: HealthStatus }) {
  const cls =
    status === 'Healthy'  ? 'badge bg-[#DCFCE7] text-[#166534]' :
    status === 'Overdue'  ? 'badge bg-[#FEF3C7] text-[#92400E]' :
    status === 'Failed'   ? 'badge bg-[#FEE2E2] text-[#991B1B]' :
                            'badge bg-[#F1F5F9] text-[#475569]';
  return <span className={cls}>{status === 'Dev' ? '⚫ Dev' : `● ${status}`}</span>;
}

function OwnerBadge({ name }: { name: string | null }) {
  if (!name) return <span className="text-[#94A3B8] text-xs">—</span>;
  const initials = name
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="badge bg-[#F1F5F9] text-[#475569] text-[10px] font-semibold"
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
  if (!iso) return <span className="text-[#94A3B8]">{fallback}</span>;
  return <span className="text-[#334155]">{format(parseISO(iso), 'dd MMM, HH:mm')}</span>;
}

function fmtDuration(ms: number | null | undefined) {
  if (ms == null) return <span className="text-[#94A3B8]">—</span>;
  return <span className="text-[#334155]">{(ms / 1000).toFixed(1)}s</span>;
}

// ── Days-in-state cell ────────────────────────────────────────────────────────

function DaysCell({ row }: { row: CuFleetRow }) {
  const isStale =
    (row.lifecycleState === 'ReadyForFirstFeed' && row.daysInState > READY_STALE_DAYS) ||
    (row.lifecycleState === 'BAU'                  && row.daysInState > BAU_STALE_DAYS);

  if (!isStale) return <span className="text-[#334155]">{row.daysInState} days</span>;

  return (
    <span className="text-[#334155] text-sm">
      {row.daysInState} days{' '}
      <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] ml-1">
        Overdue ⚠
      </span>
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
const HEALTH_OPTIONS: HealthStatus[] = ['Healthy', 'Overdue', 'Failed', 'Awaiting', 'Dev'];

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div className="flex items-center gap-2">
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
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-[#0F2744]">CU Partner Fleet</h3>
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
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
                <Th label="Duration (last)"        colKey="lastFeedDurationMs"      {...thProps} />
                <Th label="Records (last)"         colKey="lastFeedMemberRecords"   {...thProps} />
                <Th label="Health"                 colKey="healthStatus"            {...thProps} />
                <Th label="Owner"                  colKey="assignedEngineer"        {...thProps} />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-[#94A3B8] text-sm">
                    Loading…
                  </td>
                </tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-[#94A3B8] text-sm">
                    No CU partners match the current filters.
                  </td>
                </tr>
              ) : (
                displayed.map((row, i) => (
                  <tr
                    key={row.cuId}
                    className={clsx(
                      'border-b border-[#E2E8F0] transition-colors hover:bg-[#EFF6FF] cursor-pointer',
                      i % 2 === 1 && 'bg-[#F8FAFC]',
                    )}
                  >
                    {/* CU Partner Name */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        className="text-[#1A6DB5] hover:text-[#0F2744] font-semibold text-sm text-left"
                        onClick={() => navigate(`/cu/${row.cuId}`)}
                      >
                        {row.cuName}
                      </button>
                    </td>

                    {/* Core Banking Platform */}
                    <td className="px-4 py-3 text-[#475569] text-sm whitespace-nowrap">
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
                    <td className="px-4 py-3 text-[#334155] whitespace-nowrap text-sm">
                      {fmtDate(row.lastFeedDeliveredAt, 'Not yet')}
                    </td>

                    {/* Next Feed Expected */}
                    <td className="px-4 py-3 text-[#334155] whitespace-nowrap text-sm">
                      {fmtDate(row.nextFeedExpectedAt, 'Not scheduled')}
                    </td>

                    {/* Last Feed Duration */}
                    <td className="px-4 py-3 text-[#334155] whitespace-nowrap text-sm">
                      {fmtDuration(row.lastFeedDurationMs)}
                    </td>

                    {/* Records (last) */}
                    <td className="px-4 py-3 text-[#334155] text-sm tabular-nums">
                      {row.lastFeedMemberRecords !== null
                        ? row.lastFeedMemberRecords.toLocaleString()
                        : <span className="text-[#94A3B8]">—</span>}
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
          <div className="px-4 py-2.5 border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <p className="text-[11px] text-[#94A3B8]">
              {displayed.length} CU partner{displayed.length !== 1 ? 's' : ''}
              {displayed.length !== rows.length && ` (filtered from ${rows.length})`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
