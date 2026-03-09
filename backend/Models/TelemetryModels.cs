namespace TruStage.Observability.Api.Models;

// ─── Overview ────────────────────────────────────────────────────────────────

public class OverviewKpiDto
{
    public int TotalRuns { get; set; }
    public double SuccessRate { get; set; }
    public int SlaBreachesToday { get; set; }
    public int ActiveCus { get; set; }
}

public class LiveFeedEventDto
{
    public Guid EventId { get; set; }
    public string EventType { get; set; } = "";
    public string CuId { get; set; } = "";
    public string? BlobName { get; set; }
    public DateTimeOffset Timestamp { get; set; }
    public int? TotalProcessingDurationMs { get; set; }
    public string Status { get; set; } = "success";
}

public class CuHealthCardDto
{
    public string CuId { get; set; } = "";
    public DateTimeOffset? LastRunTime { get; set; }
    public string LastRunStatus { get; set; } = "success";
    public int FilesToday { get; set; }
    public long RowsToday { get; set; }
    public bool SlaBreached { get; set; }
}

public class TimelinePointDto
{
    public string CuId { get; set; } = "";
    public DateTimeOffset StartTime { get; set; }
    public string Status { get; set; } = "success";
}

public class HourlyRowsDto
{
    public int Hour { get; set; }
    public long TotalRows { get; set; }
}

// ─── Run Explorer ─────────────────────────────────────────────────────────────

