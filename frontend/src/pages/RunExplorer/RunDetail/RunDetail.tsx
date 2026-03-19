import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { useRunDetail } from '../../../hooks/useRunDetail';
import { useRunContext } from '../../../hooks/useAksHealth';
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

function AksContextSection({ correlationId }: { correlationId: string }) {
  const { data, isLoading } = useRunContext(correlationId);

  if (isLoading) return <p className="text-sm text-gray-500 py-4 text-center">Loading AKS context…</p>;
  if (!data)     return <p className="text-sm text-gray-500 py-4 text-center">No AKS data found for this run. Available after the next sync cycle.</p>;

  const durationSec = (data.totalDurationMs / 1000).toFixed(1);
  const isPassed    = data.finalOutcome === 'Passed';

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {([
          ['Pod',      data.podName],
          ['Node',     data.nodeName ?? '—'],
          ['Duration', `${durationSec}s`],
          ['Started',  format(parseISO(data.runStart), 'HH:mm:ss')],
          ['Ended',    format(parseISO(data.runEnd),   'HH:mm:ss')],
          ['Outcome',  data.finalOutcome ?? '—'],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="bg-gray-800 rounded-lg p-2.5">
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className={clsx(
              'text-sm mt-0.5 font-mono truncate',
              label === 'Outcome'
                ? isPassed ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'
                : 'text-white'
            )}>
              {label === 'Outcome'
                ? <span className="flex items-center gap-1">
                    {isPassed ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {value}
                  </span>
                : value
              }
            </dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Stage Timeline</p>
        {data.stages.map((s, i) => {
          const stageMs = i > 0
            ? new Date(s.stageTime).getTime() - new Date(data.stages[i - 1].stageTime).getTime()
            : null;
          const passed = s.outcome === 'Passed' || s.gateResult?.includes('PASS');
          const failed = s.outcome === 'Failed' || s.gateResult?.includes('FAIL');
          return (
            <div key={i} className="bg-gray-800 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    'w-2 h-2 rounded-full shrink-0',
                    failed ? 'bg-red-500' : passed ? 'bg-emerald-500' : 'bg-gray-500'
                  )} />
                  <span className="text-sm text-white">{s.stage}</span>
                  {stageMs !== null && (
                    <span className="text-xs text-gray-500">{(stageMs / 1000).toFixed(2)}s</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{format(parseISO(s.stageTime), 'HH:mm:ss.SSS')}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 pl-4">
                {s.memberCount != null && <span>{s.memberCount.toLocaleString()} members</span>}
                {s.errorCount != null && s.errorCount > 0 && <span className="text-red-400">{s.errorCount} errors</span>}
                {s.warningCount != null && s.warningCount > 0 && <span className="text-amber-400">{s.warningCount} warnings</span>}
                {s.gateResult && <span className="text-gray-300">{s.gateResult}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RunDetail() {
  const { correlationId } = useParams<{ correlationId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useRunDetail(correlationId ?? '');

  if (isLoading) return <div className="p-6"><LoadingSpinner /></div>;
  if (!data) return (
    <div className="p-6 text-gray-400 text-sm">Feed not found.</div>
  );

  return (
    <div className="p-6 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Feed History
      </button>

      <div>
        <h1 className="text-lg font-semibold text-white">Feed Detail</h1>
        <p className="text-xs text-gray-500 font-mono mt-0.5">{correlationId}</p>
      </div>

      <Section title="A — Event Timeline">
        <EventTimeline events={data.events} />
      </Section>

      {data.stageDurations && (
        <Section title="B — Step Timing Breakdown">
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

      <Section title="E — AKS Context">
        <AksContextSection correlationId={correlationId ?? ''} />
      </Section>

      {data.business && (
        <Section title="F — Business Summary">
          <BusinessSummary business={data.business} />
        </Section>
      )}

      {data.error && (
        <Section title="G — Error Details" defaultOpen={true}>
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
