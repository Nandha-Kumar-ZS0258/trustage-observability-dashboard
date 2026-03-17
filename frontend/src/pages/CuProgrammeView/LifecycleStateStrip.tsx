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
        'bg-white border border-[#E2E8F0] rounded-xl p-5 text-left w-full relative overflow-hidden',
        'transition-all duration-150 hover:-translate-y-px hover:shadow-md hover:shadow-black/8',
        // Top 3px colour accent — matches wireframe stat-card::before
        'border-t-[3px]',
        accentClass,
      )}
    >
      {/* Label */}
      <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-widest mb-2">
        {label}
      </p>

      {/* Large value */}
      <p className={clsx('text-[36px] font-bold leading-none mb-1.5 tabular-nums', valueClass)}>
        {count}
      </p>

      {/* Primary sub-label */}
      <p className="text-xs text-[#64748B]">{sub1}</p>

      {/* Staleness warning — amber if applicable */}
      {sub2 && (
        <p className={clsx('text-xs mt-1', sub2Amber ? 'text-[#D97706] font-semibold' : 'text-[#64748B]')}>
          {sub2}
        </p>
      )}

      {/* Click hint */}
      <p className="text-[11px] text-[#2E8CE6] mt-2.5 opacity-70">Click to view all →</p>
    </button>
  );
}

export function LifecycleStateStrip({ onStateClick }: Props) {
  const { data, isLoading } = useLifecycleCounts();
  const v = (n?: number) => (isLoading ? '…' : (n ?? 0));

  const onboarding       = v(data?.onboarding);
  const ready            = v(data?.readyForFirstFeed);
  const bau              = v(data?.bau);
  const total            = v(data?.total);
  const overdueBau       = data?.overdueBau        ?? 0;
  const overdueReady     = data?.overdueReady      ?? 0;
  const avgOnboardingDays = data?.avgOnboardingDays ?? 0;

  return (
    <div className="mb-5">
      {/* Three state cards — full width grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard
          label="Onboarding"
          count={onboarding}
          sub1="CU connectors in development"
          sub2={!isLoading && Number(onboarding) > 0 ? `Avg. ${avgOnboardingDays} days in this state` : undefined}
          accentClass="border-t-[#2E8CE6]"
          valueClass="text-[#1A6DB5]"
          onClick={() => onStateClick('Onboarding')}
        />

        <StatCard
          label="Ready for First Feed"
          count={ready}
          sub1="Deployed, awaiting first delivery"
          sub2={overdueReady > 0 ? `${overdueReady} waiting >7 days` : undefined}
          sub2Amber={overdueReady > 0}
          accentClass="border-t-[#D97706]"
          valueClass="text-[#D97706]"
          onClick={() => onStateClick('ReadyForFirstFeed')}
        />

        <StatCard
          label="BAU"
          count={bau}
          sub1="Live CU partners delivering feeds"
          sub2={overdueBau > 0 ? `${overdueBau} overdue — no feed in 4+ days` : undefined}
          sub2Amber={overdueBau > 0}
          accentClass="border-t-[#16A34A]"
          valueClass="text-[#16A34A]"
          onClick={() => onStateClick('BAU')}
        />
      </div>

      {/* Auto-generated summary sentence — Section 6.2 exact format */}
      {!isLoading && data && (
        <div className="bg-[#0F2744] text-white/85 rounded-lg px-4 py-3 text-sm leading-relaxed">
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
