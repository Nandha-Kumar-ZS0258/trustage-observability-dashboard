import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import type { FeedDetail, StepTimelineItem } from '../../../hooks/useFeedHistory';

// ── Stage → UI mapping ────────────────────────────────────────────────────────
// Per MONITORING_SPEC.md Section 4.4: show step label in bold, internal name in muted mono

const STAGE_META: Record<string, { label: string }> = {
  Ingestion:        { label: 'Receive CU File' },
  SchemaValidation: { label: 'Data Validation Check' },
  Transform:        { label: 'Apply Standardisation Rules' },
  RulesValidation:  { label: 'Standardise & Transform' },
  Publishing:       { label: 'Write to TruStage Standard' },
};

function getStepLabel(stageName: string): string {
  return STAGE_META[stageName]?.label ?? stageName;
}

// ── Status dot ────────────────────────────────────────────────────────────────

type DotStatus = 'ok' | 'fail' | 'warn' | 'wait';

function StatusDot({ status }: { status: DotStatus }) {
  const base = 'w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm z-10 border-2 border-gray-900';
  switch (status) {
    case 'ok':   return <div className={clsx(base, 'bg-emerald-900/60 text-emerald-400')}>✓</div>;
    case 'fail': return <div className={clsx(base, 'bg-red-900/60 text-red-400')}>✕</div>;
    case 'warn': return <div className={clsx(base, 'bg-amber-900/60 text-amber-400')}>⚠</div>;
    case 'wait': return <div className={clsx(base, 'bg-gray-800 text-gray-600')}>○</div>;
  }
}

// ── Duration / time formatting ────────────────────────────────────────────────

function fmtTime(iso: string) {
  return format(parseISO(iso), 'HH:mm:ss');
}

function fmtSeconds(ms: number | null) {
  if (ms === null) return null;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Meta line builders per step ───────────────────────────────────────────────

function MetaLine({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-400 mt-1">{children}</div>;
}

function buildMeta(
  stageName: string,
  detail: FeedDetail,
): React.ReactNode | null {
  const { summary, validationReport } = detail;

  switch (stageName) {
    case 'Ingestion':
      return summary.blobName ? (
        <MetaLine>
          File: <strong className="text-gray-300">{summary.blobName}</strong>
        </MetaLine>
      ) : null;

    case 'SchemaValidation':
      if (!validationReport) return null;
      return (
        <MetaLine>
          Gate 1:{' '}
          <strong className={validationReport.gate1Passed ? 'text-emerald-400' : 'text-red-400'}>
            {validationReport.gate1Passed ? 'Passed' : 'Failed'}
          </strong>
          {validationReport.gate1ErrorCount > 0 && (
            <span className="text-red-400"> · {validationReport.gate1ErrorCount} error{validationReport.gate1ErrorCount !== 1 ? 's' : ''}</span>
          )}
        </MetaLine>
      );

    case 'Transform':
      return summary.mappingVersion ? (
        <MetaLine>
          Standardisation Rules{' '}
          <strong className="text-gray-300">v{summary.mappingVersion}</strong> applied
        </MetaLine>
      ) : null;

    case 'RulesValidation':
      return summary.memberRecordsProcessed !== null ? (
        <MetaLine>
          <strong className="text-gray-300">
            {summary.memberRecordsProcessed.toLocaleString()}
          </strong>{' '}
          member records in
        </MetaLine>
      ) : null;

    case 'Publishing':
      return summary.memberRecordsProcessed !== null ? (
        <MetaLine>
          <strong className="text-gray-300">
            {summary.memberRecordsProcessed.toLocaleString()}
          </strong>{' '}
          member records written to TruStage Standard
        </MetaLine>
      ) : null;

    default:
      return null;
  }
}

// ── Single timeline row ───────────────────────────────────────────────────────

interface RowProps {
  item: StepTimelineItem;
  dotStatus: DotStatus;
  isLast: boolean;
  detail: FeedDetail;
}

function TimelineRow({ item, dotStatus, isLast, detail }: RowProps) {
  const label = getStepLabel(item.stageName);
  const timeStr = fmtTime(item.startedAt);
  const durStr = fmtSeconds(item.durationMs);

  return (
    <li className="flex gap-3 relative">
      {/* Vertical connector line (not on last item) */}
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-800" />
      )}

      <StatusDot status={dotStatus} />

      <div className="flex-1 pb-5 min-w-0">
        {/* Step label + internal name */}
        <div className="text-[13px] font-bold text-white leading-tight mb-0.5">
          {label}
          <span className="ml-1.5 text-[10px] font-normal text-gray-500 font-mono align-middle">
            {item.stageName}
          </span>
        </div>

        {/* Timestamp · duration */}
        <div className="text-[11px] text-gray-500 font-mono mb-0.5">
          {timeStr}
          {durStr && <span> · {durStr}</span>}
        </div>

        {/* Meta line */}
        {buildMeta(item.stageName, detail)}
      </div>
    </li>
  );
}

