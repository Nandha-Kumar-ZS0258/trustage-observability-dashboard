import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useRunDetail } from '../../../hooks/useRunDetail';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { DurationBar } from '../../../components/DurationBar';
import { EventTimeline } from './EventTimeline';
import { ValidationReport } from './ValidationReport';
import { HostSnapshot } from './HostSnapshot';
import { BusinessSummary } from './BusinessSummary';

function Section({ title, children, defaultOpen = true }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <ChevronDown className={clsx('w-4 h-4 text-gray-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default function RunDetail() {
  const { correlationId } = useParams<{ correlationId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useRunDetail(correlationId ?? '');

  if (isLoading) return <div className="p-6"><LoadingSpinner /></div>;
  if (!data) return (
    <div className="p-6 text-gray-400 text-sm">Run not found.</div>
  );

  return (
    <div className="p-6 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Run Explorer
      </button>

      <div>
        <h1 className="text-lg font-semibold text-white">Run Detail</h1>
        <p className="text-xs text-gray-500 font-mono mt-0.5">{correlationId}</p>
      </div>

      <Section title="A — Event Timeline">
        <EventTimeline events={data.events} />
      </Section>

      {data.stageDurations && (
        <Section title="B — Stage Duration Breakdown">
          <DurationBar
            download={data.stageDurations.download}
            process={data.stageDurations.process}
            persist={data.stageDurations.persist}
            total={data.stageDurations.total}
          />
        </Section>
      )}

      {data.validation && (
        <Section title="C — Validation Report">
          <ValidationReport validation={data.validation} />
        </Section>
      )}

      {data.host && (
        <Section title="D — Host Snapshot">
          <HostSnapshot host={data.host} />
        </Section>
      )}

      {data.business && (
        <Section title="E — Business Summary">
          <BusinessSummary business={data.business} />
        </Section>
      )}

      {data.error && (
        <Section title="F — Error Details" defaultOpen={true}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Detail label="Error Code"    value={data.error.errorCode} />
              <Detail label="Failed Stage"  value={data.error.failedStage} />
              <Detail label="Status"        value={data.error.status} />
              <Detail label="Retry Attempt" value={data.error.retryAttemptNumber} />
              <Detail label="Recoverable"   value={data.error.isRecoverable ? 'Yes' : 'No'} />
              <Detail label="Retry Reason"  value={data.error.retryReason} />
            </div>
            {data.error.errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Error Message</p>
                <p className="text-sm text-red-300">{data.error.errorMessage}</p>
              </div>
            )}
            {data.error.errorStackTrace && (
              <details className="text-xs">
                <summary className="text-gray-500 cursor-pointer hover:text-gray-300">Stack Trace</summary>
                <pre className="mt-2 p-3 bg-gray-800 rounded-lg overflow-x-auto text-gray-400 whitespace-pre-wrap break-all">
                  {data.error.errorStackTrace}
                </pre>
              </details>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="bg-gray-800 rounded-lg p-2.5">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-white mt-0.5">{value ?? '—'}</dd>
    </div>
  );
}
