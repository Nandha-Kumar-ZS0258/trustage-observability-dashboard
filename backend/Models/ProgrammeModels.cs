using System.Text.Json.Serialization;

namespace TruStage.Observability.Api.Models.Programme;

// ─── Enums ────────────────────────────────────────────────────────────────────

/// <summary>CU partner lifecycle state — derived from OnboardingStatus + feed history.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum LifecycleState
{
    Onboarding,
    ReadyForFirstFeed,
    BAU
}

/// <summary>Feed delivery health for a CU partner in BAU state.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum HealthStatus
{
    Healthy,
    Overdue,
    Failed,
    Awaiting
}

// ─── CU Configuration ────────────────────────────────────────────────────────

/// <summary>
/// Maps to <c>cfl.CU_Registry</c> plus derived lifecycle fields.
/// Matches TypeScript <c>CuConfiguration</c> interface — see MONITORING_SPEC.md Section 10.
/// </summary>
public class CuConfigurationDto
{
    /// <summary>cfl.CU_Registry.CU_ID</summary>
    public string CuId { get; set; } = "";

    /// <summary>cfl.CU_Registry.CU_Name</summary>
    public string CuName { get; set; } = "";

    /// <summary>cfl.CU_Registry.CoreBankingSystem</summary>
    public string CoreBankingPlatform { get; set; } = "";

    /// <summary>cfl.CU_Registry.OnboardingStatus</summary>
    public string OnboardingStatus { get; set; } = "";

    /// <summary>cfl.CU_Registry.ActiveMappingVersion</summary>
    public int? ActiveMappingVersion { get; set; }

    /// <summary>cfl.CU_Registry.AssignedEngineer (new column — Migration 001)</summary>
    public string? AssignedEngineer { get; set; }

    /// <summary>cfl.CU_Registry.StateEnteredAt (new column — Migration 001)</summary>
    public DateTimeOffset? StateEnteredAt { get; set; }

    /// <summary>cfl.CU_Registry.CreatedAt</summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Derived on backend from OnboardingStatus + kafka.BatchJourneys history.</summary>
    public LifecycleState LifecycleState { get; set; }

    /// <summary>Number of calendar days the CU has been in its current lifecycle state.</summary>
    public int DaysInState { get; set; }
}

// ─── CU Fleet Row ─────────────────────────────────────────────────────────────

/// <summary>
/// Extends <see cref="CuConfigurationDto"/> with latest feed delivery metrics.
/// Matches TypeScript <c>CuFleetRow</c> interface — see MONITORING_SPEC.md Section 10.
/// </summary>
public class CuFleetRowDto : CuConfigurationDto
{
    /// <summary>kafka.BatchJourneys.PublishedAt (most recent completed feed)</summary>
    public DateTimeOffset? LastFeedDeliveredAt { get; set; }

    /// <summary>kafka.BatchJourneys.CorrelationId (most recent feed)</summary>
    public string? LastFeedCorrelationId { get; set; }

    /// <summary>adapter.CU_Schedule.NextFeedExpectedAt</summary>
    public DateTimeOffset? NextFeedExpectedAt { get; set; }

    /// <summary>kafka.BatchJourneys.TotalDurationMs (most recent feed)</summary>
    public long? LastFeedDurationMs { get; set; }

    /// <summary>kafka.BatchJourneys.RecordsOut (most recent feed)</summary>
    public int? LastFeedMemberRecords { get; set; }

    /// <summary>kafka.BatchJourneys.RecordsDropped (most recent feed)</summary>
    public int? LastFeedRecordsRejected { get; set; }

    /// <summary>Derived health classification for this CU partner.</summary>
    public HealthStatus HealthStatus { get; set; }
}

// ─── Lifecycle Counts ─────────────────────────────────────────────────────────

/// <summary>
/// Aggregate counts across the CU partner fleet by lifecycle state.
/// Matches TypeScript <c>LifecycleCounts</c> interface — see MONITORING_SPEC.md Section 10.
/// </summary>
public class LifecycleCountsDto
{
    /// <summary>CU partners in Onboarding state.</summary>
    public int Onboarding { get; set; }

    /// <summary>CU partners in Ready for First Feed state.</summary>
    public int ReadyForFirstFeed { get; set; }

    /// <summary>CU partners in BAU state.</summary>
    public int Bau { get; set; }

    /// <summary>Total registered CU partners.</summary>
    public int Total { get; set; }

    /// <summary>BAU partners with no feed delivered in the expected window.</summary>
    public int OverdueBau { get; set; }

    /// <summary>Ready-for-first-feed partners waiting longer than the staleness threshold.</summary>
    public int OverdueReady { get; set; }
}

// ─── Lifecycle Panel Note ─────────────────────────────────────────────────────

/// <summary>
/// Request body for <c>POST /api/programme/lifecycle-panel/note</c>.
/// Persists a free-text note (and optional owner assignment) for a CU partner
/// from one of the lifecycle drill-down panels.
/// </summary>
public class LifecyclePanelNoteRequest
{
    /// <summary>cfl.CU_Registry.CU_ID of the target CU partner.</summary>
    public string CuId { get; set; } = "";

    /// <summary>Free-text note entered by the operator.</summary>
    public string Note { get; set; } = "";

    /// <summary>Full name of the team member being assigned as owner (may be empty).</summary>
    public string OwnerId { get; set; } = "";
}

// ─── Gantt ────────────────────────────────────────────────────────────────────

/// <summary>
/// A single feed event within a <see cref="GanttEntryDto"/> track.
/// Matches the inline <c>feeds[]</c> member of the TypeScript <c>GanttEntry</c> interface.
/// </summary>
public class GanttFeedDto
{
    /// <summary>kafka.BatchJourneys.CorrelationId</summary>
    public string FeedReferenceId { get; set; } = "";

    /// <summary>kafka.BatchJourneys.IngestedAt</summary>
    public DateTimeOffset StartedAt { get; set; }

    /// <summary>kafka.BatchJourneys.PublishedAt</summary>
    public DateTimeOffset? DeliveredAt { get; set; }

    /// <summary>kafka.BatchJourneys.TotalDurationMs</summary>
    public long? DurationMs { get; set; }

    /// <summary>Derived feed status: Delivered | Failed | Partial | InProgress</summary>
    public string Status { get; set; } = "";

    /// <summary>kafka.BatchJourneys.RecordsOut</summary>
    public int? MemberRecords { get; set; }
}

/// <summary>
/// One row in the Today's Feeds Gantt chart — one entry per BAU CU partner.
/// Matches TypeScript <c>GanttEntry</c> interface — see MONITORING_SPEC.md Section 10.
/// </summary>
public class GanttEntryDto
{
    /// <summary>cfl.CU_Registry.CU_ID</summary>
    public string CuId { get; set; } = "";

    /// <summary>cfl.CU_Registry.CU_Name</summary>
    public string CuName { get; set; } = "";

    /// <summary>adapter.CU_Schedule.NextFeedExpectedAt</summary>
    public DateTimeOffset? ExpectedWindowStart { get; set; }

    /// <summary>NextFeedExpectedAt + adapter.CU_Schedule.DeliveryWindowMinutes</summary>
    public DateTimeOffset? ExpectedWindowEnd { get; set; }

    /// <summary>All feeds delivered (or in progress) for this CU today.</summary>
    public List<GanttFeedDto> Feeds { get; set; } = [];
}
