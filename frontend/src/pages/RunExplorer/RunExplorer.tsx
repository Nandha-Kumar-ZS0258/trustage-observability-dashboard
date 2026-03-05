import { useState } from 'react';
import { RunFiltersBar } from './RunFilters';
import { RunTable } from './RunTable';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useRunList } from '../../hooks/useRunList';
import type { RunFilters } from '../../types/telemetry';

export default function RunExplorer() {
  const [filters, setFilters] = useState<RunFilters>({});
  const { data, isLoading } = useRunList(filters);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-white">Run Explorer</h1>
        <p className="text-xs text-gray-500 mt-0.5">Browse and filter all pipeline runs</p>
      </div>

      <RunFiltersBar onFilter={setFilters} />

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-400">
            {data ? `${data.length.toLocaleString()} runs` : ''}
          </span>
        </div>
        {isLoading ? <LoadingSpinner /> : <RunTable runs={data ?? []} />}
      </div>
    </div>
  );
}
