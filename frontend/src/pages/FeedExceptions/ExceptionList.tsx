import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useExceptions } from '../../hooks/useExceptions';
import { ExceptionRow } from './ExceptionRow';
import type { FeedException } from '../../types/exceptions';

// Step labels from Nomenclature (Section 1 of MONITORING_SPEC.md)
const STEP_OPTIONS = [
  'Receive CU File',
  'Data Validation Check',
  'Apply Standardisation Rules',
  'Standardise & Transform',
  'Write to TruStage Standard',
  'Feed Delivered',
];

type StatusFilter = '' | 'unresolved' | 'resolved';

export function ExceptionList() {
  const [search,       setSearch]       = useState('');
  const [cuFilter,     setCuFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [stepFilter,   setStepFilter]   = useState('');
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // Fetch all exceptions — client-side filtering for responsive UX
  const { data: allExceptions = [], isLoading } = useExceptions({});

  // Derive unique CU partners for the CU Partner filter dropdown
  const cuPartners = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of allExceptions) seen.set(e.cuId, e.cuName);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [allExceptions]);

  // Apply all filters client-side
  const filtered = useMemo(() => {
    let list: FeedException[] = allExceptions;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.cuName.toLowerCase().includes(q) ||
        e.exceptionCode.toLowerCase().includes(q) ||
        e.exceptionMessage.toLowerCase().includes(q),
      );
    }

    if (cuFilter) {
      list = list.filter(e => e.cuId === cuFilter);
    }

    if (statusFilter === 'unresolved') {
      list = list.filter(e => !e.resolvedFlag);
    } else if (statusFilter === 'resolved') {
      list = list.filter(e => e.resolvedFlag);
    }

    if (stepFilter) {
      list = list.filter(e => e.failedStep === stepFilter);
    }

    return list;
  }, [allExceptions, search, cuFilter, statusFilter, stepFilter]);

  // Default sort: unresolved first, then most recent firstOccurredAt
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      if (a.resolvedFlag !== b.resolvedFlag) return a.resolvedFlag ? 1 : -1;
      return new Date(b.firstOccurredAt).getTime() - new Date(a.firstOccurredAt).getTime();
    }),
    [filtered],
  );

  function toggleRow(id: string) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  return (
    <div>
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            className="input pl-8 w-52"
            placeholder="Search exceptions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* CU Partner */}
        <select
          className="select w-auto"
          value={cuFilter}
          onChange={e => setCuFilter(e.target.value)}
        >
          <option value="">All CU Partners</option>
          {cuPartners.map(cu => (
            <option key={cu.id} value={cu.id}>{cu.name}</option>
          ))}
        </select>

        {/* Status */}
        <select
          className="select w-auto"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="">All Statuses</option>
          <option value="unresolved">Active</option>
          <option value="resolved">Resolved</option>
        </select>

        {/* Failed Step — uses step labels from Nomenclature */}
        <select
          className="select w-auto"
          value={stepFilter}
          onChange={e => setStepFilter(e.target.value)}
        >
          <option value="">All Steps</option>
          {STEP_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* ── Exception table ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-700">
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                First Occurred
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                CU Partner
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Exception Type
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                Failed Step
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Owner
              </th>
              {/* Expand chevron column */}
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500 text-sm">
                  Loading exceptions…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500 text-sm">
                  No exceptions found
                </td>
              </tr>
            ) : (
              sorted.map(exc => (
                <ExceptionRow
                  key={exc.exceptionId}
                  exception={exc}
                  isExpanded={expandedId === exc.exceptionId}
                  onToggle={() => toggleRow(exc.exceptionId)}
                />
              ))
            )}
          </tbody>
        </table>

        {!isLoading && sorted.length > 0 && (
          <p className="text-xs text-gray-600 text-center py-3 border-t border-gray-800">
            Showing {sorted.length} {sorted.length === 1 ? 'exception' : 'exceptions'} — click any row to expand detail
          </p>
        )}
      </div>
    </div>
  );
}
