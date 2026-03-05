import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import { Building2 } from 'lucide-react';
import { useCuHealth } from '../../hooks/useOverviewKpis';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/EmptyState';
import type { RunStatus } from '../../types/telemetry';

function statusDot(status: RunStatus) {
  return clsx('w-2.5 h-2.5 rounded-full', {
    'bg-emerald-400': status === 'success',
    'bg-red-400':     status === 'failed',
    'bg-amber-400':   status === 'partial',
    'bg-blue-400':    status === 'retrying',
  });
}

export function CuHealthGrid() {
  const { data, isLoading } = useCuHealth();
  const navigate = useNavigate();

  if (isLoading) return <LoadingSpinner />;
  if (!data?.length) return <EmptyState message="No CU activity today" />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {data.map(cu => (
        <button
          key={cu.cuId}
          onClick={() => navigate(`/cu/${cu.cuId}`)}
          className="card text-left hover:border-gray-600 transition-colors group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                {cu.cuId}
              </span>
            </div>
            <span className={statusDot(cu.lastRunStatus)} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-500">Last run</p>
              <p className="text-gray-300 mt-0.5">
                {cu.lastRunTime
                  ? formatDistanceToNow(new Date(cu.lastRunTime), { addSuffix: true })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Files today</p>
              <p className="text-gray-300 mt-0.5">{cu.filesToday}</p>
            </div>
            <div>
              <p className="text-gray-500">Rows today</p>
              <p className="text-gray-300 mt-0.5">{cu.rowsToday.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500">SLA</p>
              <p className={clsx('mt-0.5 font-medium', cu.slaBreached ? 'text-red-400' : 'text-emerald-400')}>
                {cu.slaBreached ? 'Breached' : 'Met'}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
