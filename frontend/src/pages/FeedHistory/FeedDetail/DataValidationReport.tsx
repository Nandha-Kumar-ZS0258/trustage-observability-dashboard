import { useState } from 'react';
import { clsx } from 'clsx';
import type { ValidationReport } from '../../../hooks/useFeedHistory';

// ── Data Alignment Score gauge (SVG circle) ───────────────────────────────────

const RADIUS = 32;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 201

function AlignmentGauge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  const colour = clamped >= 95 ? '#16A34A' : clamped >= 80 ? '#D97706' : '#DC2626';
  const textCls = clamped >= 95 ? 'text-emerald-400' : clamped >= 80 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="#374151" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={RADIUS}
          fill="none"
          stroke={colour}
          strokeWidth="8"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className={clsx('absolute inset-0 flex items-center justify-center text-[17px] font-extrabold', textCls)}>
        {Math.round(clamped)}%
      </div>
    </div>
  );
}

// ── Gate row ──────────────────────────────────────────────────────────────────

interface GateRowProps {
  gateNum: number;
  gateName: string;
  passed: boolean;
  errorCount: number;
  warnings?: number;
  isWarnable?: boolean; // gate 2 can show ⚠ instead of ✓/✕
}

function GateRow({ gateNum, gateName, passed, errorCount, warnings = 0, isWarnable = false }: GateRowProps) {
  const hasWarnings = isWarnable && passed && warnings > 0;
  const icon = !passed ? '❌' : hasWarnings ? '⚠️' : '✅';
  const statusCls = !passed ? 'text-red-400' : hasWarnings ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
      <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">
          Gate {gateNum} — {gateName}
        </p>
        <p className={clsx('text-xs mt-0.5', statusCls)}>
          {!passed
            ? `Failed · ${errorCount} error${errorCount !== 1 ? 's' : ''}`
            : hasWarnings
            ? `Passed with ${warnings} warning${warnings !== 1 ? 's' : ''}${errorCount > 0 ? ` · ${errorCount} error${errorCount !== 1 ? 's' : ''}` : ''}`
            : 'Passed'}
        </p>
      </div>
    </div>
  );
}

// ── Record counts table ───────────────────────────────────────────────────────

function RecordRow({
  label,
  source,
  written,
}: {
  label: string;
  source: number | null;
  written: number | null;
}) {
  const mismatch = source !== null && written !== null && source !== written;
  return (
    <tr className="border-b border-gray-800">
      <td className="py-2 pr-4 text-xs text-gray-400 font-medium whitespace-nowrap">{label}</td>
      <td className="py-2 px-3 text-xs text-gray-300 tabular-nums">
        {source !== null ? source.toLocaleString() : '—'}
      </td>
      <td className={clsx('py-2 pl-3 text-xs tabular-nums', mismatch ? 'text-amber-400 font-semibold' : 'text-gray-300')}>
        {written !== null ? written.toLocaleString() : '—'}
      </td>
    </tr>
  );
}

// ── Field error collapsible table ─────────────────────────────────────────────

interface FieldError {
  row?: number | null;
  field?: string | null;
  sourceValue?: string | null;
  reason?: string | null;
}

function FieldErrorsTable({ jsonStr }: { jsonStr: string }) {
  const [open, setOpen] = useState(false);

  let errors: FieldError[] = [];
  try {
    const parsed = JSON.parse(jsonStr);
    errors = Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
  if (errors.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        className="flex items-center gap-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span>{open ? '▾' : '▸'}</span>
        Field Errors ({errors.length})
      </button>

      {open && (
        <div className="mt-2 bg-gray-950 border border-gray-800 rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-800/60 border-b border-gray-700">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Row</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Field</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Source Value</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((err, i) => (
                <tr key={i} className="border-b border-gray-800 last:border-0">
                  <td className="px-3 py-1.5 text-gray-500 tabular-nums">{err.row ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-300">{err.field ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-400 max-w-[120px] truncate">{err.sourceValue ?? '—'}</td>
                  <td className="px-3 py-1.5 text-gray-400">{err.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Alignment score colour helper ─────────────────────────────────────────────

function scoreCls(score: number | null) {
  if (score === null) return 'text-gray-500';
  return score >= 95 ? 'text-emerald-400 font-semibold'
    : score >= 80 ? 'text-amber-400 font-semibold'
    : 'text-red-400 font-semibold';
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  validationReport: ValidationReport | null;
}

export function DataValidationReport({ validationReport }: Props) {
  if (!validationReport) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        Data Validation Report not available for this feed.
      </p>
    );
  }

  const vr = validationReport;
  const score = vr.dataAlignmentScore;

  return (
    <div className="space-y-6">

      {/* ── Alignment score + gate overview ── */}
      <div className="flex gap-5 items-start">
        <div className="flex flex-col items-center gap-1">
          <AlignmentGauge score={score ?? 0} />
          <p className="text-[10px] text-gray-500 text-center">Data Alignment<br />Score</p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Data Alignment Score
          </p>
          <p className={clsx('text-xl font-extrabold mb-3', scoreCls(score))}>
            {score !== null ? `${score.toFixed(1)}%` : '—'}
          </p>
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between border-b border-gray-800 py-1">
              <span>Records Rejected</span>
              <strong className={vr.dqBlocked > 0 ? 'text-red-400' : 'text-gray-300'}>
                {vr.dqBlocked.toLocaleString()}
              </strong>
            </div>
            <div className="flex justify-between py-1">
              <span>Warnings</span>
              <strong className={vr.dqWarnings > 0 ? 'text-amber-400' : 'text-gray-300'}>
                {vr.dqWarnings.toLocaleString()}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Three-gate status ── */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Validation Gates
        </p>
        <div className="bg-gray-950 border border-gray-800 rounded-lg px-4">
          <GateRow
            gateNum={1}
            gateName="Schema Check"
            passed={vr.gate1Passed}
            errorCount={vr.gate1ErrorCount}
          />
          <GateRow
            gateNum={2}
            gateName="Business Rules"
            passed={vr.gate2Passed}
            errorCount={vr.gate2ErrorCount}
            warnings={vr.dqWarnings}
            isWarnable
          />
          <GateRow
            gateNum={3}
            gateName="DB Reconciliation"
            passed={vr.gate3Passed}
            errorCount={vr.gate3ErrorCount}
          />
        </div>
      </div>

      {/* ── Record counts table ── */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Record Counts
        </p>
        <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="py-2 pr-4 pl-4 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Record Type
                </th>
                <th className="py-2 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="py-2 pl-3 pr-4 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Written to TruStage Standard
                </th>
              </tr>
            </thead>
            <tbody>
              <RecordRow label="Members"  source={vr.sourceMemberCount}  written={vr.prodMemberCount} />
              <RecordRow label="Accounts" source={vr.sourceAccountCount} written={vr.prodAccountCount} />
              <RecordRow label="Loans"    source={vr.sourceLoanCount}    written={vr.prodLoanCount} />
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Field errors (collapsible) ── */}
      {vr.gateDetailsJson && (
        <FieldErrorsTable jsonStr={vr.gateDetailsJson} />
      )}
    </div>
  );
}
