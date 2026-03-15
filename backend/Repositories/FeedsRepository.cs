using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using TruStage.Observability.Api.Models.Programme;

namespace TruStage.Observability.Api.Repositories;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/// <summary>KPI summary for the Today's Feeds tab header cards.</summary>
public class TodaySummaryDto
{
    /// <summary>Total feeds received today (all statuses).</summary>
    public int FeedsToday { get; set; }

    /// <summary>Percentage of today's feeds with FinalStatus = Completed.</summary>
    public double SuccessRate { get; set; }

    /// <summary>Count of unresolved exceptions across all time (sidebar badge source).</summary>
    public int ActiveExceptions { get; set; }

    /// <summary>Distinct CU partners with at least one completed feed today.</summary>
    public int ActiveBauCus { get; set; }
}

/// <summary>
/// One row in the Feed History / Today's Feeds list table.
/// Maps to <c>kafka.BatchJourneys</c> JOIN <c>cfl.CU_Registry</c>.
/// </summary>
public class FeedSummaryDto
{
    /// <summary>kafka.BatchJourneys.CorrelationId</summary>
    public string FeedReferenceId { get; set; } = "";

    /// <summary>kafka.BatchJourneys.CuId</summary>
    public string CuId { get; set; } = "";

    /// <summary>cfl.CU_Registry.CU_Name</summary>
    public string CuName { get; set; } = "";

    /// <summary>kafka.BatchJourneys.IngestedAt</summary>
    public DateTimeOffset FeedStarted { get; set; }

    /// <summary>kafka.BatchJourneys.PublishedAt</summary>
    public DateTimeOffset? FeedDelivered { get; set; }

    /// <summary>kafka.BatchJourneys.TotalDurationMs</summary>
    public long? TotalDurationMs { get; set; }

    /// <summary>kafka.BatchJourneys.RecordsOut</summary>
    public int? MemberRecordsProcessed { get; set; }

    /// <summary>kafka.BatchJourneys.RecordsDropped</summary>
    public int? RecordsRejected { get; set; }

    /// <summary>Derived: (ProdMemberCount / SourceMemberCount) * 100 from audit.PipelineValidationReports.</summary>
    public double? DataAlignmentScore { get; set; }

    /// <summary>Derived from FinalStatus + RecordsDropped per MONITORING_SPEC.md Section 4.3.</summary>
    public string Status { get; set; } = "";
}

/// <summary>Filters for <see cref="FeedsRepository.GetFeedListAsync"/>.</summary>
public class FeedListFilters
{
    public string? CuId   { get; set; }
    public DateTimeOffset? From   { get; set; }
    public DateTimeOffset? To     { get; set; }
    public string? Status { get; set; }
    public string? Search { get; set; }
}

/// <summary>One step in the Feed Detail panel Step Timeline tab.</summary>
public class StepTimelineItemDto
{
    /// <summary>kafka.PipelineStageTimings.StageName (raw DB value — map to step label at API layer).</summary>
    public string StageName { get; set; } = "";

    /// <summary>kafka.PipelineStageTimings.StartedAt</summary>
    public DateTimeOffset StartedAt { get; set; }

    /// <summary>kafka.PipelineStageTimings.CompletedAt</summary>
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>kafka.PipelineStageTimings.DurationMs</summary>
    public long? DurationMs { get; set; }
}

/// <summary>Data Validation gate results from <c>audit.PipelineValidationReports</c>.</summary>
public class ValidationReportDto
{
    public string OverallStatus   { get; set; } = "";
    public bool   Gate1Passed     { get; set; }
    public int    Gate1ErrorCount { get; set; }
    public bool   Gate2Passed     { get; set; }
    public int    Gate2ErrorCount { get; set; }
    public bool   Gate3Passed     { get; set; }
    public int    Gate3ErrorCount { get; set; }
    public int?   SourceMemberCount  { get; set; }
    public int?   ProdMemberCount    { get; set; }
    public int?   SourceAccountCount { get; set; }
    public int?   ProdAccountCount   { get; set; }
    public int?   SourceLoanCount    { get; set; }
    public int?   ProdLoanCount      { get; set; }
    public int    DqBlocked   { get; set; }
    public int    DqWarnings  { get; set; }

