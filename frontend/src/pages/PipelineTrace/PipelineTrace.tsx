import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RotateCcw, CheckCircle2, AlertTriangle, XCircle,
  Clock, ChevronRight, CloudUpload, Cpu, FileCheck, ShieldCheck,
  Scale, Database, Activity,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { useDemo } from '../../hooks/useDemo';
import type { PipelineLogEvent, PipelineStage, StageInfo, StageStatus } from '../../types/demo';

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAVY = '#0F2744';

// ─── Stage config ─────────────────────────────────────────────────────────────
const STAGE_ICONS: Record<PipelineStage, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  blob:             CloudUpload,
  ingestion:        Cpu,
  transform:        FileCheck,
  schemaValidation: ShieldCheck,
  rulesValidation:  Scale,
  publishing:       Database,
};

const STAGE_COLORS: Record<StageStatus, { bar: string; icon: string; pill: string; pillText: string; border: string }> = {
  pending: { bar: '#CBD5E1', icon: '#94A3B8', pill: '#F1F5F9', pillText: '#64748B', border: '#E2E8F0' },
  running: { bar: '#2E8CE6', icon: '#1A6DB5', pill: '#DBEAFE', pillText: '#1D4ED8', border: '#93C5FD' },
  pass:    { bar: '#16A34A', icon: '#15803D', pill: '#DCFCE7', pillText: '#166534', border: '#86EFAC' },
  warn:    { bar: '#D97706', icon: '#B45309', pill: '#FEF3C7', pillText: '#92400E', border: '#FCD34D' },
  fail:    { bar: '#DC2626', icon: '#B91C1C', pill: '#FEE2E2', pillText: '#991B1B', border: '#FCA5A5' },
};

// Kafka listener tab config
type LogTab = 'all' | PipelineStage;
const LOG_TABS: { id: LogTab; label: string; stageId: PipelineStage | null }[] = [
  { id: 'all',              label: 'All',                       stageId: null },
  { id: 'blob',             label: 'BlobTrigger',               stageId: 'blob' },
  { id: 'ingestion',        label: 'IngestionListener',         stageId: 'ingestion' },
  { id: 'transform',        label: 'TransformListener',         stageId: 'transform' },
  { id: 'schemaValidation', label: 'SchemaValidationListener',  stageId: 'schemaValidation' },
  { id: 'rulesValidation',  label: 'RulesValidationListener',   stageId: 'rulesValidation' },
  { id: 'publishing',       label: 'PublishingListener',        stageId: 'publishing' },
];

// History window options (hours)
const HISTORY_WINDOWS = [
  { hours: 1,   label: '1h' },
  { hours: 6,   label: '6h' },
  { hours: 24,  label: '24h' },
  { hours: 168, label: '7d' },
] as const;

type SourceFilter = 'all' | 'history' | 'live';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: StageStatus }) {
  const c = STAGE_COLORS[status];
  const labels: Record<StageStatus, string> = {
    pending: 'Pending', running: 'Running', pass: 'Pass', warn: 'Warning', fail: 'Failed',
  };
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ background: c.pill, color: c.pillText }}
    >
      {status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse inline-block" />}
      {labels[status]}
    </span>
  );
}

function StageCard({ stage }: { stage: StageInfo }) {
  const Icon = STAGE_ICONS[stage.id];
  const c    = STAGE_COLORS[stage.status];
  return (
    <div
      className="bg-white rounded-xl flex-1 min-w-[100px] overflow-hidden"
      style={{ border: `1px solid ${c.border}`, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}
    >
      <div className="h-[3px]" style={{ background: c.bar }} />
      <div className="px-3 py-3 flex flex-col items-center gap-1.5 text-center">
        <Icon className="w-[18px] h-[18px]" style={{ color: c.icon }} />
        <span className="text-[11px] font-semibold text-slate-700 leading-tight">{stage.label}</span>
        <StatusPill status={stage.status} />
        {stage.keyMetric && (
          <span className="text-[10px] text-slate-500 leading-tight">{stage.keyMetric}</span>
        )}
      </div>
    </div>
  );
}

function LevelBadge({ level, source }: { level: string; source?: 'history' | 'live' }) {
  if (source === 'history')
    return <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: '#F1F5F9', color: '#94A3B8' }}>HIST</span>;
  if (level === 'warn')
    return <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>WARN</span>;
  if (level === 'error')
    return <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: '#FEE2E2', color: '#991B1B' }}>ERR</span>;
  return <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>INFO</span>;
}

