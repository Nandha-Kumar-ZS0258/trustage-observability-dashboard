import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { SlaIndicator } from '../../components/SlaIndicator';
import { EmptyState } from '../../components/EmptyState';
import type { RunSummary } from '../../types/telemetry';

interface RunTableProps {
  runs: RunSummary[];
}

function deriveStatus(run: RunSummary) {
  if ((run.rowsFailed ?? 0) > 0 && (run.rowsProcessed ?? 0) > 0) return 'partial' as const;
  if (run.rowsFailed != null && run.rowsFailed > 0) return 'failed' as const;
  return 'success' as const;
}

export function RunTable({ runs }: RunTableProps) {
  const navigate = useNavigate();

  if (!runs.length) return <EmptyState message="No runs match your filters" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left">
            {['CU', 'File', 'Type', 'Started', 'Duration', 'Member Records', 'Records Rejected', 'Data Validation', 'SLA', ''].map(h => (
              <th key={h} className="pb-2.5 pr-4 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {runs.map(run => (
            <tr
              key={run.correlationId}
              onClick={() => navigate(`/runs/${run.correlationId}`)}
              className="table-row-hover"
            >
              <td className="py-2.5 pr-4 font-mono text-xs text-gray-300">{run.cuId}</td>
              <td className="py-2.5 pr-4 text-gray-400 text-xs truncate max-w-[160px]">
                {run.blobName ?? '—'}
              </td>
              <td className="py-2.5 pr-4 text-gray-400 text-xs">{run.fileType ?? '—'}</td>
              <td className="py-2.5 pr-4 text-gray-400 text-xs whitespace-nowrap">
                {format(new Date(run.startedAt), 'MMM d, HH:mm:ss')}
              </td>
              <td className="py-2.5 pr-4 text-gray-300 text-xs whitespace-nowrap tabular-nums">
                {run.totalProcessingDurationMs != null
                  ? `${run.totalProcessingDurationMs.toLocaleString()}ms`
                  : '—'}
              </td>
              <td className="py-2.5 pr-4 text-gray-300 text-xs tabular-nums">
                {run.rowsProcessed?.toLocaleString() ?? '—'}
              </td>
              <td className="py-2.5 pr-4 text-xs tabular-nums">
                <span className={run.rowsFailed ? 'text-red-400' : 'text-gray-500'}>
                  {run.rowsFailed?.toLocaleString() ?? '0'}
                </span>
              </td>
              <td className="py-2.5 pr-4">
                <StatusBadge
                  status={run.validationPassed === false ? 'failed' : 'success'}
                  size="sm"
                />
              </td>
              <td className="py-2.5 pr-4">
                <SlaIndicator breached={run.slaBreach ?? null} />
              </td>
              <td className="py-2.5">
                <StatusBadge status={deriveStatus(run)} size="sm" />
              </td>
              <td className="py-2.5 pl-2 text-gray-600">
                <ChevronRight className="w-4 h-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
