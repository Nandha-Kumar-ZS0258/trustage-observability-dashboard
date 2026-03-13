import { useState } from 'react';
import { clsx } from 'clsx';
import { parseISO, format, startOfDay, differenceInMinutes } from 'date-fns';
import type { GanttEntry, FeedStatus } from '../../types/programme';
import { useGanttData } from '../../hooks/useTodaysFeeds';
import { FeedDetail } from '../FeedHistory/FeedDetail/FeedDetail';

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_MINUTES = 1440; // 24 × 60
const LABEL_W       = 160;  // px — CU name column, matches wireframe

const TIME_TICKS = [
  { minute: 0,    label: '00:00' },
  { minute: 180,  label: '03:00' },
  { minute: 360,  label: '06:00' },
  { minute: 540,  label: '09:00' },
  { minute: 720,  label: '12:00' },
  { minute: 900,  label: '15:00' },
  { minute: 1080, label: '18:00' },
  { minute: 1260, label: '21:00' },
  { minute: 1439, label: '23:59' },
];

// ── Positioning helpers ───────────────────────────────────────────────────────

/** Convert a UTC ISO timestamp to minutes elapsed since local midnight */
function toMinutes(iso: string): number {
  const d = parseISO(iso);
  return differenceInMinutes(d, startOfDay(d));
}

/** Convert minutes to a percentage string (0–100) */
function pct(minutes: number): string {
  return `${((minutes / TOTAL_MINUTES) * 100).toFixed(4)}%`;
}

// ── Bar colour by FeedStatus ──────────────────────────────────────────────────

function barColour(status: FeedStatus): string {
  switch (status) {
    case 'Delivered':  return '#16A34A'; // emerald
    case 'Failed':     return '#DC2626'; // red
    case 'Partial':    return '#D97706'; // amber
    case 'InProgress': return '#2E8CE6'; // blue
    default:           return '#64748B';
  }
}

// ── Tooltip text for a feed bar ───────────────────────────────────────────────

function barTitle(
  cuName: string,
  feed: GanttEntry['feeds'][number],
): string {
  const start = format(parseISO(feed.startedAt), 'HH:mm:ss');
  const dur   = feed.durationMs != null
    ? `${(feed.durationMs / 1000).toFixed(1)}s`
    : '—';
  const rec   = feed.memberRecords != null
    ? feed.memberRecords.toLocaleString() + ' member records'
    : 'no records';
  return `${cuName}\nStarted: ${start}  ·  Duration: ${dur}\n${rec}  ·  ${feed.status}`;
}

// ── Single feed bar ───────────────────────────────────────────────────────────

interface FeedBarProps {
  cuName: string;
  feed: GanttEntry['feeds'][number];
  onClick: (feedRefId: string) => void;
}

function FeedBar({ cuName, feed, onClick }: FeedBarProps) {
  const startMin  = toMinutes(feed.startedAt);
  const durMin    = feed.durationMs != null ? feed.durationMs / 60_000 : 0;
  const widthMin  = Math.max(durMin, TOTAL_MINUTES * 0.005); // min 0.5% visibility

  const leftPct  = pct(startMin);
  const widthPct = pct(widthMin);
  const colour   = barColour(feed.status);

  const label =
    feed.status === 'Failed'  ? 'Failed ✗' :
    feed.status === 'Partial' ? 'Partial ⚠' :
    feed.durationMs != null   ? `${(feed.durationMs / 1000).toFixed(1)}s ✓` :
                                '…';

  return (
    <div
      role="button"
      tabIndex={0}
      title={barTitle(cuName, feed)}
      onClick={() => onClick(feed.feedReferenceId)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(feed.feedReferenceId); }}
      className="absolute h-full rounded flex items-center px-2 text-[10px] font-bold text-white
                 overflow-hidden whitespace-nowrap cursor-pointer transition-opacity hover:opacity-80"
      style={{ left: leftPct, width: widthPct, background: colour }}
    >
      {label}
    </div>
  );
}

// ── Expected delivery window band ─────────────────────────────────────────────

interface ExpectedBandProps {
  windowStart: string;
  windowEnd: string;
}

function ExpectedBand({ windowStart, windowEnd }: ExpectedBandProps) {
  const startMin = toMinutes(windowStart);
  const endMin   = toMinutes(windowEnd);
  const durMin   = Math.max(endMin - startMin, TOTAL_MINUTES * 0.01); // at least 1% wide

  return (
    <div
      className="absolute h-full rounded"
      style={{
        left:             pct(startMin),
        width:            pct(durMin),
        background:       'rgba(148,163,184,0.15)',
        border:           '1px dashed #CBD5E1',
        borderRadius:     '4px',
      }}
    />
  );
}

// ── Overdue label ─────────────────────────────────────────────────────────────

function OverdueLabel() {
  return (
    <div className="absolute inset-0 flex items-center px-2 gap-1.5 text-[11px] font-semibold text-amber-400">
      <span>⚠</span>
      <span>Overdue — expected window passed, no feed received</span>
    </div>
  );
}

