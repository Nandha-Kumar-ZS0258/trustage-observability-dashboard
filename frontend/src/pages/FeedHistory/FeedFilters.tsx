import { format, subDays } from 'date-fns';
import { useCuFleet } from '../../hooks/useProgramme';

export interface FeedFilterValues {
  cuId: string;
  status: string;
  from: string;
  to: string;
  search: string;
}

/** Returns default filter values: last 7 days, no other filters. */
export function defaultFilters(): FeedFilterValues {
  const today = new Date();
  return {
    cuId:   '',
    status: '',
    from:   format(subDays(today, 7), 'yyyy-MM-dd'),
    to:     format(today, 'yyyy-MM-dd'),
    search: '',
  };
}

interface Props {
  filters: FeedFilterValues;
  onChange: (f: FeedFilterValues) => void;
}

const STATUS_OPTIONS = ['Delivered', 'Failed', 'Partial'] as const;

export function FeedFilters({ filters, onChange }: Props) {
  const set = (patch: Partial<FeedFilterValues>) => onChange({ ...filters, ...patch });

  // Populate CU Partner dropdown from fleet endpoint (lightweight — just needs names)
  const { data: rawFleet } = useCuFleet();
  const cuOptions = Array.isArray(rawFleet)
    ? [...rawFleet]
        .sort((a, b) => a.cuName.localeCompare(b.cuName))
        .map(r => ({ id: r.cuId, name: r.cuName }))
    : [];

  return (
    <div className="flex flex-wrap gap-3 mb-5 items-end">
      {/* CU Partner */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          CU Partner
        </label>
        <select
          className="select text-sm py-1.5 min-w-[200px]"
          value={filters.cuId}
          onChange={e => set({ cuId: e.target.value })}
        >
          <option value="">All CU Partners</option>
          {cuOptions.map(cu => (
            <option key={cu.id} value={cu.id}>{cu.name}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          Status
        </label>
        <select
          className="select text-sm py-1.5"
          value={filters.status}
          onChange={e => set({ status: e.target.value })}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Date range — From */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          From
        </label>
        <input
          type="date"
          className="input text-sm py-1.5 w-36"
          value={filters.from}
          max={filters.to}
          onChange={e => set({ from: e.target.value })}
        />
      </div>

      {/* Date range — To */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          To
        </label>
        <input
          type="date"
          className="input text-sm py-1.5 w-36"
          value={filters.to}
          min={filters.from}
          onChange={e => set({ to: e.target.value })}
        />
      </div>

      {/* Free text search */}
      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
        <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          Search
        </label>
        <input
          type="search"
          className="input text-sm py-1.5"
          placeholder="Feed Reference ID or CU name…"
          value={filters.search}
          onChange={e => set({ search: e.target.value })}
        />
      </div>
    </div>
  );
}
