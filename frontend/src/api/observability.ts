import axios from 'axios';
import type {
  OverviewKpi, LiveFeedEvent, CuHealthCard, TimelinePoint, HourlyRows,
  RunSummary, RunDetail, RunFilters,
  CuSummary, DurationTrend, DailyVolume, ValidationTrend, ErrorFrequency,
  StageDurationHeatmap, ThroughputTrend, SlowestRun, StageSplit, MemoryTrend,
  SchemaHealthRow, ValidationFailure, SchemaDriftAlert, ColumnAnomaly,
  SlaSummary, SlaBreach, ErrorSummary, RetryRun, FailedRun,
} from '../types/telemetry';

const api = axios.create({ baseURL: '/observability' });

// ─── Overview ────────────────────────────────────────────────────────────────

export const fetchOverviewKpis        = (): Promise<OverviewKpi>       => api.get('/kpis/today').then(r => r.data);
export const fetchLiveFeed            = (): Promise<LiveFeedEvent[]>   => api.get('/feed/live').then(r => r.data);
export const fetchCuHealth            = (): Promise<CuHealthCard[]>    => api.get('/cu/health').then(r => r.data);
export const fetchTodayTimeline       = (): Promise<TimelinePoint[]>   => api.get('/overview/timeline').then(r => r.data);
export const fetchHourlyRows          = (): Promise<HourlyRows[]>      => api.get('/overview/hourly-rows').then(r => r.data);

// ─── Run Explorer ─────────────────────────────────────────────────────────────

export const fetchRuns = (filters: RunFilters): Promise<RunSummary[]> =>
  api.get('/runs', { params: filters }).then(r => r.data);

export const fetchRunDetail = (correlationId: string): Promise<RunDetail> =>
  api.get(`/runs/${correlationId}`).then(r => r.data);

// ─── CU Detail ───────────────────────────────────────────────────────────────

export const fetchCuSummary          = (cuId: string): Promise<CuSummary>          => api.get(`/cu/${cuId}`).then(r => r.data);
export const fetchCuDurationTrend    = (cuId: string, days = 30): Promise<DurationTrend[]>   => api.get(`/cu/${cuId}/duration-trend`, { params: { days } }).then(r => r.data);
export const fetchCuDailyVolume      = (cuId: string): Promise<DailyVolume[]>      => api.get(`/cu/${cuId}/daily-volume`).then(r => r.data);
export const fetchCuValidationTrend  = (cuId: string): Promise<ValidationTrend[]> => api.get(`/cu/${cuId}/validation-trend`).then(r => r.data);
export const fetchCuRecentRuns       = (cuId: string): Promise<RunSummary[]>       => api.get(`/cu/${cuId}/runs`).then(r => r.data);
export const fetchCuErrorHistory     = (cuId: string): Promise<ErrorFrequency[]>  => api.get(`/cu/${cuId}/errors`).then(r => r.data);

// ─── Performance ─────────────────────────────────────────────────────────────

export const fetchStageDurationHeatmap = (): Promise<StageDurationHeatmap[]> => api.get('/performance/stages').then(r => r.data);
export const fetchThroughputTrend      = (): Promise<ThroughputTrend[]>      => api.get('/performance/throughput').then(r => r.data);
export const fetchSlowestRuns          = (): Promise<SlowestRun[]>           => api.get('/performance/slowest-runs').then(r => r.data);
export const fetchStageSplit           = (): Promise<StageSplit>             => api.get('/performance/stage-split').then(r => r.data);
export const fetchMemoryTrend          = (): Promise<MemoryTrend[]>          => api.get('/performance/memory').then(r => r.data);

// ─── Schema Health ───────────────────────────────────────────────────────────

export const fetchSchemaHealth      = (): Promise<SchemaHealthRow[]>      => api.get('/validation/health').then(r => r.data);
export const fetchValidationFailures = (): Promise<ValidationFailure[]>  => api.get('/validation/failures').then(r => r.data);
export const fetchSchemaDriftAlerts = (): Promise<SchemaDriftAlert[]>    => api.get('/validation/drift-alerts').then(r => r.data);
export const fetchColumnAnomalies   = (): Promise<ColumnAnomaly[]>       => api.get('/validation/column-anomalies').then(r => r.data);

// ─── Alerts & SLA ────────────────────────────────────────────────────────────

export const fetchSlaSummary  = (): Promise<SlaSummary>    => api.get('/alerts/sla').then(r => r.data);
export const fetchSlaBreaches = (): Promise<SlaBreach[]>  => api.get('/alerts/sla/breaches').then(r => r.data);
export const fetchErrorSummary = (): Promise<ErrorSummary[]> => api.get('/alerts/errors').then(r => r.data);
export const fetchRetryRuns   = (): Promise<RetryRun[]>   => api.get('/alerts/retries').then(r => r.data);
export const fetchFailedRuns  = (): Promise<FailedRun[]>  => api.get('/alerts/failed-runs').then(r => r.data);
