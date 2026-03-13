import { clsx } from 'clsx';
import { useTodaysSummary } from '../../hooks/useTodaysFeeds';

// ── Threshold-aware colour helpers ────────────────────────────────────────────

function successRateAccent(rate: number): string {
  if (rate >= 98) return 'border-t-emerald-500';
  if (rate >= 90) return 'border-t-amber-500';
  return 'border-t-red-500';
}

function successRateValue(rate: number): string {
  if (rate >= 98) return 'text-emerald-400';
  if (rate >= 90) return 'text-amber-400';
  return 'text-red-400';
}

function exceptionsAccent(n: number): string {
  if (n === 0) return 'border-t-emerald-500';
  if (n <= 2)  return 'border-t-amber-500';
  return 'border-t-red-500';
}

function exceptionsValue(n: number): string {
  if (n === 0) return 'text-emerald-400';
  if (n <= 2)  return 'text-amber-400';
  return 'text-red-400';
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface CardProps {
  label: string;
  value: string | number;
  sub: string;
  accentClass: string;
  valueClass: string;
}

function StatCard({ label, value, sub, accentClass, valueClass }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-gray-900 border border-gray-800 rounded-xl p-5 border-t-[3px]',
        accentClass,
      )}
    >
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
        {label}
      </p>
      <p className={clsx('text-[36px] font-bold leading-none mb-1.5 tabular-nums', valueClass)}>
        {value}
      </p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FeedsSummaryStrip() {
  const { data, isLoading } = useTodaysSummary();

  const v = (n?: number, fmt?: (n: number) => string): string => {
    if (isLoading) return '…';
    if (n === undefined || n === null) return '—';
    return fmt ? fmt(n) : String(n);
  };

  const feedsToday       = data?.feedsToday       ?? 0;
  const successRate      = data?.successRate       ?? 0;
  const activeExceptions = data?.activeExceptions  ?? 0;
  const activeBauCus     = data?.activeBauCus      ?? 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      {/* Feeds Received Today — teal */}
      <StatCard
        label="Feeds Received Today"
        value={v(feedsToday)}
        sub="data feeds received since midnight"
        accentClass="border-t-teal-500"
        valueClass="text-teal-400"
      />

      {/* Successful Delivery Rate — threshold coloured */}
      <StatCard
        label="Successful Delivery Rate"
        value={isLoading ? '…' : `${successRate}%`}
        sub={
          !isLoading && data
            ? `${Math.round((successRate / 100) * feedsToday)} of ${feedsToday} feeds delivered clean`
            : 'feeds delivered without exceptions'
        }
        accentClass={successRateAccent(successRate)}
        valueClass={successRateValue(successRate)}
      />

      {/* Active Feed Exceptions — threshold coloured */}
      <StatCard
        label="Active Feed Exceptions"
        value={v(activeExceptions)}
        sub={
          !isLoading && data
            ? activeExceptions === 0
              ? 'no active exceptions'
              : `${activeExceptions} exception${activeExceptions !== 1 ? 's' : ''} require attention`
            : 'unresolved exceptions'
        }
        accentClass={exceptionsAccent(activeExceptions)}
        valueClass={exceptionsValue(activeExceptions)}
      />

      {/* BAU Partners Active Today — blue */}
      <StatCard
        label="BAU Partners Active Today"
        value={v(activeBauCus)}
        sub="CU partners that delivered a feed today"
        accentClass="border-t-blue-500"
        valueClass="text-blue-400"
      />
    </div>
  );
}