    /// <summary>Derived: (ProdMemberCount / SourceMemberCount) * 100, capped at 100.</summary>
    public double? DataAlignmentScore { get; set; }

    /// <summary>Full JSON of all gate results — for field-level error display.</summary>
    public string? GateDetailsJson { get; set; }
}

/// <summary>Summary tab data in the Feed Detail panel.</summary>
public class FeedDetailSummaryDto
{
    public string         FeedReferenceId       { get; set; } = "";
    public string         CuId                  { get; set; } = "";
    public string         CuName                { get; set; } = "";
    public string?        BlobName              { get; set; }
    public DateTimeOffset FeedReceived          { get; set; }
    public DateTimeOffset? FeedDelivered        { get; set; }
    public long?          TotalDurationMs       { get; set; }
    public int?           MemberRecordsProcessed { get; set; }
    public int?           RecordsRejected       { get; set; }
    public string         Status                { get; set; } = "";
    public string?        MappingVersion        { get; set; }
    public string?        RunType               { get; set; }
    public DateTimeOffset? NextFeedExpectedAt   { get; set; }

    /// <summary>True if FeedDelivered arrived before or on NextFeedExpectedAt + DeliveryWindowMinutes.</summary>
    public bool? OnTime { get; set; }
}

/// <summary>
/// Composite feed detail returned by the Feed Detail slide-over panel.
/// Assembled from four separate queries across kafka.*, audit.*, and adapter.*.
/// </summary>
public class FeedDetailDto
{
    public FeedDetailSummaryDto             Summary          { get; set; } = new();
    public List<StepTimelineItemDto>        StepTimeline     { get; set; } = [];
    public ValidationReportDto?             ValidationReport { get; set; }
}

// Private subclass adds CuId for grouping in GetGanttDataAsync — not exposed in GanttFeedDto.
file sealed class GanttFeedRow : GanttFeedDto
{
    public string CuId { get; set; } = "";
}

// ─── Repository ───────────────────────────────────────────────────────────────

/// <summary>
/// Queries feed delivery data from <c>kafka.BatchJourneys</c> and related tables.
/// All queries target kafka.*, audit.*, cfl.*, adapter.* schemas only.
/// </summary>
public class FeedsRepository(IConfiguration config)
{
    private IDbConnection Connect() =>
        new SqlConnection(config.GetConnectionString("TruStage"));

    // ─── Today Summary ────────────────────────────────────────────────────────

    /// <summary>
    /// Returns KPI counts for the Today's Feeds header cards.
    /// Sources: <c>kafka.BatchJourneys</c> (today) + <c>kafka.DlqEvents</c> (all time unresolved).
    /// </summary>
    public async Task<TodaySummaryDto> GetTodaySummaryAsync()
    {
        const string feedsSql = """
            SELECT
                COUNT(*)                                                                 AS FeedsToday,
                ISNULL(
                    SUM(CASE WHEN FinalStatus = 'Completed' THEN 1 ELSE 0 END)
                    * 100.0 / NULLIF(COUNT(*), 0), 0)                                   AS SuccessRate,
                COUNT(DISTINCT CASE WHEN FinalStatus = 'Completed' THEN CuId END)       AS ActiveBauCus
            FROM kafka.BatchJourneys
            WHERE CAST(IngestedAt AS DATE) = CAST(GETUTCDATE() AS DATE);
            """;

        const string excSql = """
            SELECT COUNT(*) FROM kafka.DlqEvents WHERE ResolvedFlag = 0;
            """;

        using var db = Connect();
        var feeds = await db.QuerySingleAsync<dynamic>(feedsSql);
        var excCount = await db.ExecuteScalarAsync<int>(excSql);

        return new TodaySummaryDto
        {
            FeedsToday       = (int)(feeds.FeedsToday   ?? 0),
            SuccessRate      = (double)(feeds.SuccessRate ?? 0),
            ActiveBauCus     = (int)(feeds.ActiveBauCus  ?? 0),
            ActiveExceptions = excCount
        };
    }