// ── Derived "Feed Delivered" terminal step ────────────────────────────────────

function DeliveredStep({ detail }: { detail: FeedDetail }) {
  const { summary } = detail;
  const isPartial = summary.status === 'Partial';
  const pillCls = isPartial
    ? 'badge bg-amber-500/15 text-amber-400'
    : 'badge bg-emerald-500/15 text-emerald-400';

  return (
    <li className="flex gap-3 relative">
      <StatusDot status="ok" />
      <div className="flex-1 pb-2 min-w-0">
        <div className="text-[13px] font-bold text-white leading-tight mb-0.5">
          Feed Delivered
          <span className="ml-1.5 text-[10px] font-normal text-gray-500 font-mono align-middle">
            FeedDelivered
          </span>
        </div>
        {summary.feedDelivered && (
          <div className="text-[11px] text-gray-500 font-mono mb-1">
            {fmtTime(summary.feedDelivered)}
            {summary.totalDurationMs !== null && (
              <span> · Total: {summary.totalDurationMs.toLocaleString()}ms</span>
            )}
          </div>
        )}
        <MetaLine>
          <span className={pillCls}>{isPartial ? 'Partial delivery' : 'Delivered successfully'}</span>
        </MetaLine>
      </div>
    </li>
  );
}

// ── Failed terminal step ──────────────────────────────────────────────────────

function FailedStep() {
  return (
    <li className="flex gap-3 relative">
      <StatusDot status="fail" />
      <div className="flex-1 pb-2 min-w-0">
        <div className="text-[13px] font-bold text-red-400 leading-tight mb-0.5">
          Feed Failed
          <span className="ml-1.5 text-[10px] font-normal text-gray-500 font-mono align-middle">
            FeedFailed
          </span>
        </div>
        <div className="text-xs text-red-400/70 mt-1">
          This feed did not complete. Check Feed Exceptions for error details.
        </div>
      </div>
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  detail: FeedDetail;
}

export function StepTimeline({ detail }: Props) {
  const steps = Array.isArray(detail.stepTimeline) ? detail.stepTimeline : [];
  const status = detail.summary.status;
  const showDelivered = status === 'Delivered' || status === 'Partial';
  const showFailed = status === 'Failed';

  if (steps.length === 0 && !showDelivered && !showFailed) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        No step timeline data available for this feed.
      </p>
    );
  }

  return (
    <ul className="relative space-y-0">
      {steps.map((item, i) => {
        // Determine dot status
        let dotStatus: DotStatus = 'wait';
        if (item.completedAt) {
          dotStatus = 'ok';
        } else if (showFailed && i === steps.length - 1) {
          dotStatus = 'fail';
        }

        const isLastItem = i === steps.length - 1 && !showDelivered && !showFailed;
        return (
          <TimelineRow
            key={item.stageName}
            item={item}
            dotStatus={dotStatus}
            isLast={isLastItem}
            detail={detail}
          />
        );
      })}

      {showDelivered && <DeliveredStep detail={detail} />}
      {showFailed && <FailedStep />}
    </ul>
  );
}
