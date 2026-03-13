import type { StepTimelineItem } from '../../../hooks/useFeedHistory';

// ── Stage → step label mapping (Section 4.4) ─────────────────────────────────

const STEP_LABEL: Record<string, string> = {
  Ingestion:        'Receive CU File',
  SchemaValidation: 'Data Validation Check',
  Transform:        'Apply Standardisation Rules',
  RulesValidation:  'Standardise & Transform',
  Publishing:       'Write to TruStage Standard',
};

// ── Segment colours per step (matching wireframe) ────────────────────────────

const STEP_COLOUR: Record<string, string> = {
  Ingestion:        '#1A6DB5',  // blue
  SchemaValidation: '#0E7490',  // teal
  Transform:        '#7C3AED',  // purple
  RulesValidation:  '#D97706',  // amber
  Publishing:       '#16A34A',  // green
};

const STEP_ORDER = ['Ingestion', 'SchemaValidation', 'Transform', 'RulesValidation', 'Publishing'];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  stepTimeline: StepTimelineItem[];
  totalDurationMs: number | null;
}

export function StepTimingBar({ stepTimeline, totalDurationMs }: Props) {
  const steps = Array.isArray(stepTimeline) ? stepTimeline : [];

  // Build a map from stageName → durationMs
  const durationMap: Record<string, number> = {};
  for (const s of steps) {
    if (s.durationMs != null) {
      durationMap[s.stageName] = s.durationMs;
    }
  }

  // Use only steps that have known durations, in canonical order
  const segments = STEP_ORDER
    .map(stageName => ({
      stageName,
      label: STEP_LABEL[stageName] ?? stageName,
      colour: STEP_COLOUR[stageName] ?? '#64748B',
      durationMs: durationMap[stageName] ?? 0,
    }))
    .filter(s => s.durationMs > 0);

  const totalMs = segments.reduce((sum, s) => sum + s.durationMs, 0) || 1;

  if (segments.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        No step timing data available.
      </p>
    );
  }

  // Identify the slowest step for insight
  const slowest = segments.reduce((max, s) => (s.durationMs > max.durationMs ? s : max), segments[0]);
  const slowestPct = Math.round((slowest.durationMs / totalMs) * 100);

  return (
    <div>
      {/* Sub-heading */}
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Where did the time go?
      </p>

      {/* Stacked bar */}
      <div className="flex h-7 rounded-md overflow-hidden mb-3">
        {segments.map(seg => {
          const pct = (seg.durationMs / totalMs) * 100;
          return (
            <div
              key={seg.stageName}
              style={{ flexBasis: `${pct}%`, background: seg.colour }}
              className="flex items-center justify-center overflow-hidden text-white text-[10px] font-bold px-1 shrink-0"
              title={`${seg.label} — ${(seg.durationMs / 1000).toFixed(1)}s (${Math.round(pct)}%)`}
            >
              {pct > 8 ? `${Math.round(pct)}%` : ''}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
        {segments.map(seg => {
          const pct = Math.round((seg.durationMs / totalMs) * 100);
          return (
            <div key={seg.stageName} className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span
                className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                style={{ background: seg.colour }}
              />
              {seg.label} — {(seg.durationMs / 1000).toFixed(1)}s ({pct}%)
            </div>
          );
        })}
      </div>

      {/* Insight line */}
      {slowestPct >= 50 && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3 text-[13px] text-gray-300">
          <strong className="text-white">💡 Insight:</strong>{' '}
          {slowestPct}% of total feed time is spent on{' '}
          <strong className="text-white">{slowest.label}</strong>.
          {slowestPct >= 80 && ' Consider reviewing this step if duration is increasing over time.'}
        </div>
      )}

      {/* Total duration reference */}
      {totalDurationMs !== null && (
        <p className="text-[11px] text-gray-600 mt-3">
          Total pipeline duration: {(totalDurationMs / 1000).toFixed(1)}s ({totalDurationMs.toLocaleString()} ms)
        </p>
      )}
    </div>
  );
}
