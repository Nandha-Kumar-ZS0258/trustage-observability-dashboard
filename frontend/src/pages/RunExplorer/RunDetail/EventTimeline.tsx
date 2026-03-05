import { format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import type { RunEvent } from '../../../types/telemetry';

const EVENT_ORDER = [
  'BlobReceived', 'RunStarted', 'IngestionStarted',
  'ValidationCompleted', 'IngestionCompleted', 'RunCompleted',
];

interface EventTimelineProps {
  events: RunEvent[];
}

export function EventTimeline({ events }: EventTimelineProps) {
  const sorted = [...events].sort(
    (a, b) => EVENT_ORDER.indexOf(a.eventType) - EVENT_ORDER.indexOf(b.eventType)
  );

  return (
    <div className="space-y-0">
      {sorted.map((e, i) => (
        <div key={e.eventId} className="flex gap-3">
          {/* Connector */}
          <div className="flex flex-col items-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            {i < sorted.length - 1 && (
              <div className="w-px flex-1 bg-gray-700 my-1" />
            )}
          </div>

          {/* Content */}
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-medium text-white">{e.eventType}</span>
              <span className="text-xs text-gray-500 font-mono">
                {format(new Date(e.timestamp), 'HH:mm:ss.SSS')}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-gray-400 space-y-0.5">
              {e.blobName    && <p>blob: <span className="text-gray-300 font-mono">{e.blobName}</span></p>}
              {e.hostName    && <p>host: <span className="text-gray-300">{e.hostName}</span>{e.memoryUsedMb != null ? `, memory: ${e.memoryUsedMb.toFixed(1)}MB` : ''}</p>}
              {e.schemaMatchScore != null && <p>schema: <span className="text-gray-300">{e.schemaMatchScore}%</span>, errors: {e.validationErrors ?? 0}</p>}
              {e.rowsProcessed != null && <p>rows: <span className="text-gray-300">{e.rowsProcessed.toLocaleString()}</span></p>}
              {e.totalDurationMs != null && <p>duration: <span className="text-gray-300">{e.totalDurationMs.toLocaleString()}ms</span></p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
