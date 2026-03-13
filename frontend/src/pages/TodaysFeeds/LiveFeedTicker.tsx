import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import type { FeedSummary, FeedStatus } from '../../types/programme';
import { useFeedTicker } from '../../hooks/useTodaysFeeds';
import { useLiveFeed } from '../../hooks/useLiveFeed';

// ── Badge type derivation from FeedStatus ─────────────────────────────────────
// Maps each feed status to a live event badge per MONITORING_SPEC nomenclature

type BadgeType = 'received' | 'delivered' | 'exception' | 'validation';

function getBadgeType(status: FeedStatus): BadgeType {
  switch (status) {
    case 'Delivered':
    case 'Partial':    return 'delivered';
    case 'Failed':     return 'exception';
    case 'InProgress': return 'received';
    default:           return 'received';
  }
}

// ── Step badge component ──────────────────────────────────────────────────────
// Colours per WIREFRAME_REFERENCE.html Tab 2 ticker section

interface BadgeProps {
  type: BadgeType;
  isPartial?: boolean;
}

function StepBadge({ type, isPartial }: BadgeProps) {
  const { cls, label } = (() => {
    switch (type) {
      case 'received':
        return { cls: 'badge bg-blue-500/15 text-blue-400',    label: 'Feed Received' };
      case 'delivered':
        return isPartial
          ? { cls: 'badge bg-amber-500/15 text-amber-400',    label: 'Feed Delivered' }
          : { cls: 'badge bg-emerald-500/15 text-emerald-400', label: 'Feed Delivered' };
      case 'exception':
        return { cls: 'badge bg-red-500/15 text-red-400',      label: 'Exception' };
      case 'validation':
        return { cls: 'badge bg-teal-500/15 text-teal-400',    label: 'Data Validation Check' };
    }
  })();
  return <span className={clsx(cls, 'whitespace-nowrap text-[10px] font-semibold px-2 py-0.5 rounded-full')}>{label}</span>;
}

// ── Duration formatter ────────────────────────────────────────────────────────

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Single ticker row ─────────────────────────────────────────────────────────

function TickerRow({ feed }: { feed: FeedSummary }) {
  const badgeType = getBadgeType(feed.status);
  const isException = feed.status === 'Failed';
  const isPartial = feed.status === 'Partial';

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 last:border-0 text-sm',
        isException ? 'bg-red-950/25' : 'hover:bg-gray-800/30',
      )}
    >
      {/* Step badge */}
      <div className="w-36 shrink-0">
        <StepBadge type={badgeType} isPartial={isPartial} />
      </div>

      {/* CU name */}
      <span className="w-44 shrink-0 text-gray-200 font-medium truncate text-xs">
        {feed.cuName}
      </span>

      {/* Feed Reference ID (as identifier — no blobName on this type) */}
      <span className="flex-1 min-w-0 font-mono text-[11px] text-gray-500 truncate">
        {feed.feedReferenceId}
      </span>

      {/* Timestamp */}
      <span className="w-16 shrink-0 font-mono text-[11px] text-gray-500 text-right">
        {format(parseISO(feed.feedStarted), 'HH:mm:ss')}
      </span>

      {/* Duration */}
      <span className={clsx(
        'w-14 shrink-0 font-mono text-[11px] text-right',
        feed.totalDurationMs != null ? 'text-gray-400' : 'text-gray-600',
      )}>
        {fmtDuration(feed.totalDurationMs)}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LiveFeedTicker() {
  // SignalR push invalidation — invalidates feed-ticker + today-summary on new events
  useLiveFeed();

  const { data: rawData, isLoading } = useFeedTicker();
  const feeds: FeedSummary[] = Array.isArray(rawData) ? rawData : [];

  // Sort: exceptions first (floated to top), then by feedStarted descending
  const sorted = [...feeds].sort((a, b) => {
    const aExc = a.status === 'Failed' ? 0 : 1;
    const bExc = b.status === 'Failed' ? 0 : 1;
    if (aExc !== bExc) return aExc - bExc;
    return b.feedStarted.localeCompare(a.feedStarted);
  });

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden mb-5">
      {/* Header */}
      <div className="bg-[#0F2744] px-4 py-3 flex items-center gap-2.5">
        {/* Live pulse dot */}
        <span className="relative flex w-2.5 h-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-emerald-500" />
        </span>
        <h3 className="text-sm font-bold text-white">Live Feed Events</h3>
        <span className="text-[11px] text-white/50 ml-1">
          Last 30 events · auto-refreshing
        </span>
      </div>

      {/* Ticker rows */}
      {isLoading ? (
        <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          No feed events received today.
        </p>
      ) : (
        <div>
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-1.5 border-b border-gray-800 bg-gray-900/50">
            <div className="w-36 shrink-0 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Event</div>
            <div className="w-44 shrink-0 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">CU Partner</div>
            <div className="flex-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Feed Reference ID</div>
            <div className="w-16 shrink-0 text-[10px] font-semibold text-gray-600 uppercase tracking-wider text-right">Time</div>
            <div className="w-14 shrink-0 text-[10px] font-semibold text-gray-600 uppercase tracking-wider text-right">Duration</div>
          </div>
          {sorted.map(feed => (
            <TickerRow key={feed.feedReferenceId} feed={feed} />
          ))}
        </div>
      )}
    </div>
  );
}
