import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { differenceInMinutes, parseISO } from 'date-fns';
import { useUnresolvedCount } from '../hooks/useUnresolvedCount';
import { useExceptions } from '../hooks/useExceptions';

/**
 * Session-dismissible banner shown on CU Programme View and Today's Feeds when
 * unresolved feed exceptions exist (Section 6.1 / 6.6 of MONITORING_SPEC.md).
 *
 * Format: 🔴 [N] active feed exceptions across [CU count] CU partners
 *         — last exception [X] minutes ago   [View Exceptions →]
 *
 * Reappears automatically whenever the unresolved count increases.
 */
export function ExceptionBanner() {
  const navigate = useNavigate();

  // Primary hook — count drives show/hide and the N in the message
  const { data: countData } = useUnresolvedCount();
  const count = countData?.count ?? 0;

  // Secondary data — derive CU partner count and most-recent exception timestamp
  const { data: exceptions = [] } = useExceptions({ status: 'unresolved' });

  const [dismissed, setDismissed] = useState(false);
  const prevCountRef = useRef<number>(0);

  // Reappear when count goes up (new exception arrived)
  useEffect(() => {
    if (count > prevCountRef.current) {
      setDismissed(false);
    }
    prevCountRef.current = count;
  }, [count]);

  if (count === 0 || dismissed) return null;

  // Unique CU partners with active exceptions
  const cuCount = new Set(exceptions.map(e => e.cuId)).size;

  // Most recent firstOccurredAt across all unresolved exceptions
  const latestMs = exceptions.reduce<number>((max, e) => {
    const t = parseISO(e.firstOccurredAt).getTime();
    return t > max ? t : max;
  }, 0);
  const minutesAgo = latestMs > 0 ? differenceInMinutes(new Date(), new Date(latestMs)) : null;

  // Build message parts — omit segments we don't yet have data for
  const exceptionLabel = count === 1 ? 'exception' : 'exceptions';
  const cuPart   = cuCount > 0
    ? `across ${cuCount} CU partner${cuCount === 1 ? '' : 's'} `
    : '';
  const timePart = minutesAgo !== null
    ? `— last exception ${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`
    : '';

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-5 text-sm
                 bg-red-950/50 border border-red-900/50 border-l-4 border-l-red-500"
      role="alert"
    >
      {/* Icon */}
      <span className="shrink-0 text-base" aria-hidden="true">🔴</span>

      {/* Message */}
      <span className="flex-1 text-red-300 font-medium">
        {count} active feed {exceptionLabel} {cuPart}{timePart}
      </span>

      {/* Navigate link */}
      <button
        className="shrink-0 text-red-400 hover:text-red-200 font-semibold transition-colors whitespace-nowrap"
        onClick={() => navigate('/exceptions')}
      >
        View Exceptions →
      </button>

      {/* Dismiss */}
      <button
        className="shrink-0 text-red-700 hover:text-red-400 transition-colors ml-1"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
