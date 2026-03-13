import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, TriangleAlert, Check } from 'lucide-react';
import { clsx } from 'clsx';
import type { LifecycleState, CuConfiguration } from '../../types/programme';
import { useLifecyclePanel, useSaveCuNote } from '../../hooks/useProgramme';
import { TEAM_MEMBER_OPTIONS } from '../../constants/team';

// Staleness threshold per Section 3 of MONITORING_SPEC.md
const READY_STALE_DAYS = 7;

interface Props {
  state: LifecycleState | null;
  /** overdueBau when state='BAU', overdueReady when state='Ready for First Feed' */
  staleCount: number;
  onClose: () => void;
}

// ── Panel header metadata ────────────────────────────────────────────────────

const PANEL_META: Record<LifecycleState, { icon: string; title: string; subFn: (count: number, stale: number) => string }> = {
  Onboarding: {
    icon: '🔵',
    title: 'Onboarding',
    subFn: count => `CU connectors currently in development — ${count} total`,
  },
  'Ready for First Feed': {
    icon: '🟡',
    title: 'Ready for First Feed',
    subFn: count => `Connectors deployed to production — awaiting first delivery — ${count} total`,
  },
  BAU: {
    icon: '🟢',
    title: 'BAU',
    subFn: (count, stale) =>
      `${count} live CU partner${count !== 1 ? 's' : ''}${stale > 0 ? ` · ${stale} overdue` : ''}`,
  },
};

const DAYS_COL: Record<LifecycleState, string> = {
  Onboarding: 'Days',
  'Ready for First Feed': 'Days Waiting',
  BAU: 'Days in BAU',
};

// ── Staleness banner text per state ─────────────────────────────────────────

function getStaleBannerText(state: LifecycleState, staleCount: number, cus: CuConfiguration[]): string | null {
  if (state === 'Ready for First Feed') {
    const n = cus.filter(cu => cu.daysInState > READY_STALE_DAYS).length;
    if (n === 0) return null;
    return `${n} CU partner${n > 1 ? 's' : ''} ${n > 1 ? 'have' : 'has'} been waiting more than 7 days`;
  }
  if (state === 'BAU' && staleCount > 0) {
    return `${staleCount} BAU partner${staleCount > 1 ? 's' : ''} ${staleCount > 1 ? 'have' : 'has'} not delivered a feed in more than 3 days`;
  }
  return null;
}

// ── Per-row component ────────────────────────────────────────────────────────

interface RowProps {
  cu: CuConfiguration;
  state: LifecycleState;
  isStale: boolean;
}

function PanelRow({ cu, state, isStale }: RowProps) {
  const navigate = useNavigate();
  const saveMutation = useSaveCuNote();

  const [owner, setOwner]   = useState(cu.assignedEngineer ?? '');
  const [note,  setNote]    = useState('');
  const [saved, setSaved]   = useState(false);

  function handleSave() {
    saveMutation.mutate(
      { cuId: cu.cuId, note, ownerId: owner },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  }

  return (
    <tr
      className={clsx(
        'border-b border-gray-800 transition-colors',
        isStale ? 'bg-amber-950/20' : 'hover:bg-gray-800/40',
      )}
    >
      {/* CU Partner Name — link to CU Detail */}
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          className="text-blue-400 hover:text-blue-300 font-semibold text-sm text-left leading-tight"
          onClick={() => navigate(`/cu/${cu.cuId}`)}
        >
          {cu.cuName}
        </button>
        {isStale && state === 'Ready for First Feed' && (
          <span className="ml-2 badge bg-amber-500/15 text-amber-400 text-[10px]">
            Waiting ⚠
          </span>
        )}
      </td>

      {/* Core Banking Platform */}
      <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
        {cu.coreBankingPlatform}
      </td>

      {/* Days in state */}
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <span className={clsx(isStale ? 'text-amber-400 font-semibold' : 'text-gray-300')}>
          {cu.daysInState}
          {isStale && ' ⚠'}
        </span>
      </td>

      {/* Assigned Engineer — owner dropdown */}
      <td className="px-4 py-3">
        <select
          className="select text-xs py-1"
          value={owner}
          onChange={e => setOwner(e.target.value)}
        >
          <option value="">Unassigned</option>
          {TEAM_MEMBER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>

      {/* Note field + Save */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            className="input text-xs py-1 min-w-0"
            placeholder="Add a note…"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />
          <button
            className={clsx(
              'shrink-0 text-xs font-medium px-2.5 py-1 rounded-md transition-colors whitespace-nowrap',
              saved
                ? 'bg-emerald-600/30 text-emerald-400 cursor-default'
                : 'btn-primary',
            )}
            onClick={handleSave}
            disabled={saveMutation.isPending || saved}
          >
            {saved ? (
              <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>
            ) : saveMutation.isPending ? (
              'Saving…'
            ) : (
              'Save'
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main panel component ─────────────────────────────────────────────────────

export function LifecyclePanel({ state, staleCount, onClose }: Props) {
  const isOpen = state !== null;

  // Fetch CUs for the selected state (enabled only when state is non-null)
  const { data: cus = [], isLoading } = useLifecyclePanel(state ?? 'Onboarding');

  // Close on Escape
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

  // Don't unmount so the slide-out transition plays
  const meta = state ? PANEL_META[state] : null;
  const staleBannerText = state ? getStaleBannerText(state, staleCount, cus) : null;

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

      {/* ── Slide-over panel ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={meta?.title ?? 'Lifecycle panel'}
        className={clsx(
          'fixed inset-y-0 right-0 z-50 w-[620px] max-w-full',
          'flex flex-col bg-gray-900 border-l border-gray-800 shadow-2xl',
          'transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* ── Panel header — navy background matching wireframe ── */}
        {meta && (
          <div className="shrink-0 bg-[#0F2744] px-6 py-5 flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-white mb-1">
                {meta.icon} {meta.title}
              </h2>
              <p className="text-xs text-white/60">
                {meta.subFn(cus.length, staleCount)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors mt-0.5"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ── Panel body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Staleness banner — amber, per wireframe .exc-banner pattern */}
          {staleBannerText && (
            <div className="flex items-center gap-2.5 bg-amber-950/40 border border-amber-900/50 border-l-4 border-l-amber-500 rounded-lg px-4 py-2.5 mb-5 text-sm">
              <TriangleAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-amber-300 font-medium">{staleBannerText}</span>
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
          ) : cus.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No CU partners in this state.</p>
          ) : (
            <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/60 border-b border-gray-700">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      CU Partner
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {state ? DAYS_COL[state] : 'Days'}
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Assigned Engineer
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cus.map(cu => {
                    const isStale =
                      state === 'Ready for First Feed'
                        ? cu.daysInState > READY_STALE_DAYS
                        : false; // BAU staleness is count-level only (no per-CU lastFeedDate here)
                    return (
                      <PanelRow
                        key={cu.cuId}
                        cu={cu}
                        state={state!}
                        isStale={isStale}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
