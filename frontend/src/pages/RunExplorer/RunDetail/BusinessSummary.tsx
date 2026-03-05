import { SlaIndicator } from '../../../components/SlaIndicator';
import type { BusinessDetail } from '../../../types/telemetry';

interface BusinessSummaryProps {
  business: BusinessDetail;
}

export function BusinessSummary({ business: b }: BusinessSummaryProps) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="bg-gray-800 rounded-lg p-2.5">
        <dt className="text-xs text-gray-500">File Type</dt>
        <dd className="text-sm text-white mt-0.5">{b.fileType ?? '—'}</dd>
      </div>
      <div className="bg-gray-800 rounded-lg p-2.5">
        <dt className="text-xs text-gray-500">Expected Records</dt>
        <dd className="text-sm text-white mt-0.5">{b.expectedRecordCount?.toLocaleString() ?? '—'}</dd>
      </div>
      <div className="bg-gray-800 rounded-lg p-2.5">
        <dt className="text-xs text-gray-500">Actual Records</dt>
        <dd className="text-sm text-white mt-0.5">{b.actualRecordCount?.toLocaleString() ?? '—'}</dd>
      </div>
      <div className="bg-gray-800 rounded-lg p-2.5">
        <dt className="text-xs text-gray-500">SLA Threshold</dt>
        <dd className="text-sm text-white mt-0.5">
          {b.slaThresholdMs != null ? `${b.slaThresholdMs.toLocaleString()}ms` : '—'}
        </dd>
      </div>
      <div className="bg-gray-800 rounded-lg p-2.5">
        <dt className="text-xs text-gray-500">SLA Status</dt>
        <dd className="mt-0.5"><SlaIndicator breached={b.slaBreach ?? null} /></dd>
      </div>
      <div className="bg-gray-800 rounded-lg p-2.5">
        <dt className="text-xs text-gray-500">First Run of Day</dt>
        <dd className="text-sm text-white mt-0.5">{b.isFirstRunOfDay ? 'Yes' : 'No'}</dd>
      </div>
      <div className="bg-gray-800 rounded-lg p-2.5">
        <dt className="text-xs text-gray-500">Files Today (CU)</dt>
        <dd className="text-sm text-white mt-0.5">{b.filesReceivedTodayForCu ?? '—'}</dd>
      </div>
    </dl>
  );
}
