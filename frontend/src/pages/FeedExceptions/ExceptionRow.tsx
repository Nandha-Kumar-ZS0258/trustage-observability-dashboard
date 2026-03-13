import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { clsx } from 'clsx';
import type { FeedException } from '../../types/exceptions';
import { usePatchNote, usePatchOwner, useResolveException } from '../../hooks/useExceptions';

// Static team member list — per wireframe
const TEAM_MEMBERS = [
  'Ravi Kumar (ZUCI)',
  'Sarah Mitchell (TruStage)',
  'Priya Mehta (ZUCI)',
  'Alex Singh (ZUCI)',
];

function formatExceptionDate(isoStr: string): string {
  try {
    const d = parseISO(isoStr);
    if (isToday(d)) return 'Today ' + format(d, 'HH:mm');
    return format(d, 'MMM d HH:mm');
  } catch {
    return isoStr;
  }
}

function formatFullDate(isoStr: string): string {
  try {
    return format(parseISO(isoStr), 'MMM d, yyyy HH:mm');
  } catch {
    return isoStr;
  }
}

function getInitials(ownerId: string): string {
  // Strip the "(ZUCI)" / "(TruStage)" part then take first letters
  const name = ownerId.replace(/\s*\([^)]*\)/, '').trim();
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

function OwnerCell({ ownerId }: { ownerId: string | null }) {
  if (!ownerId) {
    return (
      <span className="text-amber-400 font-semibold text-xs">Unassigned</span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-700 text-gray-200 text-[11px] font-bold select-none">
      {getInitials(ownerId)}
    </span>
  );
}

function StatusPill({ resolved }: { resolved: boolean }) {
  if (resolved) {
    return (
      <span className="badge bg-emerald-500/15 text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
        Resolved
      </span>
    );
  }
  return (
    <span className="badge bg-red-500/15 text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
      Active
    </span>
  );
}

function FailedStepPill({ step }: { step: string }) {
  // Write to TruStage Standard → amber; Receive CU File → blue; others → teal
  const colorClass = step.includes('Write') || step.includes('Standard')
    ? 'bg-amber-500/15 text-amber-400'
    : step.includes('Receive') || step.includes('File')
    ? 'bg-blue-500/15 text-blue-400'
    : 'bg-teal-500/15 text-teal-400';
  return <span className={clsx('badge', colorClass)}>{step}</span>;
}

/** Key-value label used in the expanded detail panel */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1 items-start text-sm">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider pt-0.5 leading-tight">
        {label}
      </span>
      <div className="text-gray-200 min-w-0">{children}</div>
    </div>
  );
}

export interface ExceptionRowProps {
  exception: FeedException;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ExceptionRow({ exception, isExpanded, onToggle }: ExceptionRowProps) {
  const navigate = useNavigate();
  const exceptionIdNum = parseInt(exception.exceptionId, 10);
  const isRecurring = exception.recurrenceCount > 1;

  // Local state for editable fields
  const [note, setNote]       = useState(exception.ownerNote ?? '');
  const [owner, setOwner]     = useState(exception.ownerId ?? '');
  const [showStack, setShowStack]       = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);

  const patchNote  = usePatchNote();
  const patchOwner = usePatchOwner();
  const resolveEx  = useResolveException();

  const isSaving  = patchNote.isPending || patchOwner.isPending;
  const isResolving = resolveEx.isPending;

  function handleSaveNoteAndOwner() {
    const ownerChanged = owner !== (exception.ownerId ?? '');
    const noteChanged  = note  !== (exception.ownerNote ?? '');
    if (ownerChanged) patchOwner.mutate({ id: exceptionIdNum, ownerId: owner });
    if (noteChanged)  patchNote.mutate({ id: exceptionIdNum, note });
  }

  function handleResolveClick() {
    if (!confirmResolve) { setConfirmResolve(true); return; }
    resolveEx.mutate(
      { id: exceptionIdNum, resolvedById: 'Sarah Mitchell (TruStage)' },
      { onSuccess: () => setConfirmResolve(false) },
    );
  }

  const rowClass = clsx(
    'border-b border-gray-800 transition-colors cursor-pointer',
    exception.resolvedFlag ? 'opacity-60' : 'hover:bg-gray-800/50',
    isExpanded && 'bg-gray-800/30',
  );

