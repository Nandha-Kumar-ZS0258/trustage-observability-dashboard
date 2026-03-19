import { useCallback, useEffect, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { fetchPipelineHistory } from '../api/observability';
import type {
  DemoSummary,
  PipelineLogEvent,
  PipelineStage,
  StageInfo,
  StageStatus,
} from '../types/demo';

const STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'blob',             label: 'Blob Upload' },
  { id: 'ingestion',        label: 'Ingestion' },
  { id: 'transform',        label: 'Transform' },
  { id: 'schemaValidation', label: 'Schema' },
  { id: 'rulesValidation',  label: 'Rules' },
  { id: 'publishing',       label: 'Publishing' },
];

function initialStages(): StageInfo[] {
  return STAGES.map(s => ({ ...s, status: 'pending', keyMetric: undefined, logs: [] }));
}

/** Extract a display metric from a log message for a given stage. */
function extractMetric(stage: PipelineStage, message: string): string | undefined {
  switch (stage) {
    case 'transform': {
      const m = message.match(/(\d+) members,\s*(\d+) errors/i);
      if (m) return `${m[1]}m / ${m[2]}err`;
      break;
    }
    case 'schemaValidation': {
      if (/passed schema validation/i.test(message)) return 'PASS';
      if (/failed schema validation/i.test(message)) return 'FAIL';
      break;
    }
    case 'rulesValidation': {
      const g = message.match(/Gate1=(\w+)\s+Gate2=(\w+)/i);
      if (g) return `G1:${g[1]} G2:${g[2]}`;
      break;
    }
    case 'publishing': {
      const m = message.match(/persisted (\d+) members/i);
      if (m) return `${m[1]} rows → SQL`;
      break;
    }
  }
  return undefined;
}

/** Determine how a new log event should update the stage status. */
function nextStatus(
  current: StageStatus,
  level: string,
  message: string,
  stage: PipelineStage,
): StageStatus {
  if (current === 'fail') return 'fail';
  if (level === 'error') return 'fail';

  if (stage === 'rulesValidation' && /Gate2=FAIL/i.test(message)) return 'warn';
  if (stage === 'publishing' && /Overall=Failed/i.test(message))   return 'warn';
  if (level === 'warn') return current === 'pass' ? 'warn' : current === 'pending' ? 'running' : current;

  if (stage === 'ingestion'        && /Ingestion started/i.test(message))         return 'pass';
  if (stage === 'transform'        && /Mapping applied/i.test(message))            return 'pass';
  if (stage === 'schemaValidation' && /Schema validation passed/i.test(message))  return 'pass';
  if (stage === 'rulesValidation'  && /Rules validation complete/i.test(message)) return current === 'warn' ? 'warn' : 'pass';
  if (stage === 'publishing'       && /Run completed/i.test(message))              return current === 'warn' ? 'warn' : 'pass';

  if (current === 'pending') return 'running';
  return current;
}

/** Replay a list of logs to derive initial stage states (used for history pre-population). */
function computeStagesFromLogs(logs: PipelineLogEvent[]): StageInfo[] {
  const stages = initialStages();
  for (const log of logs) {
    if (log.stage === 'system') continue;
    const stage = log.stage as PipelineStage;
    const idx = stages.findIndex(s => s.id === stage);
    if (idx < 0) continue;
    const s = stages[idx];
    stages[idx] = {
      ...s,
      status:    nextStatus(s.status, log.level, log.message, stage),
      keyMetric: extractMetric(stage, log.message) ?? s.keyMetric,
      logs:      [...s.logs, log],
    };
  }
  return stages;
}

// ─────────────────────────────────────────────────────────────────────────────

export function useDemo() {
  const [stages,         setStages]         = useState<StageInfo[]>(initialStages);
  const [historyLogs,    setHistoryLogs]    = useState<PipelineLogEvent[]>([]);
  const [liveLogs,       setLiveLogs]       = useState<PipelineLogEvent[]>([]);
  const [summary,        setSummary]        = useState<DemoSummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError,   setHistoryError]   = useState<string | null>(null);
  const [historyHours,   setHistoryHours]   = useState(24);

  // ── Fetch history when hours selector changes ─────────────────────────────
  useEffect(() => {
    setHistoryLoading(true);
    setHistoryError(null);
    fetchPipelineHistory(historyHours)
      .then(logs => {
        const tagged = logs.map(l => ({ ...l, source: 'history' as const }));
        setHistoryLogs(tagged);
        // Pre-populate stage cards from historical data so the pipeline flow
        // reflects the last known run state on page load.
        setStages(computeStagesFromLogs(tagged));
      })
      .catch((err: unknown) => {
        console.error('[PipelineTrace] History fetch failed:', err);
        setHistoryError('Failed to load history — check API connection');
      })
      .finally(() => setHistoryLoading(false));
  }, [historyHours]);

  // ── SignalR subscription for live events ──────────────────────────────────
  useEffect(() => {
    const conn = new HubConnectionBuilder()
      .withUrl('/hubs/telemetry')
      .withAutomaticReconnect()
      .build();

    conn.on('PipelineLog', (evt: PipelineLogEvent) => {
      const tagged = { ...evt, source: 'live' as const };
      setLiveLogs(prev => [...prev, tagged]);

      if (evt.stage === 'system') return;
      const stage = evt.stage as PipelineStage;

      setStages(prev => prev.map(s => {
        if (s.id !== stage) return s;
        const newStatus = nextStatus(s.status, evt.level, evt.message, stage);
        const newMetric = extractMetric(stage, evt.message) ?? s.keyMetric;
        return { ...s, status: newStatus, keyMetric: newMetric, logs: [...s.logs, tagged] };
      }));
    });

    conn.on('PipelineSummary', (dto: DemoSummary) => {
      setSummary(dto);
    });

    conn.start().catch(console.error);
    return () => { conn.stop(); };
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStages(initialStages());
    setHistoryLogs([]);
    setLiveLogs([]);
    setSummary(null);
  }, []);

  return {
    stages,
    allLogs: [...historyLogs, ...liveLogs],
    historyLogs,
    liveLogs,
    summary,
    historyLoading,
    historyError,
    historyHours,
    setHistoryHours,
    reset,
  };
}
