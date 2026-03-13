/** @see MONITORING_SPEC.md Section 10 for interface definitions */

export type LifecycleState = 'Onboarding' | 'Ready for First Feed' | 'BAU';
export type HealthStatus = 'Healthy' | 'Overdue' | 'Failed' | 'Awaiting';
export type CoreBankingPlatform = 'Symitar' | 'Corelation' | 'Fiserv' | 'DNA' | string;
export type FeedStatus = 'Delivered' | 'Failed' | 'Partial' | 'InProgress';

// Maps to cfl.CU_Registry (+ derived fields)
export interface CuConfiguration {
  cuId: string;                          // CU_Registry.CU_ID
  cuName: string;                        // CU_Registry.CU_Name
  coreBankingPlatform: CoreBankingPlatform; // CU_Registry.CoreBankingSystem
  onboardingStatus: string;              // CU_Registry.OnboardingStatus
  activeMappingVersion: number | null;   // CU_Registry.ActiveMappingVersion
  assignedEngineer: string | null;       // CU_Registry.AssignedEngineer (new column)
  stateEnteredAt: string | null;         // CU_Registry.StateEnteredAt (new column)
  createdAt: string;                     // CU_Registry.CreatedAt
  // Derived on backend:
  lifecycleState: LifecycleState;
  daysInState: number;
}

export interface CuSchedule {
  cuId: string;
  nextFeedExpectedAt: string | null;
  frequencyDays: number;
  deliveryWindowMinutes: number;
}

export interface CuFleetRow extends CuConfiguration {
  lastFeedDeliveredAt: string | null;    // kafka.BatchJourneys.PublishedAt (latest)
  lastFeedCorrelationId: string | null;  // kafka.BatchJourneys.CorrelationId (latest)
  nextFeedExpectedAt: string | null;     // adapter.CU_Schedule.NextFeedExpectedAt
  lastFeedDurationMs: number | null;     // kafka.BatchJourneys.TotalDurationMs (latest)
  lastFeedMemberRecords: number | null;  // kafka.BatchJourneys.RecordsOut (latest)
  lastFeedRecordsRejected: number | null; // kafka.BatchJourneys.RecordsDropped (latest)
  healthStatus: HealthStatus;
}

export interface LifecycleCounts {
  onboarding: number;
  readyForFirstFeed: number;
  bau: number;
  total: number;
  overdueBau: number;
  overdueReady: number;
}

export interface GanttEntry {
  cuId: string;
  cuName: string;
  expectedWindowStart: string | null;   // adapter.CU_Schedule.NextFeedExpectedAt
  expectedWindowEnd: string | null;     // NextFeedExpectedAt + DeliveryWindowMinutes
  feeds: {
    feedReferenceId: string;            // kafka.BatchJourneys.CorrelationId
    startedAt: string;                  // kafka.BatchJourneys.IngestedAt
    deliveredAt: string | null;         // kafka.BatchJourneys.PublishedAt
    durationMs: number | null;          // kafka.BatchJourneys.TotalDurationMs
    status: FeedStatus;
    memberRecords: number | null;       // kafka.BatchJourneys.RecordsOut
  }[];
}

// Feed list row — from kafka.BatchJourneys JOIN cfl.CU_Registry
export interface FeedSummary {
  feedReferenceId: string;              // CorrelationId
  cuId: string;
  cuName: string;
  feedStarted: string;                  // IngestedAt
  feedDelivered: string | null;         // PublishedAt
  totalDurationMs: number | null;       // TotalDurationMs
  memberRecordsProcessed: number | null; // RecordsOut
  recordsRejected: number | null;       // RecordsDropped
  dataAlignmentScore: number | null;    // Derived from audit.PipelineValidationReports
  status: FeedStatus;
}
