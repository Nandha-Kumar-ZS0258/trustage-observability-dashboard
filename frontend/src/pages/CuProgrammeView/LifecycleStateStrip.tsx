import { clsx } from 'clsx';
import type { LifecycleState } from '../../types/programme';
import { useLifecycleCounts } from '../../hooks/useProgramme';

interface Props {
  onStateClick: (state: LifecycleState) => void;
}

interface CardProps {
  label: string;
  count: number | string;
  sub1: string;
  sub2?: string;
  sub2Amber?: boolean;
  accentClass: string;
  valueClass: string;
  onClick: () => void;
}

function StatCard({ label, count, sub1, sub2, sub2Amber, accentClass, valueClass, onClick }: CardProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'bg-gray-900 border border-gray-800 rounded-xl p-5 text-left w-full relative overflow-hidden',
        'transition-all duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-black/25',
        // Top 3px colour accent — matches wireframe stat-card::before
        'border-t-[3px]',
        accentClass,
      )}
    >
      {/* Label */}
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
        {label}
      </p>

      {/* Large value */}
      <p className={clsx('text-[36px] font-bold leading-none mb-1.5 tabular-nums', valueClass)}>
        {count}
      </p>

      {/* Primary sub-label */}
      <p className="text-xs text-gray-500">{sub1}</p>

      {/* Staleness warning — amber if applicable */}
      {sub2 && (
        <p className={clsx('text-xs mt-1', sub2Amber ? 'text-amber-400 font-semibold' : 'text-gray-500')}>
          {sub2}
        </p>
      )}

      {/* Click hint */}
      <p className="text-[11px] text-blue-400 mt-2.5 opacity-70">Click to view all →</p>
    </button>
  );
}

export function LifecycleStateStrip({ onStateClick }: Props) {
  const { data, isLoading } = useLifecycleCounts();
  const v = (n?: number) => (isLoading ? '…' : (n ?? 0));

  const onboarding  = v(data?.onboarding);
  const ready       = v(data?.readyForFirstFeed);
  const bau         = v(data?.bau);
  const total       = v(data?.total);
  const overdueBau  = data?.overdueBau  ?? 0;
  const overdueReady = data?.overdueReady ?? 0;

  return (
    <div className="mb-5">
      {/* Three state cards — full width grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard
          label="Onboarding"
          count={onboarding}
          sub1="CU connectors in development"
          accentClass="border-t-blue-500"
          valueClass="text-blue-400"
          onClick={() => onStateClick('Onboarding')}
        />

        <StatCard
          label="Ready for First Feed"
          count={ready}
          sub1="Deployed, awaiting first delivery"
          sub2={overdueReady > 0 ? `${overdueReady} waiting >7 days` : undefined}
          sub2Amber={overdueReady > 0}
          accentClass="border-t-amber-500"
          valueClass="text-amber-400"
          onClick={() => onStateClick('ReadyForFirstFeed')}
        />

        <StatCard
          label="BAU"
          count={bau}
          sub1="Live CU partners delivering feeds"
          sub2={overdueBau > 0 ? `${overdueBau} overdue — no feed in 4+ days` : undefined}
          sub2Amber={overdueBau > 0}
          accentClass="border-t-emerald-500"
          valueClass="text-emerald-400"
          onClick={() => onStateClick('BAU')}
        />
      </div>

      {/* Auto-generated summary sentence — Section 6.2 exact format */}
      {!isLoading && data && (
        <div className="bg-gray-800 text-gray-300 rounded-lg px-4 py-3 text-sm leading-relaxed">
          As of today,{' '}
          <strong className="text-white">
            {bau} of {total} registered CU partners are in BAU
          </strong>
          {' '}— delivering data feeds to TruStage Standard.{' '}
          <strong className="text-white">
            {ready} {Number(ready) === 1 ? 'is' : 'are'} deployed and awaiting their first feed delivery.
          </strong>
          {' '}{onboarding} CU connector{Number(onboarding) === 1 ? '' : 's'}{' '}
          {Number(onboarding) === 1 ? 'is' : 'are'} currently in development.
        </div>
      )}
    </div>
  );
}
