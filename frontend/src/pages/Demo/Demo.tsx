import { useCallback, useRef, useState } from 'react';
import {
  Upload, RotateCcw, CheckCircle2, AlertTriangle, XCircle,
  Clock, ChevronRight, CloudUpload, Cpu, FileCheck, ShieldCheck,
  Scale, Database,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useDemo } from '../../hooks/useDemo';
import type { PipelineStage, StageInfo, StageStatus } from '../../types/demo';

// ─── Design tokens (matching wireframe) ──────────────────────────────────────
const NAVY   = '#0F2744';
const BLUE   = '#1A6DB5';

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

const LOG_TABS: { id: PipelineStage; label: string }[] = [
  { id: 'ingestion',        label: 'Ingestion' },
  { id: 'transform',        label: 'Transform' },
  { id: 'schemaValidation', label: 'Schema' },
  { id: 'rulesValidation',  label: 'Rules' },
  { id: 'publishing',       label: 'Publishing' },
];

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
      {/* colored top bar */}
      <div className="h-[3px]" style={{ background: c.bar }} />
      <div className="px-3 py-3 flex flex-col items-center gap-1.5 text-center">
        <Icon className="w-[18px] h-[18px]" style={{ color: c.icon }} />
        <span className="text-[11px] font-700 text-slate-700 font-semibold leading-tight">{stage.label}</span>
        <StatusPill status={stage.status} />
        {stage.keyMetric && (
          <span className="text-[10px] text-slate-500 leading-tight">{stage.keyMetric}</span>
        )}
      </div>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  if (level === 'warn')  return <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>WARN</span>;
  if (level === 'error') return <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: '#FEE2E2', color: '#991B1B' }}>ERR</span>;
  return <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>INFO</span>;
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

