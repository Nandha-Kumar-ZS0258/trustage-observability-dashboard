import { clsx } from 'clsx';
import type { RunStatus, EventType } from '../types/telemetry';

interface StatusBadgeProps {
  status: RunStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const classes = clsx(
    'badge',
    size === 'sm' && 'text-[10px] px-1.5 py-0',
    {
      'bg-emerald-500/15 text-emerald-400': status === 'success',
      'bg-red-500/15 text-red-400':         status === 'failed',
      'bg-amber-500/15 text-amber-400':     status === 'partial',
      'bg-blue-500/15 text-blue-400':       status === 'retrying',
    }
  );

  const label = {
    success:  'Success',
    failed:   'Failed',
    partial:  'Partial',
    retrying: 'Retrying',
  }[status];

  return <span className={classes}>{label}</span>;
}

interface EventTypeBadgeProps {
  eventType: EventType;
}

export function EventTypeBadge({ eventType }: EventTypeBadgeProps) {
  const classes = clsx('badge text-[10px]', {
    'bg-blue-500/15 text-blue-400':     eventType === 'BlobReceived',
    'bg-emerald-500/15 text-emerald-400': eventType === 'IngestionCompleted' || eventType === 'RunCompleted',
    'bg-purple-500/15 text-purple-400': eventType === 'ValidationCompleted',
    'bg-gray-500/15 text-gray-400':     eventType === 'RunStarted' || eventType === 'IngestionStarted',
  });

  return <span className={classes}>{eventType}</span>;
}
