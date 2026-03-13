import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { useFeedDetail } from '../../../hooks/useFeedHistory';
import { StepTimeline } from './StepTimeline';
import { StepTimingBar } from './StepTimingBar';
import { DataValidationReport } from './DataValidationReport';
import { FeedSummary } from './FeedSummary';

// ── Tab definitions ───────────────────────────────────────────────────────────

type Tab = 'timeline' | 'timing' | 'validation' | 'summary';

const TABS: { key: Tab; label: string }[] = [
  { key: 'timeline',   label: 'Step Timeline' },
  { key: 'timing',     label: 'Step Timing' },
  { key: 'validation', label: 'Data Validation' },
  { key: 'summary',    label: 'Feed Summary' },
];

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
            </>
          )}
        </div>
      </div>
    </>
  );
}