export default function Demo() {
  const { stages, uploadResult, isUploading, uploadError, summary, uploadFile, reset } = useDemo();
  const [activeTab, setActiveTab] = useState<PipelineStage>('ingestion');
  const [dragOver, setDragOver]   = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const logBottomRef  = useRef<HTMLDivElement>(null);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setSelectedFile(f);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setSelectedFile(f);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    await uploadFile(selectedFile);
  }, [selectedFile, uploadFile]);

  const handleReset = useCallback(() => {
    reset(); setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [reset]);

  const activeStage  = stages.find(s => s.id === activeTab);
  const activeLogs   = activeStage?.logs ?? [];
  const badgeCount   = (id: PipelineStage) =>
    stages.find(s => s.id === id)?.logs.filter(l => l.level !== 'info').length ?? 0;
  const publishingStatus = stages.find(s => s.id === 'publishing')?.status;
  const showSummary  = publishingStatus === 'pass' || publishingStatus === 'warn';

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-6 h-14 flex items-center justify-between" style={{ borderColor: '#E2E8F0' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold" style={{ color: NAVY }}>Pipeline Demo</h1>
          <span className="text-xs" style={{ color: '#64748B' }}>Upload a CreditUnionJson file and watch it flow through the pipeline in real-time</span>
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

        {/* ── 1. Upload ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
          <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: '#E2E8F0', background: NAVY, borderRadius: '12px 12px 0 0' }}>
            <span className="text-[13px] font-bold text-white">1. Upload File</span>
          </div>

          <div className="p-5">
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors"
              style={{
                borderColor: dragOver ? BLUE : selectedFile ? '#86EFAC' : '#CBD5E1',
                background:  dragOver ? '#EFF6FF' : selectedFile ? '#F0FDF4' : '#F8FAFC',
              }}
            >
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
              <Upload className="w-5 h-5 mx-auto mb-2" style={{ color: selectedFile ? '#16A34A' : '#94A3B8' }} />
              {selectedFile ? (
                <p className="text-[13px] font-semibold" style={{ color: '#15803D' }}>{selectedFile.name}</p>
              ) : (
                <p className="text-[13px]" style={{ color: '#94A3B8' }}>Drop a JSON file here or click to browse</p>
              )}
              {selectedFile && (
                <p className="text-[11px] mt-1" style={{ color: '#64748B' }}>
                  → CreditUnionJson/<span style={{ color: '#475569' }}>{selectedFile.name}</span>
                </p>
              )}
            </div>

            {/* Action row */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading || !!uploadResult}
                className="flex items-center gap-2 text-[13px] font-semibold px-4 py-2 rounded-lg transition-all"
                style={{
                  background: !selectedFile || !!uploadResult ? '#F1F5F9' : isUploading ? '#1A6DB5' : BLUE,
                  color:      !selectedFile || !!uploadResult ? '#94A3B8' : '#fff',
                  border:     '1px solid transparent',
                  cursor:     !selectedFile || !!uploadResult ? 'not-allowed' : isUploading ? 'wait' : 'pointer',
                }}
              >
                {isUploading ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
                ) : uploadResult ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#16A34A' }} /> Uploaded</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" /> Upload &amp; Trace</>
                )}
              </button>

              {uploadResult && (
                <span className="text-[12px] font-mono truncate" style={{ color: '#64748B' }}>
                  ✓ {uploadResult.containerPath}
                </span>
              )}
            </div>

            {uploadError && (
              <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg text-[12px]"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="break-all">{uploadError}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── 2. Pipeline flow ────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: '#E2E8F0', background: NAVY, borderRadius: '12px 12px 0 0' }}>
            <span className="text-[13px] font-bold text-white">2. Pipeline Flow</span>
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

        {/* ── 3. Log viewer ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
          {/* Header */}
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: NAVY, borderRadius: '12px 12px 0 0' }}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[13px] font-bold text-white">3. Live Logs</span>
          </div>

          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: '#E2E8F0' }}>
            {LOG_TABS.map(tab => {
              const stageStatus = stages.find(s => s.id === tab.id)?.status ?? 'pending';
              const badge = badgeCount(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                    activeTab === tab.id
                      ? 'border-[#1A6DB5] text-[#1A6DB5] font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700',
                  )}
                >
                  {stageStatus === 'pass'    && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  {stageStatus === 'warn'    && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                  {stageStatus === 'fail'    && <XCircle className="w-3 h-3 text-red-500" />}
                  {stageStatus === 'running' && <Clock className="w-3 h-3 text-blue-500 animate-pulse" />}
                  {stageStatus === 'pending' && <div className="w-2.5 h-2.5 rounded-full border border-slate-300" />}
                  {tab.label}
                  {badge > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Log content */}
          <div className="h-56 overflow-y-auto p-4 space-y-1" style={{ background: '#F8FAFC', fontFamily: "'IBM Plex Mono', monospace" }}>
            {activeLogs.length === 0 ? (
              <p className="text-[12px] italic" style={{ color: '#94A3B8' }}>Waiting for events…</p>
            ) : (
              activeLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <LevelBadge level={log.level} />
                  <span
                    className="text-[11px] leading-relaxed break-all flex-1"
                    style={{
                      color: log.level === 'warn' ? '#92400E' : log.level === 'error' ? '#991B1B' : '#334155',
                    }}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logBottomRef} />
          </div>
        </div>

        {/* ── 4. Summary ──────────────────────────────────────────────────── */}
        {showSummary && summary && (
          <div className="bg-white rounded-xl" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: '#E2E8F0', background: NAVY, borderRadius: '12px 12px 0 0' }}>
              <span className="text-[13px] font-bold text-white">4. Ingestion Summary</span>
            </div>
            <div className="p-5 grid grid-cols-4 gap-4">
              <SummaryStatCard label="Submitted"      value={summary.submitted} color="blue"  />
              <SummaryStatCard label="Ingested to SQL" value={summary.ingested} color="green" />
              <SummaryStatCard label="Blocked"         value={summary.blocked}  color="red"   />
              <SummaryStatCard label="Warnings"        value={summary.warnings} color="amber" />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