function LogRow({ log }: { log: PipelineLogEvent }) {
  const isHist = log.source === 'history';
  return (
    <div className="flex items-start gap-2 py-0.5" style={{ opacity: isHist ? 0.65 : 1 }}>
      <span className="shrink-0 text-[10px] tabular-nums w-16" style={{ color: '#94A3B8' }}>
        {format(parseISO(log.timestamp), 'HH:mm:ss')}
      </span>
      <LevelBadge level={log.level} source={log.source} />
      <span
        className="text-[11px] leading-relaxed break-all flex-1"
        style={{
          color: isHist        ? '#94A3B8'
               : log.level === 'warn'  ? '#92400E'
               : log.level === 'error' ? '#991B1B'
               : '#334155',
        }}
      >
        {log.message}
      </span>
    </div>
  );
}

function LiveDivider() {
  return (
    <div className="flex items-center gap-2 my-2 select-none">
      <div className="flex-1 border-t" style={{ borderColor: '#CBD5E1' }} />
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
          Live
        </span>
      </div>
      <div className="flex-1 border-t" style={{ borderColor: '#CBD5E1' }} />
    </div>
  );
}

function SummaryStatCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'green' | 'red' | 'amber' }) {
  const cfg = {
    blue:  { bar: '#2E8CE6', val: '#1A6DB5' },
    green: { bar: '#16A34A', val: '#15803D' },
    red:   { bar: '#DC2626', val: '#991B1B' },
    amber: { bar: '#D97706', val: '#B45309' },
  }[color];
  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div className="h-[3px]" style={{ background: cfg.bar }} />
      <div className="px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#64748B' }}>{label}</div>
        <div className="text-3xl font-bold" style={{ color: cfg.val }}>{value.toLocaleString()}</div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PipelineTrace() {
  const {
    stages, allLogs, liveLogs,
    summary, historyLoading, historyError, historyHours, setHistoryHours, reset,
  } = useDemo();

  const [activeTab,     setActiveTab]     = useState<LogTab>('all');
  const [sourceFilter,  setSourceFilter]  = useState<SourceFilter>('all');
  const logBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new live events arrive
  useEffect(() => {
    if (liveLogs.length > 0)
      logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLogs.length]);

  const handleReset = useCallback(() => {
    reset();
    setActiveTab('all');
    setSourceFilter('all');
  }, [reset]);

  // ── Derive logs for the active tab ────────────────────────────────────────
  const activeTabConfig = LOG_TABS.find(t => t.id === activeTab)!;
  const tabLogs: PipelineLogEvent[] = activeTabConfig.stageId === null
    ? allLogs
    : (stages.find(s => s.id === activeTabConfig.stageId)?.logs ?? []);

  // Apply source filter
  const filteredLogs: PipelineLogEvent[] = sourceFilter === 'all'
    ? tabLogs
    : tabLogs.filter(l => l.source === sourceFilter);

  // Index of the first live log in the *unfiltered* tab list (used for the divider)
  const firstLiveIdx = tabLogs.findIndex(l => l.source === 'live');

  // Badge: non-info count per stage tab
  const stageBadge = (stageId: PipelineStage) =>
    stages.find(s => s.id === stageId)?.logs.filter(l => l.level !== 'info').length ?? 0;

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-6 h-14 flex items-center justify-between" style={{ borderColor: '#E2E8F0' }}>
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4" style={{ color: NAVY }} />
          <h1 className="text-base font-bold" style={{ color: NAVY }}>Pipeline Trace</h1>
          <span className="text-xs" style={{ color: '#64748B' }}>
            Live adaptor pipeline events — streamed from Kafka listeners in real-time
          </span>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}
          onMouseOver={e => (e.currentTarget.style.background = '#E2E8F0')}
          onMouseOut={e  => (e.currentTarget.style.background = '#F1F5F9')}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      <div className="p-6 space-y-5">

        {/* ── Azure Blob info banner ──────────────────────────────────────── */}
        <div className="rounded-xl flex items-start gap-3 px-5 py-4" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <CloudUpload className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#1A6DB5' }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: '#1D4ED8' }}>Upload to Azure Blob Storage</p>
            <p className="text-[12px] mt-0.5" style={{ color: '#3B82F6' }}>
              Drop your CreditUnionJson file into the{' '}
              <code className="font-mono bg-blue-100 px-1 rounded">CreditUnionJson/</code>{' '}
              container. The pipeline will detect it automatically and begin processing below.
            </p>
          </div>
        </div>

        {/* ── 1. Pipeline Flow ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
          <div className="px-5 py-3 border-b flex items-center justify-between"
            style={{ borderColor: '#E2E8F0', background: NAVY, borderRadius: '12px 12px 0 0' }}>
            <span className="text-[13px] font-bold text-white">1. Pipeline Flow</span>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,.5)' }}>
              {stages.filter(s => s.status === 'pass' || s.status === 'warn').length} / {stages.length} stages complete
            </span>
          </div>
          <div className="p-5">
            <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
              {stages.map((stage, i) => (
                <div key={stage.id} className="flex items-center gap-2 flex-1 min-w-[90px]">
                  <StageCard stage={stage} />
                  {i < stages.length - 1 && (
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#CBD5E1' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 2. Log Panel ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>

          {/* Header row */}
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ background: NAVY, borderRadius: '12px 12px 0 0' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[13px] font-bold text-white">Logs</span>
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,.5)' }}>
                {allLogs.length} event{allLogs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-3">
              {/* History window selector */}
              <div className="flex items-center gap-0.5 rounded-md overflow-hidden" style={{ border: '1px solid rgba(255,255,255,.15)' }}>
                {HISTORY_WINDOWS.map(w => (
                  <button
                    key={w.hours}
                    onClick={() => setHistoryHours(w.hours)}
                    className="text-[10px] font-medium px-2 py-1 transition-colors"
                    style={{
                      background: historyHours === w.hours ? 'rgba(255,255,255,.2)' : 'transparent',
                      color:      historyHours === w.hours ? 'white' : 'rgba(255,255,255,.45)',
                    }}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              {/* Source filter */}
              <div className="flex items-center gap-0.5 rounded-md overflow-hidden" style={{ border: '1px solid rgba(255,255,255,.15)' }}>
                {(['all', 'history', 'live'] as SourceFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setSourceFilter(f)}
                    className="text-[10px] font-medium px-2 py-1 capitalize transition-colors"
                    style={{
                      background: sourceFilter === f ? 'rgba(255,255,255,.2)' : 'transparent',
                      color:      sourceFilter === f ? 'white' : 'rgba(255,255,255,.45)',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Kafka listener tabs */}
          <div className="flex border-b overflow-x-auto" style={{ borderColor: '#E2E8F0' }}>
            {LOG_TABS.map(tab => {
              const stageStatus = tab.stageId ? stages.find(s => s.id === tab.stageId)?.status ?? 'pending' : null;
              const badge = tab.stageId ? stageBadge(tab.stageId) : allLogs.filter(l => l.level !== 'info').length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0',
                    activeTab === tab.id
                      ? 'border-[#1A6DB5] text-[#1A6DB5] font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700',
                  )}
                >
                  {stageStatus === 'pass'    && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  {stageStatus === 'warn'    && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                  {stageStatus === 'fail'    && <XCircle className="w-3 h-3 text-red-500" />}
                  {stageStatus === 'running' && <Clock className="w-3 h-3 text-blue-500 animate-pulse" />}
                  {stageStatus === 'pending' && tab.stageId && <div className="w-2.5 h-2.5 rounded-full border border-slate-300" />}
                  {tab.label}
                  {badge > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: '#FEF3C7', color: '#92400E' }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Log content */}
          <div
            className="h-80 overflow-y-auto p-4 space-y-0.5"
            style={{ background: '#F8FAFC', fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {historyLoading ? (
              <p className="text-[12px] italic" style={{ color: '#94A3B8' }}>Loading history…</p>
            ) : historyError ? (
              <p className="text-[12px]" style={{ color: '#991B1B' }}>{historyError}</p>
            ) : filteredLogs.length === 0 ? (
              <p className="text-[12px] italic" style={{ color: '#94A3B8' }}>
                {sourceFilter === 'live' ? 'Waiting for live events…' : 'No events in the selected window.'}
              </p>
            ) : (
              filteredLogs.map((log, i) => {
                // When showing all sources, insert the Live divider where history ends
                const showDivider = sourceFilter === 'all'
                  && firstLiveIdx > 0
                  && i === firstLiveIdx;
                return (
                  <div key={i}>
                    {showDivider && <LiveDivider />}
                    <LogRow log={log} />
                  </div>
                );
              })
            )}
            <div ref={logBottomRef} />
          </div>
        </div>

        {/* ── 3. Ingestion Summary ─────────────────────────────────────────── */}
        {summary && (
          <div className="bg-white rounded-xl" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
            <div className="px-5 py-3 border-b"
              style={{ borderColor: '#E2E8F0', background: NAVY, borderRadius: '12px 12px 0 0' }}>
              <span className="text-[13px] font-bold text-white">3. Ingestion Summary</span>
            </div>
            <div className="p-5 grid grid-cols-4 gap-4">
              <SummaryStatCard label="Submitted"       value={summary.submitted} color="blue"  />
              <SummaryStatCard label="Ingested to SQL" value={summary.ingested}  color="green" />
              <SummaryStatCard label="Blocked"         value={summary.blocked}   color="red"   />
              <SummaryStatCard label="Warnings"        value={summary.warnings}  color="amber" />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
