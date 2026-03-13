export type PipelineStage =
  | 'blob'
  | 'ingestion'
  | 'transform'
  | 'schemaValidation'
  | 'rulesValidation'
  | 'publishing';

export type StageStatus = 'pending' | 'running' | 'pass' | 'warn' | 'fail';

export interface PipelineLogEvent {
  stage: PipelineStage | 'system';
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface DemoUploadResult {
  blobName: string;
  containerPath: string;
  uploadedAt: string;
}

export interface StageInfo {
  id: PipelineStage;
  label: string;
  status: StageStatus;
  keyMetric?: string;
  logs: PipelineLogEvent[];
}

export interface DemoSummary {
  submitted: number;
  ingested: number;
  blocked: number;
  warnings: number;
}
