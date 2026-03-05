import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import {
  useSchemaHealth, useValidationFailures, useSchemaDriftAlerts, useColumnAnomalies,
} from '../../hooks/useSchemaHealth';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/EmptyState';

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up')     return <TrendingUp   className="w-4 h-4 text-emerald-400" />;
  if (trend === 'down')   return <TrendingDown className="w-4 h-4 text-red-400"     />;
  return                         <Minus        className="w-4 h-4 text-gray-500"    />;
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-500">—</span>;
  const color = score >= 95 ? 'bg-emerald-500' : score >= 80 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden max-w-[80px]">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-300">{score.toFixed(1)}%</span>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
      {message}
    </div>
  );
}

export default function SchemaHealth() {
  const { data: health,     isLoading: loadH, error: errH } = useSchemaHealth();
  const { data: failures,   isLoading: loadF, error: errF } = useValidationFailures();
  const { data: driftAlerts }                                = useSchemaDriftAlerts();
  const { data: anomalies,  isLoading: loadA, error: errA } = useColumnAnomalies();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Schema Health</h1>
        <p className="text-xs text-gray-500 mt-0.5">Validation scores, drift detection, and column anomalies</p>
      </div>

      {/* Drift alerts */}
      {driftAlerts && driftAlerts.length > 0 && (
        <div className="space-y-2">
          {driftAlerts.map(alert => (
            <div key={alert.cuId} className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-medium text-white">{alert.cuId}</span>
                <span className="text-red-300 ml-2">
                  schema score dropped {alert.drop.toFixed(1)} points
                  (current: {alert.currentScore?.toFixed(1)}%, 30d avg: {alert.avgScore30d?.toFixed(1)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Health scorecard */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Schema Health Scorecard</h2>
        {loadH ? <LoadingSpinner /> : errH ? (
          <ErrorBanner message={`Failed to load: ${(errH as Error).message}`} />
        ) : !health?.length ? <EmptyState /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['CU', 'Schema Score', 'Last Validated', 'Trend'].map(h => (
                    <th key={h} className="pb-2 pr-4 text-xs text-gray-500 font-medium text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {health.map(row => (
                  <tr key={row.cuId}>
                    <td className="py-2.5 pr-4 text-xs font-mono text-gray-300">{row.cuId}</td>
                    <td className="py-2.5 pr-4">
                      <ScoreBar score={row.latestSchemaMatchScore} />
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-gray-400">
                      {row.lastValidationTime
                        ? format(new Date(row.lastValidationTime), 'MMM d, HH:mm')
                        : '—'}
                    </td>
                    <td className="py-2.5">
                      <TrendIcon trend={row.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Validation failures */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Validation Failure Log (last 30 days)</h2>
        {loadF ? <LoadingSpinner /> : errF ? (
          <ErrorBanner message={`Failed to load: ${(errF as Error).message}`} />
        ) : !failures?.length ? <EmptyState message="No validation failures" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['CU', 'File', 'Time', 'Errors', 'Missing Columns', 'Unknown Columns'].map(h => (
                    <th key={h} className="pb-2 pr-4 text-xs text-gray-500 font-medium text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {failures.map(f => {
                  const missing = f.missingColumns ? (JSON.parse(f.missingColumns) as string[]) : [];
                  const unknown = f.unknownColumns ? (JSON.parse(f.unknownColumns) as string[]) : [];
                  return (
                    <tr key={f.correlationId}>
                      <td className="py-2 pr-4 text-xs font-mono text-gray-300">{f.cuId}</td>
                      <td className="py-2 pr-4 text-xs text-gray-400 truncate max-w-[140px]">{f.blobName ?? '—'}</td>
                      <td className="py-2 pr-4 text-xs text-gray-500 whitespace-nowrap">
                        {format(new Date(f.timestamp), 'MMM d, HH:mm')}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="badge bg-red-500/15 text-red-400 text-[10px]">{f.errorCount ?? 0}</span>
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-400">
                        {missing.length > 0 ? missing.join(', ') : '—'}
                      </td>
                      <td className="py-2 text-xs text-gray-400">
                        {unknown.length > 0 ? unknown.join(', ') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Column anomalies */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Column Anomaly Tracker (last 30 days)</h2>
        {loadA ? <LoadingSpinner /> : errA ? (
          <ErrorBanner message={`Failed to load: ${(errA as Error).message}`} />
        ) : !anomalies?.length ? <EmptyState message="No column anomalies" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Column Name', 'Type', 'Occurrences'].map(h => (
                    <th key={h} className="pb-2 pr-4 text-xs text-gray-500 font-medium text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {anomalies.map((a, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 text-sm font-mono text-gray-300">{a.columnName}</td>
                    <td className="py-2 pr-4">
                      <span className={clsx('badge text-[10px]', a.anomalyType === 'missing'
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-amber-500/15 text-amber-400'
                      )}>
                        {a.anomalyType}
                      </span>
                    </td>
                    <td className="py-2 text-sm tabular-nums text-gray-400">{a.occurrenceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
