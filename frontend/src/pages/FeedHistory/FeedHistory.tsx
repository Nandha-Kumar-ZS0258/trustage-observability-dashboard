import { useState } from 'react';
import { FeedFilters, defaultFilters } from './FeedFilters';
import { FeedListTable } from './FeedListTable';
import type { FeedFilterValues } from './FeedFilters';
import type { FeedListFilters } from '../../hooks/useFeedHistory';

/** Convert UI filter values → API query params */
function toApiFilters(f: FeedFilterValues): FeedListFilters {
  return {
    cuId:   f.cuId   || undefined,
    status: f.status || undefined,
    from:   f.from   || undefined,
    to:     f.to     || undefined,
    search: f.search || undefined,
  };
}

export default function FeedHistory() {
  const [filters, setFilters] = useState<FeedFilterValues>(defaultFilters);

  return (
    <div className="p-6">
      {/* Page heading */}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-white mb-1">Feed History</h1>
        <p className="text-sm text-gray-500">
          Full history of all data feeds processed across CU partners.
        </p>
      </div>

      {/* Filter bar */}
      <FeedFilters filters={filters} onChange={setFilters} />

      {/* Feed list table + detail panel */}
      <FeedListTable filters={toApiFilters(filters)} />
    </div>
  );
}
