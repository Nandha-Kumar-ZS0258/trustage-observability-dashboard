import { useCallback, useEffect, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { uploadDemoFile as apiUploadDemoFile } from '../api/observability';
import type {
  DemoSummary,
  DemoUploadResult,
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
    case 'ingestion': {
      // "deserialized 1000 members from …"
      const m = message.match(/deserialized (\d+) members/i);
      if (m) return `${m[1]} members`;
      // "finished: 1000 members, 1811 accounts …"
      const f = message.match(/finished:\s*(\d+) members/i);
      if (f) return `${f[1]} members`;
      break;
    }
    case 'transform': {
      // "1000 members, 0 errors"
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
      // "Gate1=PASS Gate2=FAIL | blocked=65 warnings=356"
      const g = message.match(/Gate1=(\w+)\s+Gate2=(\w+)/i);
      if (g) return `G1:${g[1]} G2:${g[2]}`;
      break;
    }
    case 'publishing': {
      // "persisted 935 members"
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

  // Hard failure indicators
  if (stage === 'rulesValidation' && /Gate2=FAIL/i.test(message)) return 'warn';
  if (stage === 'publishing' && /Overall=Failed/i.test(message))   return 'warn';
  if (level === 'warn') return current === 'pass' ? 'warn' : current === 'pending' ? 'running' : current;

  // "Processed message" = stage completed successfully
  if (/Processed message for CU/i.test(message)) {
    return current === 'warn' ? 'warn' : 'pass';
  }

  // Any log for this stage means it's at least running
  if (current === 'pending') return 'running';

  return current;
}

/** Pull final summary numbers from publishing logs. */
function buildSummary(publishingLogs: PipelineLogEvent[], ingestionLogs: PipelineLogEvent[]): DemoSummary {
  let submitted = 0, ingested = 0, blocked = 0, warnings = 0;

  for (const log of ingestionLogs) {
    const m = log.message.match(/deserialized (\d+) members/i);
    if (m) submitted = parseInt(m[1], 10);
  }

  for (const log of publishingLogs) {
    const p = log.message.match(/persisted (\d+) members/i);
    if (p) ingested = parseInt(p[1], 10);

    const e = log.message.match(/Errors=(\d+)\s+Warnings=(\d+)/i);
    if (e) { blocked = parseInt(e[1], 10); warnings = parseInt(e[2], 10); }
  }

  return { submitted, ingested, blocked, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────

export function useDemo() {
  const [stages, setStages] = useState<StageInfo[]>(initialStages);
  const [allLogs, setAllLogs] = useState<PipelineLogEvent[]>([]);
  const [uploadResult, setUploadResult] = useState<DemoUploadResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DemoSummary | null>(null);

  // ── SignalR subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const conn = new HubConnectionBuilder()
      .withUrl('/hubs/telemetry')
      .withAutomaticReconnect()
      .build();

    conn.on('PipelineLog', (evt: PipelineLogEvent) => {
      setAllLogs(prev => [...prev, evt]);

      if (evt.stage === 'system') return;

      const stage = evt.stage as PipelineStage;

      setStages(prev => {
        const next = prev.map(s => {
          if (s.id !== stage) return s;

          const newStatus  = nextStatus(s.status, evt.level, evt.message, stage);
          const newMetric  = extractMetric(stage, evt.message) ?? s.keyMetric;
          const newLogs    = [...s.logs, evt];

          return { ...s, status: newStatus, keyMetric: newMetric, logs: newLogs };
        });

        // Recompute summary after each publishing update
        const pub = next.find(s => s.id === 'publishing');
        const ing = next.find(s => s.id === 'ingestion');
        if (pub && (pub.status === 'pass' || pub.status === 'warn')) {
          setSummary(buildSummary(pub.logs, ing?.logs ?? []));
        }

        return next;
      });
    });

    conn.start().catch(console.error);
    return () => { conn.stop(); };
  }, []);

  // ── File upload ───────────────────────────────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await apiUploadDemoFile(file);
      setUploadResult(result);
      setStages(prev =>
        prev.map(s => s.id === 'blob' ? { ...s, status: 'pass', keyMetric: file.name } : s)
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
      setStages(prev =>
        prev.map(s => s.id === 'blob' ? { ...s, status: 'fail' } : s)
      );
    } finally {
      setIsUploading(false);
    }
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStages(initialStages());
    setAllLogs([]);
    setUploadResult(null);
    setUploadError(null);
    setSummary(null);
    setIsUploading(false);
  }, []);

  return { stages, allLogs, uploadResult, isUploading, uploadError, summary, uploadFile, reset };
}
