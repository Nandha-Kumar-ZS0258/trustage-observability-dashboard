import { CheckCircle2, XCircle } from 'lucide-react';
import type { ValidationDetail } from '../../../types/telemetry';

interface ValidationReportProps {
  validation: ValidationDetail;
}

export function ValidationReport({ validation: v }: ValidationReportProps) {
  const missing = v.missingRequiredColumns
    ? JSON.parse(v.missingRequiredColumns) as string[]
    : [];
  const unknown = v.unknownColumnsDetected
    ? JSON.parse(v.unknownColumnsDetected) as string[]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {v.validationPassed
          ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          : <XCircle className="w-5 h-5 text-red-400" />}
        <div>
          <p className="text-sm font-medium text-white">
            {v.validationPassed ? 'Data Validation Passed' : 'Data Validation Failed'}
          </p>
          {v.schemaMatchScore != null && (
            <p className="text-xs text-gray-400">Data Alignment Score: {v.schemaMatchScore}%</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Stat label="Errors"          value={v.errorsCount ?? 0}          bad={!!v.errorsCount} />
        <Stat label="Warnings"        value={v.warningsCount ?? 0}        bad={false} />
        <Stat label="Type Mismatches" value={v.dataTypeMismatchCount ?? 0} bad={!!v.dataTypeMismatchCount} />
        <Stat label="Null Violations" value={v.nullViolations ?? 0}       bad={!!v.nullViolations} />
      </div>

      {missing.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Missing required columns</p>
          <div className="flex flex-wrap gap-1">
            {missing.map(c => (
              <span key={c} className="badge bg-red-500/15 text-red-400 text-[10px]">{c}</span>
            ))}
          </div>
        </div>
      )}

      {unknown.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Unknown columns detected</p>
          <div className="flex flex-wrap gap-1">
            {unknown.map(c => (
              <span key={c} className="badge bg-amber-500/15 text-amber-400 text-[10px]">{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: number; bad: boolean }) {
  return (
    <div className="bg-gray-800 rounded-lg p-2.5">
      <p className="text-gray-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${bad && value > 0 ? 'text-red-400' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}
