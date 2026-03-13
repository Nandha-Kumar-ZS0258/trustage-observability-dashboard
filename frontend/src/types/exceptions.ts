/** @see MONITORING_SPEC.md Section 10 for interface definitions */

// Maps to kafka.DlqEvents (hard pipeline failures)
export interface FeedException {
  exceptionId: string;                  // kafka.DlqEvents.Id (as string)
  feedReferenceId: string;              // kafka.DlqEvents.CorrelationId
  cuId: string;                         // kafka.DlqEvents.CuId
  cuName: string;                       // joined from cfl.CU_Registry
  exceptionCode: string;                // derived from TopicName/StageName
  exceptionMessage: string;             // summarised from Payload JSON
  failedStep: string;                   // StageName mapped to step label (Section 4.4)
  retryCount: number;                   // always 3 for DLQ events (exhausted retries)
  rawPayload: string | null;            // kafka.DlqEvents.Payload — show collapsed
  resolvedFlag: boolean;                // kafka.DlqEvents.ResolvedFlag (new column)
  resolvedAt: string | null;
  resolvedById: string | null;
  ownerId: string | null;
  ownerNote: string | null;
  ownerNoteAt: string | null;
  firstOccurredAt: string;              // kafka.DlqEvents.OccurredAt
  recurrenceCount: number;              // kafka.DlqEvents.RecurrenceCount (new column)
}

export interface ExceptionSummary {
  totalAllTime: number;
  activeUnresolved: number;
  resolvedToday: number;
  recurringCount: number;
}

// Feed validation issue — from audit.PipelineValidationReports (soft failures)
export interface ValidationIssue {
  ingestionBatchId: string;
  feedReferenceId: string;              // joined from kafka.BatchJourneys.CorrelationId
  cuId: string;
  cuName: string;
  overallStatus: 'Passed' | 'PartiallyPassed' | 'Failed';
  gate1Passed: boolean;
  gate1ErrorCount: number;
  gate2Passed: boolean;
  gate2ErrorCount: number;
  gate3Passed: boolean;
  gate3ErrorCount: number;
  recordsRejected: number;              // DqBlocked
  warnings: number;                     // DqWarnings
  reportedAt: string;
}
