import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import type { FeedSummary, FeedStatus } from '../../types/programme';
import type { FeedListFilters } from '../../hooks/useFeedHistory';
import { useFeedList } from '../../hooks/useFeedHistory';
import { FeedDetail } from './FeedDetail/FeedDetail';

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: FeedStatus }) {
  const cls =
    status === 'Delivered' ? 'badge bg-emerald-500/15 text-emerald-400' :
    status === 'Failed'    ? 'badge bg-red-500/15 text-red-400'         :
    status === 'Partial'   ? 'badge bg-amber-500/15 text-amber-400'     :
                             'badge bg-blue-500/15 text-blue-400';
  return <span className={cls}>{status}</span>;
}

// ── Data Alignment Score cell ─────────────────────────────────────────────────

function AlignmentScore({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-600">—</span>;
  const pct = `${score.toFixed(1)}%`;
  const cls =
    score >= 95 ? 'text-emerald-400 font-semibold' :
    score >= 80 ? 'text-amber-400 font-semibold'   :
                  'text-red-400 font-semibold';
  return <span className={cls}>{pct}</span>;
}

// ── Feed started timestamp ────────────────────────────────────────────────────

function FeedStartedCell({ iso }: { iso: string }) {
  const d = parseISO(iso);
  const prefix = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'dd MMM yyyy');
  return <span className="text-gray-300 text-sm whitespace-nowrap">{prefix} {format(d, 'HH:mm:ss')}</span>;
}

// ── Main table component ──────────────────────────────────────────────────────

interface Props {
  filters: FeedListFilters;
  initialFeedRefId?: string;
}

export function FeedListTable({ filters, initialFeedRefId }: Props) {
  const navigate = useNavigate();
  const [selectedFeedRefId, setSelectedFeedRefId] = useState<string | null>(initialFeedRefId ?? null);

  // When navigated to /history/:feedRefId, open the panel for that feed
  useEffect(() => {
    if (initialFeedRefId) setSelectedFeedRefId(initialFeedRefId);
  }, [initialFeedRefId]);

  const { data: rawData, isLoading } = useFeedList(filters);
  const feeds: FeedSummary[] = Array.isArray(rawData) ? rawData : [];

  return (
    <>
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0F2744] border-b border-gray-700">
                {[
                  'Feed Reference ID',
                  'CU Partner Name',
                  'Feed Started',
                  'Total Duration',
                  'Member Records Processed',
                  'Records Rejected',
                  'Data Alignment Score',
                  'Status',
                ].map(col => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500 text-sm">
                    Loading…
                  </td>
                </tr>
              ) : feeds.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500 text-sm">
                    No data feeds match the current filters.
                  </td>
                </tr>
              ) : (
                feeds.map((feed, i) => (
                  <tr
                    key={feed.feedReferenceId}
                    onClick={() => setSelectedFeedRefId(feed.feedReferenceId)}
                    className={clsx(
                      'border-b border-gray-800 cursor-pointer transition-colors',
                      'hover:bg-blue-950/30',
                      i % 2 === 1 && 'bg-gray-900/30',
                    )}
                  >
                    {/* Feed Reference ID — monospace, muted */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] text-gray-500">
                        {feed.feedReferenceId}
                      </span>
                    </td>

                    {/* CU Partner Name — link to CU Detail */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        className="text-blue-400 hover:text-blue-300 font-semibold text-sm text-left"
                        onClick={e => { e.stopPropagation(); navigate(`/cu/${feed.cuId}`); }}
                      >
                        {feed.cuName}
                      </button>
                    </td>

                    {/* Feed Started */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <FeedStartedCell iso={feed.feedStarted} />
                    </td>

                    {/* Total Duration */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-sm tabular-nums">
                      {feed.totalDurationMs != null
                        ? `${(feed.totalDurationMs / 1000).toFixed(1)}s`
                        : <span className="text-gray-600">—</span>}
                    </td>

                    {/* Member Records Processed */}
                    <td className="px-4 py-3 text-gray-300 text-sm tabular-nums">
                      {feed.memberRecordsProcessed != null
                        ? feed.memberRecordsProcessed.toLocaleString()
                        : <span className="text-gray-600">—</span>}
                    </td>

                    {/* Records Rejected — red if > 0 */}
                    <td className="px-4 py-3 text-sm tabular-nums">
                      {feed.recordsRejected != null ? (
                        <span className={feed.recordsRejected > 0 ? 'text-red-400 font-semibold' : 'text-gray-300'}>
                          {feed.recordsRejected.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>

                    {/* Data Alignment Score */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <AlignmentScore score={feed.dataAlignmentScore} />
                    </td>

                    {/* Status pill */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusPill status={feed.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Row count footer */}
        {!isLoading && (
          <div className="px-4 py-2.5 border-t border-gray-800 bg-gray-900/50 text-center">
            <p className="text-[12px] text-gray-500">
              {feeds.length === 0
                ? 'No data feeds found'
                : `Showing ${feeds.length} feed${feeds.length !== 1 ? 's' : ''} — click any row to view full step-by-step detail`}
            </p>
          </div>
        )}
      </div>

      <FeedDetail
        feedReferenceId={selectedFeedRefId}
        onClose={() => setSelectedFeedRefId(null)}
        breadcrumb="Feed History"
      />
    </>
  );
}
