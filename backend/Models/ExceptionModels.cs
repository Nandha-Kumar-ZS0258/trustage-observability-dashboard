using System.Text.Json.Serialization;

namespace TruStage.Observability.Api.Models.Exceptions;

// ─── Feed Exception ───────────────────────────────────────────────────────────

/// <summary>
/// Maps to <c>kafka.DlqEvents</c> — hard pipeline failures that exhausted all retries.
/// Matches TypeScript <c>FeedException</c> interface — see MONITORING_SPEC.md Section 10.
/// </summary>
public class FeedExceptionDto
{
    /// <summary>kafka.DlqEvents.Id (serialised as string)</summary>
    public string ExceptionId { get; set; } = "";

    /// <summary>kafka.DlqEvents.CorrelationId</summary>
    public string FeedReferenceId { get; set; } = "";

    /// <summary>kafka.DlqEvents.CuId</summary>
    public string CuId { get; set; } = "";

    /// <summary>Joined from cfl.CU_Registry.CU_Name</summary>
    public string CuName { get; set; } = "";

    /// <summary>Derived from kafka.DlqEvents.TopicName / StageName</summary>
    public string ExceptionCode { get; set; } = "";

    /// <summary>Summarised from kafka.DlqEvents.Payload JSON</summary>
    public string ExceptionMessage { get; set; } = "";

    /// <summary>kafka.DlqEvents.StageName mapped to step label (MONITORING_SPEC.md Section 4.4)</summary>
    public string FailedStep { get; set; } = "";

    /// <summary>Always 3 for DLQ events — all retries were exhausted before routing here.</summary>
    public int RetryCount { get; set; }

    /// <summary>kafka.DlqEvents.Payload — display collapsed in UI.</summary>
    public string? RawPayload { get; set; }

    /// <summary>kafka.DlqEvents.ResolvedFlag (new column — Migration 003)</summary>
    public bool ResolvedFlag { get; set; }

    /// <summary>kafka.DlqEvents.ResolvedAt (new column — Migration 003)</summary>
    public DateTimeOffset? ResolvedAt { get; set; }

    /// <summary>kafka.DlqEvents.ResolvedById (new column — Migration 003)</summary>
    public string? ResolvedById { get; set; }

    /// <summary>kafka.DlqEvents.OwnerId (new column — Migration 003)</summary>
    public string? OwnerId { get; set; }

    /// <summary>kafka.DlqEvents.OwnerNote (new column — Migration 003)</summary>
    public string? OwnerNote { get; set; }

    /// <summary>kafka.DlqEvents.OwnerNoteAt (new column — Migration 003)</summary>
    public DateTimeOffset? OwnerNoteAt { get; set; }

    /// <summary>kafka.DlqEvents.OccurredAt</summary>
    public DateTimeOffset FirstOccurredAt { get; set; }

    /// <summary>kafka.DlqEvents.RecurrenceCount (new column — Migration 003)</summary>
    public int RecurrenceCount { get; set; }
}

// ─── Exception Summary ────────────────────────────────────────────────────────

/// <summary>
/// Aggregate exception counts for the Feed Exceptions tab KPI cards.
/// Matches TypeScript <c>ExceptionSummary</c> interface — see MONITORING_SPEC.md Section 10.
/// </summary>
public class ExceptionSummaryDto
{
    /// <summary>Total DLQ events ever recorded.</summary>
    public int TotalAllTime { get; set; }

    /// <summary>DLQ events where ResolvedFlag = false.</summary>
    public int ActiveUnresolved { get; set; }

    /// <summary>DLQ events resolved today (ResolvedAt within current UTC day).</summary>
    public int ResolvedToday { get; set; }

    /// <summary>DLQ events where RecurrenceCount > 1.</summary>
    public int RecurringCount { get; set; }
}

// ─── Patch Requests ───────────────────────────────────────────────────────────

/// <summary>Request body for PATCH /api/exceptions/{id}/owner</summary>
public class PatchOwnerRequest
{
    /// <summary>kafka.DlqEvents.OwnerId — identifier of the engineer taking ownership.</summary>
    public string OwnerId { get; set; } = "";
}

/// <summary>Request body for PATCH /api/exceptions/{id}/note</summary>
public class PatchNoteRequest
{
    /// <summary>kafka.DlqEvents.OwnerNote — free-text investigation note.</summary>
    public string Note { get; set; } = "";
}
