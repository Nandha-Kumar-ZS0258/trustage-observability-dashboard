import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = 'No data available' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
      <Inbox className="w-10 h-10" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