    // ─── Gantt ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns one <see cref="GanttEntryDto"/> per BAU CU partner with today's feed bars
    /// and expected delivery windows.
    /// Sources: <c>cfl.CU_Registry</c>, <c>adapter.CU_Schedule</c>, <c>kafka.BatchJourneys</c>.
    /// </summary>
    public async Task<IEnumerable<GanttEntryDto>> GetGanttDataAsync()
    {
        const string cusSql = """
            SELECT
                r.CU_ID     AS CuId,
                r.CU_Name   AS CuName,
                s.NextFeedExpectedAt AS ExpectedWindowStart,
                CASE
                    WHEN s.NextFeedExpectedAt IS NOT NULL
                    THEN DATEADD(minute, ISNULL(s.DeliveryWindowMinutes, 120), s.NextFeedExpectedAt)
                    ELSE NULL
                END AS ExpectedWindowEnd
            FROM cfl.CU_Registry r
            LEFT JOIN adapter.CU_Schedule s ON s.CuId = r.CU_ID
            WHERE r.OnboardingStatus = 'Active'
              AND EXISTS (
                    SELECT 1 FROM kafka.BatchJourneys bj
                    WHERE bj.CuId = r.CU_ID AND bj.FinalStatus = 'Completed'
              )
            ORDER BY r.CU_Name;
            """;

        const string feedsSql = """
            SELECT
                CAST(bj.CorrelationId AS nvarchar(50)) AS FeedReferenceId,
                bj.CuId             AS CuId,
                bj.IngestedAt       AS StartedAt,
                bj.PublishedAt      AS DeliveredAt,
                bj.TotalDurationMs  AS DurationMs,
                bj.RecordsOut       AS MemberRecords,
                CASE
                    WHEN bj.FinalStatus = 'Completed' AND bj.RecordsDropped = 0 THEN 'Delivered'
                    WHEN bj.FinalStatus = 'Completed' AND bj.RecordsDropped > 0 THEN 'Partial'
                    WHEN bj.FinalStatus = 'Failed'                               THEN 'Failed'
                    ELSE 'InProgress'
                END AS Status
            FROM kafka.BatchJourneys bj
            WHERE CAST(bj.IngestedAt AS DATE) = CAST(GETUTCDATE() AS DATE)
            ORDER BY bj.CuId, bj.IngestedAt;
            """;

        using var db = Connect();
        var cus   = (await db.QueryAsync<GanttEntryDto>(cusSql)).ToList();
        var feeds = (await db.QueryAsync<GanttFeedRow>(feedsSql)).ToList();

        // Assemble nested feeds into each CU entry
        var feedsByCu = feeds.GroupBy(f => f.CuId)
                             .ToDictionary(g => g.Key, g => g.Cast<GanttFeedDto>().ToList());

        foreach (var cu in cus)
        {
            if (feedsByCu.TryGetValue(cu.CuId, out var cuFeeds))
                cu.Feeds = cuFeeds;
        }

        return cus;
    }