public class RunSummaryDto
{
    public Guid CorrelationId { get; set; }
    public string CuId { get; set; } = "";
    public string? BlobName { get; set; }
    public string? FileType { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public int? TotalProcessingDurationMs { get; set; }
    public int? RowsProcessed { get; set; }
    public int? RowsFailed { get; set; }
    public bool? ValidationPassed { get; set; }
    public bool? SlaBreach { get; set; }
}

public class RunDetailDto
{
    public IEnumerable<RunEventDto> Events { get; set; } = [];
    public StageDurationsDto? StageDurations { get; set; }
    public ValidationDetailDto? Validation { get; set; }
    public HostDetailDto? Host { get; set; }
    public BusinessDetailDto? Business { get; set; }
    public ErrorDetailDto? Error { get; set; }
}

public class RunEventDto
{
    public Guid EventId { get; set; }
    public string EventType { get; set; } = "";
    public string Stage { get; set; } = "";
    public DateTimeOffset Timestamp { get; set; }
    public string? BlobName { get; set; }
    public string? HostName { get; set; }
    public double? MemoryUsedMb { get; set; }
    public double? SchemaMatchScore { get; set; }
    public int? ValidationErrors { get; set; }
    public int? RowsProcessed { get; set; }
    public int? TotalDurationMs { get; set; }
}

public class StageDurationsDto
{
    public int? Download { get; set; }
    public int? Process { get; set; }
    public int? Persist { get; set; }
    public int? Total { get; set; }
}

public class ValidationDetailDto
{
    public bool ValidationPassed { get; set; }
    public int? ErrorsCount { get; set; }
    public int? WarningsCount { get; set; }
    public double? SchemaMatchScore { get; set; }
    public string? MissingRequiredColumns { get; set; }
    public string? UnknownColumnsDetected { get; set; }
    public int? DataTypeMismatchCount { get; set; }
    public int? NullViolations { get; set; }
}

public class HostDetailDto
{
    public string? HostName { get; set; }
    public int? ProcessId { get; set; }
    public double? CpuUsagePercent { get; set; }
    public double? MemoryUsedMb { get; set; }
    public int? ThreadId { get; set; }
    public string? WorkerId { get; set; }
    public string? Environment { get; set; }
}

public class BusinessDetailDto
{
    public string? FileType { get; set; }
    public int? ExpectedRecordCount { get; set; }
    public int? ActualRecordCount { get; set; }
    public int? RecordCountVariance { get; set; }
    public bool? IsFirstRunOfDay { get; set; }
    public int? FilesReceivedTodayForCu { get; set; }
    public bool? SlaBreach { get; set; }
    public int? SlaThresholdMs { get; set; }
}

public class ErrorDetailDto
{
    public string? Status { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorStackTrace { get; set; }
    public string? FailedStage { get; set; }
    public int? RetryAttemptNumber { get; set; }
    public string? RetryReason { get; set; }
    public bool? IsRecoverable { get; set; }
}

// ─── CU Detail ───────────────────────────────────────────────────────────────

public class CuSummaryDto
{
    public string CuId { get; set; } = "";
    public string? AdapterId { get; set; }
    public int TotalRuns { get; set; }
    public double SuccessRate { get; set; }
    public double? AvgDurationMs { get; set; }
    public long TotalRowsProcessed { get; set; }
    public int SlaBreachCount { get; set; }
    public DateTimeOffset? FirstFileReceived { get; set; }
    public DateTimeOffset? MostRecentFileReceived { get; set; }
}

public class DurationTrendDto
{
    public DateTimeOffset Date { get; set; }
    public int? DurationMs { get; set; }
    public int? SlaThresholdMs { get; set; }
}

public class DailyVolumeDto
{
    public DateOnly Date { get; set; }
    public int FileCount { get; set; }
    public long TotalRows { get; set; }
}

public class ValidationTrendDto
{
    public DateTimeOffset Date { get; set; }
    public double? SchemaMatchScore { get; set; }
}

public class ErrorFrequencyDto
{
    public string ErrorCode { get; set; } = "";
    public int Count { get; set; }
}

// ─── Performance ─────────────────────────────────────────────────────────────

public class StageDurationHeatmapDto
{
    public string CuId { get; set; } = "";
    public double? AvgDownloadMs { get; set; }
    public double? AvgProcessMs { get; set; }
    public double? AvgPersistMs { get; set; }
}

public class ThroughputTrendDto
{
    public DateTimeOffset Date { get; set; }
    public double? ThroughputRowsPerSec { get; set; }
}

public class SlowestRunDto
{
    public Guid CorrelationId { get; set; }
    public string CuId { get; set; } = "";
    public string? BlobName { get; set; }
    public int? TotalProcessingDurationMs { get; set; }
    public DateTimeOffset StartedAt { get; set; }
}

public class StageSplitDto
{
    public double AvgDownloadMs { get; set; }
    public double AvgProcessMs { get; set; }
    public double AvgPersistMs { get; set; }
}

public class MemoryTrendDto
{
    public DateTimeOffset Timestamp { get; set; }
    public double? MemoryUsedMb { get; set; }
    public string? HostName { get; set; }
}

// ─── Schema Health ───────────────────────────────────────────────────────────

public class SchemaHealthRowDto
{
    public string CuId { get; set; } = "";
    public double? LatestSchemaMatchScore { get; set; }
    public DateTimeOffset? LastValidationTime { get; set; }
    public string Trend { get; set; } = "stable";
}

public class ValidationFailureDto
{
    public Guid CorrelationId { get; set; }
    public string CuId { get; set; } = "";
    public string? BlobName { get; set; }
    public DateTimeOffset Timestamp { get; set; }
    public int? ErrorCount { get; set; }
    public string? MissingColumns { get; set; }
    public string? UnknownColumns { get; set; }
}

public class SchemaDriftAlertDto
{
    public string CuId { get; set; } = "";
    public double? CurrentScore { get; set; }
    public double? AvgScore30d { get; set; }
    public double Drop { get; set; }
}

public class ColumnAnomalyDto
{
    public string ColumnName { get; set; } = "";
    public string AnomalyType { get; set; } = "";
    public int OccurrenceCount { get; set; }
}

// ─── Alerts & SLA ────────────────────────────────────────────────────────────

public class SlaSummaryDto
{
    public int TotalRunsThisMonth { get; set; }
    public int SlaMetCount { get; set; }
    public double SlaMetPercent { get; set; }
    public int SlaBreachCount { get; set; }
    public double SlaBreachPercent { get; set; }
    public double? AvgDurationMs { get; set; }
    public int? SlaThresholdMs { get; set; }
}

public class SlaBreachDto
{
    public Guid CorrelationId { get; set; }
    public string CuId { get; set; } = "";
    public string? BlobName { get; set; }
    public int? DurationMs { get; set; }
    public int? ThresholdMs { get; set; }
    public int? OverageMs { get; set; }
    public DateTimeOffset Timestamp { get; set; }
}

public class ErrorSummaryDto
{
    public string ErrorCode { get; set; } = "";
    public int Count { get; set; }
    public string AffectedCus { get; set; } = "";
    public DateTimeOffset? FirstSeen { get; set; }
    public DateTimeOffset? LastSeen { get; set; }
}

public class RetryRunDto
{
    public Guid CorrelationId { get; set; }
    public string CuId { get; set; } = "";
    public string? BlobName { get; set; }
    public int? RetryAttemptNumber { get; set; }
    public string? FailedStage { get; set; }
    public DateTimeOffset Timestamp { get; set; }
}

public class FailedRunDto
{
    public Guid CorrelationId { get; set; }
    public string CuId { get; set; } = "";
    public string? BlobName { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public bool? IsRecoverable { get; set; }
    public DateTimeOffset Timestamp { get; set; }
}

// ─── Filters ─────────────────────────────────────────────────────────────────

public class RunFilters
{
    public string? CuId { get; set; }
    public string? FileType { get; set; }
    public DateTimeOffset? From { get; set; }
    public DateTimeOffset? To { get; set; }
    public bool? SlaBreach { get; set; }
    public string? Status { get; set; }
}

// ─── CU Setup & Configuration ─────────────────────────────────────────────────

public class CuSetupKpiDto
{
    public int TotalCus { get; set; }
    public int ActiveCount { get; set; }
    public int OnboardingCount { get; set; }
    public int InactiveCount { get; set; }
}

public class CuConfigurationDto
{
    public string CuId { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string AdapterId { get; set; } = "";
    public string ContainerName { get; set; } = "";
    public string? FileTypes { get; set; }
    public int SlaThresholdMs { get; set; }
    public string? MappingVersion { get; set; }
    public string Environment { get; set; } = "";
    public DateOnly OnboardingDate { get; set; }
    public string OnboardingStatus { get; set; } = "";
    public string? OwnerTeam { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset? FirstRunAt { get; set; }
    public bool HasDrift { get; set; }
}

public class CuDriftRowDto
{
    public string CuId { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Field { get; set; } = "";
    public string Configured { get; set; } = "";
    public string? Observed { get; set; }
    public bool IsDrift { get; set; }
}

public class OnboardingMonthDto
{
    public string Month { get; set; } = "";
    public int Count { get; set; }
}

public class AdapterSpreadDto
{
    public string AdapterId { get; set; } = "";
    public int Count { get; set; }
}

public class MappingSpreadDto
{
    public string MappingVersion { get; set; } = "";
    public int Count { get; set; }
}

public class FirstDeliveryGapDto
{
    public string DisplayName { get; set; } = "";
    public string CuId { get; set; } = "";
    public int? GapDays { get; set; }
    public string OnboardingStatus { get; set; } = "";
}

public class OwnerTeamDto
{
    public string OwnerTeam { get; set; } = "";
    public int TotalCus { get; set; }
    public int ActiveCount { get; set; }
    public int OnboardingCount { get; set; }
    public double? AvgSuccessRate { get; set; }
}

public class CuDirectoryFilters
{
    public string? Status { get; set; }
    public string? Environment { get; set; }
    public string? OwnerTeam { get; set; }
    public string? AdapterId { get; set; }
}