  return (
    <>
      {/* ── Collapsed row ── */}
      <tr className={rowClass} onClick={onToggle}>
        {/* First Occurred — recurring rows get amber badge below the date */}
        <td className="px-4 py-3 whitespace-nowrap align-top">
          {isRecurring ? (
            <div>
              <span className="font-semibold text-gray-100">
                {formatExceptionDate(exception.firstOccurredAt)}
              </span>
              <div className="mt-1">
                <span className="badge bg-amber-500/15 text-amber-400 text-[10px]">
                  Recurred {exception.recurrenceCount}×
                </span>
              </div>
            </div>
          ) : (
            <span className="text-gray-300">{formatExceptionDate(exception.firstOccurredAt)}</span>
          )}
        </td>

        {/* CU Partner — blue link, stops propagation so click navigates */}
        <td className="px-4 py-3 whitespace-nowrap">
          <button
            className="text-blue-400 hover:text-blue-300 font-semibold text-sm text-left"
            onClick={e => { e.stopPropagation(); navigate(`/cu/${exception.cuId}`); }}
          >
            {exception.cuName}
          </button>
        </td>

        {/* Exception Type — human-readable, truncated to one line */}
        <td className="px-4 py-3 max-w-[240px]">
          <span className="text-gray-300 text-sm line-clamp-1" title={exception.exceptionMessage}>
            {exception.exceptionMessage}
          </span>
        </td>

        {/* Failed Step */}
        <td className="px-4 py-3 whitespace-nowrap">
          <FailedStepPill step={exception.failedStep} />
        </td>

        {/* Status */}
        <td className="px-4 py-3 whitespace-nowrap">
          <StatusPill resolved={exception.resolvedFlag} />
        </td>

        {/* Owner */}
        <td className="px-4 py-3">
          <OwnerCell ownerId={exception.ownerId} />
        </td>

        {/* Expand chevron */}
        <td className="px-4 py-3 text-gray-500 text-right">
          {isExpanded
            ? <ChevronDown className="w-4 h-4 ml-auto" />
            : <ChevronRight className="w-4 h-4 ml-auto" />
          }
        </td>
      </tr>

      {/* ── Expanded detail row ── */}
      {isExpanded && (
        <tr className="border-b border-gray-800">
          <td colSpan={7} className="p-0">
            <div className="bg-gray-900/70 border-t border-gray-700 px-6 py-5 space-y-4">

              {/* ── Core exception fields ── */}
              <div className="space-y-3">
                <DetailRow label="Feed Ref ID">
                  <span className="font-mono text-xs text-gray-300">{exception.feedReferenceId}</span>
                </DetailRow>

                <DetailRow label="Exception Code">
                  <span className="font-mono text-xs text-gray-300">{exception.exceptionCode}</span>
                </DetailRow>

                <DetailRow label="Message">
                  <span className="text-gray-200 leading-relaxed">{exception.exceptionMessage}</span>
                </DetailRow>

                <DetailRow label="Failed Step">
                  <FailedStepPill step={exception.failedStep} />
                </DetailRow>

                <DetailRow label="Retry Count">
                  <span className="text-gray-300">
                    {exception.retryCount} {exception.retryCount === 1 ? 'retry' : 'retries'} exhausted — same failure each time.{' '}
                    <span className="text-gray-500">Last retry: {formatFullDate(exception.firstOccurredAt)}</span>
                  </span>
                </DetailRow>

                {/* Occurrence history — only when recurring */}
                {isRecurring && (
                  <DetailRow label="Occurrence History">
                    <div className="flex flex-col gap-1">
                      {/* Mini timeline — we have recurrenceCount and firstOccurredAt */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-300">
                          Occurred <strong className="text-amber-400">{exception.recurrenceCount}×</strong>
                          {' '}— first seen {formatFullDate(exception.firstOccurredAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {Array.from({ length: Math.min(exception.recurrenceCount, 5) }).map((_, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
                            <span className="text-xs text-gray-500">
                              {i === 0 ? 'First occurrence' : i === exception.recurrenceCount - 1 ? 'Latest' : `Occurrence ${i + 1}`}
                            </span>
                            {i < Math.min(exception.recurrenceCount, 5) - 1 && (
                              <span className="text-gray-700 mx-1">·</span>
                            )}
                          </div>
                        ))}
                        {exception.recurrenceCount > 5 && (
                          <span className="text-xs text-gray-500">+{exception.recurrenceCount - 5} more</span>
                        )}
                      </div>
                      <p className="text-xs text-amber-400 font-medium mt-0.5">
                        Same exception code, same CU partner — requires investigation.
                      </p>
                    </div>
                  </DetailRow>
                )}

                {/* Resolution info — only when resolved */}
                {exception.resolvedFlag && exception.resolvedAt && (
                  <DetailRow label="Resolution">
                    <span className="text-emerald-400 font-medium">
                      Resolved {formatFullDate(exception.resolvedAt)}
                      {exception.resolvedById && ` by ${exception.resolvedById}`}
                    </span>
                  </DetailRow>
                )}
              </div>

              {/* ── Stack trace accordion ── */}
              {exception.rawPayload && (
                <div>
                  <button
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    onClick={() => setShowStack(p => !p)}
                  >
                    {showStack
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />
                    }
                    {showStack ? 'Hide stack trace' : 'Show stack trace'}
                  </button>
                  {showStack && (
                    <pre className="mt-2 p-3 bg-gray-950 border border-gray-700 rounded-lg text-xs text-gray-400 font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                      {exception.rawPayload}
                    </pre>
                  )}
                </div>
              )}

              {/* ── Owner + Note (editable when unresolved) ── */}
              {!exception.resolvedFlag ? (
                <div className="space-y-3 pt-1">
                  <DetailRow label="Assign Owner">
                    <select
                      className="select w-auto max-w-xs"
                      value={owner}
                      onChange={e => setOwner(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {TEAM_MEMBERS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </DetailRow>

                  <DetailRow label="Notes">
                    <textarea
                      className="input resize-y min-h-[60px]"
                      placeholder="Add a note…"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                  </DetailRow>
                </div>
              ) : exception.ownerNote ? (
                /* Read-only note for resolved exceptions */
                <div className="space-y-3 pt-1">
                  <DetailRow label="Notes">
                    <span className="text-gray-400 leading-relaxed">{exception.ownerNote}</span>
                  </DetailRow>
                </div>
              ) : null}

              {/* ── Action buttons ── */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {!exception.resolvedFlag && (
                  <>
                    <button
                      className="btn-primary disabled:opacity-50"
                      onClick={handleSaveNoteAndOwner}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving…' : 'Save Note & Owner'}
                    </button>

                    {confirmResolve ? (
                      <>
                        <button
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          onClick={handleResolveClick}
                          disabled={isResolving}
                        >
                          {isResolving ? 'Resolving…' : 'Confirm Resolved'}
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => setConfirmResolve(false)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                        onClick={handleResolveClick}
                      >
                        Mark as Resolved
                      </button>
                    )}
                  </>
                )}

                <button
                  className="btn-ghost"
                  onClick={e => {
                    e.stopPropagation();
                    navigate(`/history/${exception.feedReferenceId}`);
                  }}
                >
                  View Feed Detail →
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