    // ─── Feed List ────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns a filtered list of feeds for the Feed History tab.
    /// Sources: <c>kafka.BatchJourneys</c> JOIN <c>cfl.CU_Registry</c>
    /// LEFT JOIN <c>audit.PipelineValidationReports</c>.
    /// </summary>
    public async Task<IEnumerable<FeedSummaryDto>> GetFeedListAsync(FeedListFilters filters)
    {
        const string sql = """
            SELECT
                CAST(bj.CorrelationId AS nvarchar(50)) AS FeedReferenceId,
                bj.CuId,
                r.CU_Name           AS CuName,
                bj.IngestedAt       AS FeedStarted,
                bj.PublishedAt      AS FeedDelivered,
                bj.TotalDurationMs,
                bj.RecordsOut       AS MemberRecordsProcessed,
                bj.RecordsDropped   AS RecordsRejected,
                CASE
                    WHEN pvr.SourceMemberCount > 0
                    THEN CAST(pvr.ProdMemberCount AS FLOAT) / pvr.SourceMemberCount * 100.0
                    ELSE NULL
                END                 AS DataAlignmentScore,
                CASE
                    WHEN bj.FinalStatus = 'Completed' AND bj.RecordsDropped = 0 THEN 'Delivered'
                    WHEN bj.FinalStatus = 'Completed' AND bj.RecordsDropped > 0 THEN 'Partial'
                    WHEN bj.FinalStatus = 'Failed'                               THEN 'Failed'
                    ELSE 'InProgress'
                END                 AS Status
            FROM kafka.BatchJourneys bj
            JOIN  cfl.CU_Registry r             ON r.CU_ID = bj.CuId
            LEFT JOIN audit.IngestionBatches ib  ON ib.CU_ID = bj.CuId
                                                AND ABS(DATEDIFF(second, bj.IngestedAt, ib.StartedAt)) < 10
            LEFT JOIN audit.PipelineValidationReports pvr
                                                ON pvr.IngestionBatchId = ib.IngestionBatchId
            WHERE (@CuId   IS NULL OR bj.CuId        = @CuId)
              AND (@From   IS NULL OR bj.IngestedAt  >= @From)
              AND (@To     IS NULL OR bj.IngestedAt  <= @To)
              AND (@Status IS NULL OR
                    CASE
                        WHEN bj.FinalStatus = 'Completed' AND bj.RecordsDropped = 0 THEN 'Delivered'
                        WHEN bj.FinalStatus = 'Completed' AND bj.RecordsDropped > 0 THEN 'Partial'
                        WHEN bj.FinalStatus = 'Failed'                               THEN 'Failed'
                        ELSE 'InProgress'
                    END = @Status)
              AND (@Search IS NULL OR r.CU_Name    LIKE '%' + @Search + '%'
                                   OR bj.BlobName  LIKE '%' + @Search + '%')
            ORDER BY bj.IngestedAt DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<FeedSummaryDto>(sql, new
        {
            filters.CuId,
            filters.From,
            filters.To,
            filters.Status,
            filters.Search
        });
    }

    // ─── Feed Detail ──────────────────────────────────────────────────────────

    /// <summary>
    /// Returns the complete feed detail panel data for a given Feed Reference ID.
    /// Assembles four queries: BatchJourneys summary, PipelineStageTimings,
    /// PipelineValidationReports, and IngestionBatches.
    /// </summary>
    public async Task<FeedDetailDto?> GetFeedDetailAsync(string feedReferenceId)
    {
        const string summarySql = """
            SELECT
                CAST(bj.CorrelationId AS nvarchar(50)) AS FeedReferenceId,
                bj.CuId,
                r.CU_Name               AS CuName,
                bj.BlobName,
                bj.IngestedAt           AS FeedReceived,
                bj.PublishedAt          AS FeedDelivered,
                bj.TotalDurationMs,
                bj.RecordsOut           AS MemberRecordsProcessed,
                bj.RecordsDropped       AS RecordsRejected,
                CASE
                    WHEN bj.FinalStatus = 'Completed' AND bj.RecordsDropped = 0 THEN 'Delivered'
                    WHEN bj.FinalStatus = 'Completed' AND bj.RecordsDropped > 0 THEN 'Partial'
                    WHEN bj.FinalStatus = 'Failed'                               THEN 'Failed'
                    ELSE 'InProgress'
                END                     AS Status,
                CAST(ib.MappingVersion AS nvarchar(20)) AS MappingVersion,
                ib.RunType,
                s.NextFeedExpectedAt,
                CASE
                    WHEN bj.PublishedAt IS NOT NULL
                     AND s.NextFeedExpectedAt IS NOT NULL
                     AND bj.PublishedAt <= DATEADD(
                            minute, ISNULL(s.DeliveryWindowMinutes, 120), s.NextFeedExpectedAt)
                    THEN CAST(1 AS BIT)
                    WHEN bj.PublishedAt IS NOT NULL
                     AND s.NextFeedExpectedAt IS NOT NULL
                    THEN CAST(0 AS BIT)
                    ELSE NULL
                END                     AS OnTime
            FROM kafka.BatchJourneys bj
            JOIN  cfl.CU_Registry r         ON r.CU_ID = bj.CuId
            LEFT JOIN audit.IngestionBatches ib ON ib.CU_ID = bj.CuId
                                               AND ABS(DATEDIFF(second, bj.IngestedAt, ib.StartedAt)) < 10
            LEFT JOIN adapter.CU_Schedule s ON s.CuId = bj.CuId
            WHERE bj.CorrelationId = @feedReferenceId;
            """;

        const string timelineSql = """
            SELECT
                StageName,
                StartedAt,
                CompletedAt,
                DurationMs
            FROM kafka.PipelineStageTimings
            WHERE CorrelationId = @feedReferenceId
            ORDER BY StartedAt ASC;
            """;

        const string validationSql = """
            SELECT
                pvr.OverallStatus,
                pvr.Gate1Passed,
                pvr.Gate1ErrorCount,
                pvr.Gate2Passed,
                pvr.Gate2ErrorCount,
                pvr.Gate3Passed,
                pvr.Gate3ErrorCount,
                pvr.SourceMemberCount,
                pvr.ProdMemberCount,
                pvr.SourceAccountCount,
                pvr.ProdAccountCount,
                pvr.SourceLoanCount,
                pvr.ProdLoanCount,
                pvr.DqBlocked,
                pvr.DqWarnings,
                CASE
                    WHEN pvr.SourceMemberCount > 0
                    THEN CAST(pvr.ProdMemberCount AS FLOAT) / pvr.SourceMemberCount * 100.0
                    ELSE NULL
                END AS DataAlignmentScore,
                pvr.GateDetailsJson
            FROM kafka.BatchJourneys bj
            JOIN audit.IngestionBatches ib ON ib.CU_ID = bj.CuId
                                          AND ABS(DATEDIFF(second, bj.IngestedAt, ib.StartedAt)) < 10
            JOIN audit.PipelineValidationReports pvr ON pvr.IngestionBatchId = ib.IngestionBatchId
            WHERE bj.CorrelationId = @feedReferenceId;
            """;

        var param = new { feedReferenceId };
        using var db = Connect();

        var summary    = await db.QuerySingleOrDefaultAsync<FeedDetailSummaryDto>(summarySql, param);
        if (summary is null) return null;

        var timeline   = await db.QueryAsync<StepTimelineItemDto>(timelineSql, param);
        var validation = await db.QuerySingleOrDefaultAsync<ValidationReportDto>(validationSql, param);

        return new FeedDetailDto
        {
            Summary          = summary,
            StepTimeline     = timeline.ToList(),
            ValidationReport = validation
        };
    }

    // ─── Step Timing Trend ────────────────────────────────────────────────────

    /// <summary>
    /// Returns per-feed stage durations for the Step Timing stacked-area chart on the CU Detail page.
    /// Sources: <c>kafka.PipelineStageTimings</c> JOIN <c>kafka.BatchJourneys</c>.
    /// Last 30 feeds, pivoted so each row = one feed date + five stage durations.
    /// </summary>
    public async Task<IEnumerable<StepTimingPointDto>> GetCuStepTimingTrendAsync(string cuId)
    {
        const string sql = """
            SELECT TOP 30
                CONVERT(nvarchar(10), bj.IngestedAt, 23) AS Date,
                MAX(CASE WHEN pst.StageName = 'Ingestion'        THEN pst.DurationMs END) AS ReceiveCuFileMs,
                MAX(CASE WHEN pst.StageName = 'SchemaValidation' THEN pst.DurationMs END) AS DataValidationMs,
                MAX(CASE WHEN pst.StageName = 'Transform'        THEN pst.DurationMs END) AS ApplyStandardisationMs,
                MAX(CASE WHEN pst.StageName = 'RulesValidation'  THEN pst.DurationMs END) AS StandardiseTransformMs,
                MAX(CASE WHEN pst.StageName = 'Publishing'       THEN pst.DurationMs END) AS WriteToStandardMs
            FROM kafka.BatchJourneys bj
            JOIN kafka.PipelineStageTimings pst ON pst.CorrelationId = bj.CorrelationId
            WHERE bj.CuId = @cuId
            GROUP BY bj.CorrelationId, CONVERT(nvarchar(10), bj.IngestedAt, 23)
            ORDER BY CONVERT(nvarchar(10), bj.IngestedAt, 23) ASC;
            """;

        using var db = Connect();
        return await db.QueryAsync<StepTimingPointDto>(sql, new { cuId });
    }
}

// ─── Step Timing DTO ──────────────────────────────────────────────────────────

public class StepTimingPointDto
{
    public string Date                  { get; set; } = "";
    public long?  ReceiveCuFileMs       { get; set; }
    public long?  DataValidationMs      { get; set; }
    public long?  ApplyStandardisationMs { get; set; }
    public long?  StandardiseTransformMs { get; set; }
    public long?  WriteToStandardMs     { get; set; }
}
