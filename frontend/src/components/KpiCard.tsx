import { clsx } from 'clsx';

type Severity = 'good' | 'warning' | 'critical' | 'neutral';

interface KpiCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  severity?: Severity;
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, subLabel, severity = 'neutral', icon }: KpiCardProps) {
  const valueClass = clsx('text-3xl font-bold tabular-nums', {
    'text-emerald-400': severity === 'good',
    'text-amber-400':   severity === 'warning',
    'text-red-400':     severity === 'critical',
    'text-white':       severity === 'neutral',
  });

  return (
    <div className="card flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-gray-500">{icon}</span>}
      </div>
      <span className={valueClass}>{value}</span>
      {subLabel && <span className="text-xs text-gray-500">{subLabel}</span>}
    </div>
  );
}
