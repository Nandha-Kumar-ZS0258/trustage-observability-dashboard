import { clsx } from 'clsx';

interface SlaIndicatorProps {
  breached: boolean | null;
}

export function SlaIndicator({ breached }: SlaIndicatorProps) {
  if (breached === null) return <span className="text-gray-500 text-xs">—</span>;

  return (
    <span className={clsx('badge text-xs', breached
      ? 'bg-red-500/15 text-red-400'
      : 'bg-emerald-500/15 text-emerald-400'
    )}>
      {breached ? 'Breached' : 'Met'}
    </span>
  );
}
