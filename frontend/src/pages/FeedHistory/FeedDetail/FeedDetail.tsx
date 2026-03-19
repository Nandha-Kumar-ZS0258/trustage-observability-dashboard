import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { X, Server, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { useFeedDetail } from '../../../hooks/useFeedHistory';
import { useRunContext } from '../../../hooks/useAksHealth';
import { StepTimeline } from './StepTimeline';
import { StepTimingBar } from './StepTimingBar';
import { DataValidationReport } from './DataValidationReport';
import { FeedSummary } from './FeedSummary';

// ── Tab definitions ───────────────────────────────────────────────────────────

type Tab = 'timeline' | 'timing' | 'validation' | 'summary' | 'aks';

const TABS: { key: Tab; label: string }[] = [
  { key: 'timeline',   label: 'Step Timeline' },
  { key: 'timing',     label: 'Step Timing' },
  { key: 'validation', label: 'Data Validation' },
  { key: 'summary',    label: 'Feed Summary' },
  { key: 'aks',        label: 'AKS Context' },
];

// ── AKS Context panel ─────────────────────────────────────────────────────────

function AksContextPanel({ feedReferenceId }: { feedReferenceId: string }) {
  const { data, isLoading } = useRunContext(feedReferenceId);

  if (isLoading) return (
    <p className="text-sm text-gray-500 text-center py-10">Loading AKS context…</p>
  );
  if (!data) return (
    <div className="py-10 text-center">
      <Server className="w-8 h-8 text-gray-600 mx-auto mb-2" />
      <p className="text-sm text-gray-500">No AKS data found for this run.</p>
      <p className="text-xs text-gray-600 mt-1">Data is collected from ContainerLogV2 — available after the next sync cycle.</p>
    </div>
  );

  const durationSec = (data.totalDurationMs / 1000).toFixed(1);
  const isPassed    = data.finalOutcome === 'Passed';

  return (
    <div className="space-y-5">
      {/* Infrastructure summary */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Infrastructure</p>
        <div className="bg-gray-950 border border-gray-800 rounded-lg divide-y divide-gray-800">
          {[
            ['Pod',      data.podName],
            ['Node',     data.nodeName ?? '—'],
            ['Duration', `${durationSec}s`],
            ['Started',  format(parseISO(data.runStart), 'HH:mm:ss')],
            ['Ended',    format(parseISO(data.runEnd),   'HH:mm:ss')],
            ['Outcome',  data.finalOutcome ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3 px-4 py-2.5 text-sm">
              <span className="w-24 shrink-0 text-gray-500">{label}</span>
              <span className={clsx(
                'flex-1 font-mono text-[12px] truncate',
                label === 'Outcome'
                  ? isPassed ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'
                  : 'text-gray-200'
              )}>
                {label === 'Outcome'
                  ? <span className="flex items-center gap-1">
                      {isPassed
                        ? <CheckCircle className="w-3.5 h-3.5" />
                        : <XCircle className="w-3.5 h-3.5" />
                      }
                      {value}
                    </span>
                  : value
                }
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stage timeline */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Stage Timeline</p>
        <div className="space-y-2">
          {data.stages.map((s, i) => {
            const stageMs = i > 0
              ? new Date(s.stageTime).getTime() - new Date(data.stages[i - 1].stageTime).getTime()
              : null;
            const passed = s.outcome === 'Passed' || s.gateResult?.includes('PASS');
            const failed = s.outcome === 'Failed' || s.gateResult?.includes('FAIL');
            return (
              <div key={i} className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={clsx(
                      'w-2 h-2 rounded-full shrink-0',
                      failed ? 'bg-red-500' : passed ? 'bg-emerald-500' : 'bg-gray-500'
                    )} />
                    <span className="text-sm font-medium text-gray-200">{s.stage}</span>
                    {stageMs !== null && (
                      <span className="text-xs text-gray-500">{(stageMs / 1000).toFixed(2)}s</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {format(parseISO(s.stageTime), 'HH:mm:ss.SSS')}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 pl-4">
                  {s.memberCount != null && <span>{s.memberCount.toLocaleString()} members</span>}
                  {s.errorCount != null && s.errorCount > 0 && (
                    <span className="text-red-400">{s.errorCount} errors</span>
                  )}
                  {s.warningCount != null && s.warningCount > 0 && (
                    <span className="text-amber-400">{s.warningCount} warnings</span>
                  )}
                  {s.gateResult && <span className="text-gray-300">{s.gateResult}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  feedReferenceId: string | null;
  onClose: () => void;
  /** Optional breadcrumb context shown above the panel title, e.g. "Feed History" */
  breadcrumb?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FeedDetail({ feedReferenceId, onClose, breadcrumb }: Props) {
  const isOpen = feedReferenceId !== null;
  const [activeTab, setActiveTab] = useState<Tab>('timeline');

  const { data: detail, isLoading } = useFeedDetail(feedReferenceId ?? '');

  // Reset to Step Timeline whenever a new feed is opened
  useEffect(() => {
    if (isOpen) setActiveTab('timeline');
  }, [feedReferenceId, isOpen]);

  // Escape key + body scroll-lock
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={clsx(
          'fixed inset-0 z-40 bg-gray-950/70',
          'transition-opacity duration-250',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* ── Slide-over ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Feed Detail"
        className={clsx(
          'fixed inset-y-0 right-0 z-50 w-[560px] max-w-full',
          'flex flex-col bg-gray-900 border-l border-gray-800 shadow-2xl',
          'transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* ── Navy header ── */}
        <div className="shrink-0 bg-[#0F2744] px-6 py-5 flex items-start justify-between">
          <div>
            {breadcrumb && feedReferenceId && (
              <p className="text-[11px] text-white/40 mb-1">
                {breadcrumb} › Feed {feedReferenceId.slice(0, 8)}
              </p>
            )}
            <h2 className="text-base font-bold text-white mb-1">Feed Detail</h2>
            {detail ? (
              <p className="text-xs text-white/60">
                {detail.summary.cuName}
                {' · '}
                <span className="font-mono">{detail.summary.feedReferenceId}</span>
              </p>
            ) : feedReferenceId ? (
              <p className="text-xs font-mono text-white/60">{feedReferenceId}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors mt-0.5"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Inner tabs ── */}
        <div className="shrink-0 flex border-b border-gray-800 bg-gray-900 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0',
                activeTab === tab.key
                  ? 'text-blue-400 border-blue-400 font-semibold'
                  : 'text-gray-500 border-transparent hover:text-gray-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <p className="text-sm text-gray-500 text-center py-10">Loading…</p>
          ) : !detail ? (
            <p className="text-sm text-gray-500 text-center py-10">
              Could not load feed detail.
            </p>
          ) : (
            <>
              {activeTab === 'timeline' && (
                <StepTimeline detail={detail} />
              )}
              {activeTab === 'timing' && (
                <StepTimingBar
                  stepTimeline={detail.stepTimeline}
                  totalDurationMs={detail.summary.totalDurationMs}
                />
              )}
              {activeTab === 'validation' && (
                <DataValidationReport
                  validationReport={detail.validationReport}
                />
              )}
              {activeTab === 'summary' && (
                <FeedSummary summary={detail.summary} />
              )}
              {activeTab === 'aks' && feedReferenceId && (
                <AksContextPanel feedReferenceId={feedReferenceId} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
