import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { EventTypeBadge, StatusBadge } from '../../components/StatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/EmptyState';
import { useLiveFeedData } from '../../hooks/useOverviewKpis';
import { useLiveFeed } from '../../hooks/useLiveFeed';

export function LiveFeed() {
  const { data, isLoading, isFetching } = useLiveFeedData();
  useLiveFeed(); // connect SignalR

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Live Feed Events</h2>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          {isFetching && <RefreshCw className="w-3 h-3 animate-spin" />}
          <span>auto-refresh 30s</span>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.length ? (
        <EmptyState message="No events today" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="pb-2 text-xs text-gray-500 font-medium w-36">Event</th>
                <th className="pb-2 text-xs text-gray-500 font-medium">CU</th>
                <th className="pb-2 text-xs text-gray-500 font-medium">File</th>
                <th className="pb-2 text-xs text-gray-500 font-medium">Time</th>
                <th className="pb-2 text-xs text-gray-500 font-medium text-right">Duration</th>
                <th className="pb-2 text-xs text-gray-500 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {data.map(event => (
                <tr key={event.eventId} className="table-row-hover">
                  <td className="py-2 pr-3">
                    <EventTypeBadge eventType={event.eventType} />
                  </td>
                  <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{event.cuId}</td>
                  <td className="py-2 pr-3 text-gray-400 text-xs truncate max-w-[180px]">
                    {event.blobName ?? '—'}
                  </td>
                  <td className="py-2 pr-3 text-gray-400 text-xs whitespace-nowrap">
                    {format(new Date(event.timestamp), 'HH:mm:ss')}
                  </td>
                  <td className="py-2 pr-3 text-gray-400 text-xs text-right whitespace-nowrap">
                    {event.totalProcessingDurationMs != null
                      ? `${event.totalProcessingDurationMs.toLocaleString()}ms`
                      : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <StatusBadge status={event.status} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
