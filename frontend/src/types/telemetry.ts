// ─── Core Event Types ─────────────────────────────────────────────────────────

export type EventType =
  | 'RunStarted'
  | 'RunCompleted'
  | 'BlobReceived'
  | 'IngestionStarted'
  | 'ValidationCompleted'
  | 'IngestionCompleted';

export type RunStatus = 'success' | 'failed' | 'partial' | 'retrying';

// ─── Overview ────────────────────────────────────────────────────────────────

export interface OverviewKpi {
  totalRuns: number;
  successRate: number;
  slaBreachesToday: number;
  activeCus: number;
}

export interface LiveFeedEvent {
  eventId: string;
  eventType: EventType;
  cuId: string;
  blobName: string | null;
  timestamp: string;
  totalProcessingDurationMs: number | null;
  status: RunStatus;
}

export interface CuHealthCard {
  cuId: string;
  lastRunTime: string | null;
  lastRunStatus: RunStatus;
  filesToday: number;
  rowsToday: number;
  slaBreached: boolean;
}

export interface TimelinePoint {
  cuId: string;
  startTime: string;
  status: RunStatus;
}

export interface HourlyRows {
  hour: number;
  totalRows: number;
}

// ─── Run Explorer ─────────────────────────────────────────────────────────────

export interface RunSummary {
  correlationId: string;
  cuId: string;
  blobName: string | null;
  fileType: string | null;
  startedAt: string;
  totalProcessingDurationMs: number | null;
  rowsProcessed: number | null;
  rowsFailed: number | null;
  validationPassed: boolean | null;
  slaBreach: boolean | null;
}

export interface RunEvent {
  eventId: string;
  eventType: EventType;
  stage: string;
  timestamp: string;
  blobName: string | null;
  hostName: string | null;
  memoryUsedMb: number | null;
  schemaMatchScore: number | null;
  validationErrors: number | null;
  rowsProcessed: number | null;
  totalDurationMs: number | null;
}

export interface StageDurations {
  download: number | null;
  process: number | null;
  persist: number | null;
  total: number | null;
}

export interface ValidationDetail {
  validationPassed: boolean;
  errorsCount: number | null;
  warningsCount: number | null;
  schemaMatchScore: number | null;
  missingRequiredColumns: string | null;
  unknownColumnsDetected: string | null;
  dataTypeMismatchCount: number | null;
  nullViolations: number | null;
}

export interface HostDetail {
  hostName: string | null;
  processId: number | null;
  cpuUsagePercent: number | null;
  memoryUsedMb: number | null;
  threadId: number | null;
  workerId: string | null;
  environment: string | null;
}

export interface BusinessDetail {
  fileType: string | null;
  expectedRecordCount: number | null;
  actualRecordCount: number | null;
  recordCountVariance: number | null;
  isFirstRunOfDay: boolean | null;
  filesReceivedTodayForCu: number | null;
  slaBreach: boolean | null;
  slaThresholdMs: number | null;
}

export interface ErrorDetail {
  status: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorStackTrace: string | null;
  failedStage: string | null;
  retryAttemptNumber: number | null;
  retryReason: string | null;
  isRecoverable: boolean | null;
}

export interface RunDetail {
  events: RunEvent[];
  stageDurations: StageDurations | null;
  validation: ValidationDetail | null;
  host: HostDetail | null;
  business: BusinessDetail | null;
  error: ErrorDetail | null;
}

// ─── CU Detail ───────────────────────────────────────────────────────────────

export interface CuSummary {
  cuId: string;
  adapterId: string | null;
  totalRuns: number;
  successRate: number;
  avgDurationMs: number | null;
  totalRowsProcessed: number;
  slaBreachCount: number;
  firstFileReceived: string | null;
  mostRecentFileReceived: string | null;
}

export interface DurationTrend {
  date: string;
  durationMs: number | null;
  slaThresholdMs: number | null;
}

export interface DailyVolume {
  date: string;
  fileCount: number;
  totalRows: number;
}

export interface ValidationTrend {
  date: string;
  schemaMatchScore: number | null;
}

export interface ErrorFrequency {
  errorCode: string;
  count: number;
}

// ─── Performance ─────────────────────────────────────────────────────────────

export interface StageDurationHeatmap {
  cuId: string;
  avgDownloadMs: number | null;
  avgProcessMs: number | null;
  avgPersistMs: number | null;
}

export interface ThroughputTrend {
  date: string;
  throughputRowsPerSec: number | null;
}

export interface SlowestRun {
  correlationId: string;
  cuId: string;
  blobName: string | null;
  totalProcessingDurationMs: number | null;
  startedAt: string;
}

export interface StageSplit {
  avgDownloadMs: number;
  avgProcessMs: number;
  avgPersistMs: number;
}

export interface MemoryTrend {
  timestamp: string;
  memoryUsedMb: number | null;
  hostName: string | null;
}

// ─── Schema Health ───────────────────────────────────────────────────────────

export interface SchemaHealthRow {
  cuId: string;
  latestSchemaMatchScore: number | null;
  lastValidationTime: string | null;
  trend: 'up' | 'down' | 'stable';
}

export interface ValidationFailure {
  correlationId: string;
  cuId: string;
  blobName: string | null;
  timestamp: string;
  errorCount: number | null;
  missingColumns: string | null;
  unknownColumns: string | null;
}

export interface SchemaDriftAlert {
  cuId: string;
  currentScore: number | null;
  avgScore30d: number | null;
  drop: number;
}

export interface ColumnAnomaly {
  columnName: string;
  anomalyType: 'missing' | 'unknown';
  occurrenceCount: number;
}

// ─── Alerts & SLA ────────────────────────────────────────────────────────────

export interface SlaSummary {
  totalRunsThisMonth: number;
  slaMetCount: number;
  slaMetPercent: number;
  slaBreachCount: number;
  slaBreachPercent: number;
  avgDurationMs: number | null;
  slaThresholdMs: number | null;
}

export interface SlaBreach {
  correlationId: string;
  cuId: string;
  blobName: string | null;
  durationMs: number | null;
  thresholdMs: number | null;
  overageMs: number | null;
  timestamp: string;
}

export interface ErrorSummary {
  errorCode: string;
  count: number;
  affectedCus: string;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface RetryRun {
  correlationId: string;
  cuId: string;
  blobName: string | null;
  retryAttemptNumber: number | null;
  failedStage: string | null;
  timestamp: string;
}

export interface FailedRun {
  correlationId: string;
  cuId: string;
  blobName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  isRecoverable: boolean | null;
  timestamp: string;
}

// ─── Filter types ─────────────────────────────────────────────────────────────

export interface RunFilters {
  cuId?: string;
  fileType?: string;
  from?: string;
  to?: string;
  slaBreach?: boolean;
  status?: string;
}
