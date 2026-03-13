import { clsx } from 'clsx';
import { useExceptionSummary } from '../../hooks/useExceptions';

interface CardProps {
  label: string;
  value: number | string;
  sub: string;
  accentClass: string;
  valueClass: string;
}

function SummaryCard({ label, value, sub, accentClass, valueClass }: CardProps) {
  return (
    <div className={clsx('bg-gray-900 border border-gray-800 rounded-xl p-5 relative overflow-hidden border-t-2', accentClass)}>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">{label}</p>
      <p className={clsx('text-4xl font-bold tabular-nums leading-none mb-2', valueClass)}>{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

export function ExceptionSummaryStrip() {
  const { data, isLoading } = useExceptionSummary();
  const v = (n?: number) => (isLoading ? '…' : (n ?? '—'));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <SummaryCard
        label="Total Exceptions (all time)"
        value={v(data?.totalAllTime)}
        sub="Since programme start"
        accentClass="border-t-gray-500"
        valueClass="text-gray-400"
      />
      <SummaryCard
        label="Active — Unresolved"
        value={v(data?.activeUnresolved)}
        sub="Requiring attention"
        accentClass="border-t-red-500"
        valueClass="text-red-400"
      />
      <SummaryCard
        label="Resolved Today"
        value={v(data?.resolvedToday)}
        sub="Cleared today"
        accentClass="border-t-emerald-500"
        valueClass="text-emerald-400"
      />
      <SummaryCard
        label="Recurring Exceptions"
        value={v(data?.recurringCount)}
        sub="Same issue seen multiple times"
        accentClass="border-t-amber-500"
        valueClass="text-amber-400"
      />
    </div>
  );
}