// ── Single CU row ─────────────────────────────────────────────────────────────

interface GanttRowProps {
  entry: GanttEntry;
  now: Date;
  onBarClick: (feedRefId: string) => void;
}

function GanttRow({ entry, now, onBarClick }: GanttRowProps) {
  const hasSchedule  = entry.expectedWindowStart !== null && entry.expectedWindowEnd !== null;
  const windowPassed = hasSchedule && parseISO(entry.expectedWindowEnd!) < now;
  const isOverdue    = windowPassed && entry.feeds.length === 0;

  return (
    <div className="flex items-center mb-2 min-h-[32px]">
      {/* CU name label */}
      <div
        className="shrink-0 pr-3 text-[12px] font-semibold text-gray-300 truncate"
        style={{ width: `${LABEL_W}px` }}
        title={entry.cuName}
      >
        {entry.cuName}
      </div>

      {/* Track */}
      <div className="flex-1 relative h-7 bg-gray-800/40 rounded" style={{ minWidth: '400px' }}>
        {/* Expected window band */}
        {hasSchedule && !isOverdue && (
          <ExpectedBand
            windowStart={entry.expectedWindowStart!}
            windowEnd={entry.expectedWindowEnd!}
          />
        )}

        {/* Overdue label — shown when window has passed with no feed */}
        {isOverdue && <OverdueLabel />}

        {/* Feed bars */}
        {entry.feeds.map(feed => (
          <FeedBar
            key={feed.feedReferenceId}
            cuName={entry.cuName}
            feed={feed}
            onClick={onBarClick}
          />
        ))}
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { colour: '#16A34A', label: 'Delivered' },
    { colour: '#DC2626', label: 'Failed' },
    { colour: '#D97706', label: 'Partial' },
    { colour: '#2E8CE6', label: 'In Progress' },
  ];
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {items.map(({ colour, label }) => (
        <div key={label} className="flex items-center gap-1.5 text-[11px] text-white/60">
          <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: colour }} />
          {label}
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-[11px] text-white/60">
        <span
          className="w-3 h-3 rounded-sm shrink-0"
          style={{ background: 'rgba(148,163,184,0.3)', border: '1px dashed #CBD5E1' }}
        />
        Expected window
      </div>
    </div>
  );
}

// ── Current time indicator position ──────────────────────────────────────────

function nowMinutes(): number {
  const now = new Date();
  return differenceInMinutes(now, startOfDay(now));
}

// ── Main component ────────────────────────────────────────────────────────────

export function DeliveryGantt() {
  const [selectedFeedRefId, setSelectedFeedRefId] = useState<string | null>(null);

  const { data: rawData, isLoading } = useGanttData();
  const entries: GanttEntry[] = Array.isArray(rawData) ? rawData : [];

  const now = new Date();
  const nowMin = nowMinutes();

  return (
    <>
      <div className="bg-gray-950 border border-gray-800 rounded-xl mb-5 overflow-hidden">
        {/* Navy header */}
        <div className="bg-[#0F2744] px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-sm font-bold text-white shrink-0">
            Delivery Schedule — Today
          </h3>
          <Legend />
        </div>

        {/* Body */}
        <div className="px-4 py-4 overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-gray-500 text-center py-6">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No schedule data available for today.
            </p>
          ) : (
            <div style={{ minWidth: `${LABEL_W + 600}px` }}>
              {/* Time axis */}
              <div className="flex mb-2" style={{ marginLeft: `${LABEL_W}px` }}>
                {TIME_TICKS.map(tick => (
                  <div
                    key={tick.minute}
                    className="flex-1 text-[10px] text-gray-500 font-mono text-center"
                  >
                    {tick.label}
                  </div>
                ))}
              </div>

              {/* CU rows */}
              <div className="relative">
                {/* Current time vertical line */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-blue-500/50 z-10 pointer-events-none"
                  style={{ left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${nowMin / TOTAL_MINUTES})` }}
                  title={`Now: ${format(now, 'HH:mm')}`}
                />

                {entries.map(entry => (
                  <GanttRow
                    key={entry.cuId}
                    entry={entry}
                    now={now}
                    onBarClick={setSelectedFeedRefId}
                  />
                ))}
              </div>

              {/* Overdue count footer */}
              {(() => {
                const overdue = entries.filter(
                  e =>
                    e.expectedWindowEnd !== null &&
                    parseISO(e.expectedWindowEnd) < now &&
                    e.feeds.length === 0,
                ).length;
                return overdue > 0 ? (
                  <p className="text-[11px] text-amber-400 font-semibold mt-2 text-center">
                    ⚠ {overdue} CU partner{overdue !== 1 ? 's' : ''} overdue — expected window passed with no feed received
                  </p>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Feed Detail slide-over — opens when a bar is clicked */}
      <FeedDetail
        feedReferenceId={selectedFeedRefId}
        onClose={() => setSelectedFeedRefId(null)}
      />
    </>
  );
}
