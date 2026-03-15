using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using TruStage.Observability.Api.Models.Programme;

namespace TruStage.Observability.Api.Repositories;

/// <summary>Filters for <see cref="ProgrammeRepository.GetCuFleetAsync"/>.</summary>
public class CuFleetFilters
{
    public string? CuId           { get; set; }
    public string? LifecycleState { get; set; }
    public string? HealthStatus   { get; set; }
    public string? Platform       { get; set; }
    public string? Search         { get; set; }
}

/// <summary>
/// Queries the CU partner fleet from <c>cfl.CU_Registry</c>.
/// Lifecycle state and health status are derived in SQL — not stored columns.
/// </summary>
public class ProgrammeRepository(IConfiguration config)
{
    private IDbConnection Connect() =>
        new SqlConnection(config.GetConnectionString("TruStage"));

    // ─── Lifecycle Counts ─────────────────────────────────────────────────────

    /// <summary>
    /// Returns aggregate counts across all lifecycle states plus overdue flags.
    /// Source: <c>cfl.CU_Registry</c> + <c>kafka.BatchJourneys</c>.
    /// </summary>
    public async Task<LifecycleCountsDto> GetLifecycleCountsAsync()
    {
        // SQL Server forbids SUM(CASE ... AND EXISTS(subquery)).
        // Pre-compute per-CU state and last-completed date in a CTE,
        // then aggregate on plain column values in the outer SELECT.
        const string sql = """
            WITH CuStates AS (
                SELECT
                    r.OnboardingStatus,
                    r.StateEnteredAt,
                    r.CreatedAt,
                    CASE
                        WHEN r.OnboardingStatus = 'Onboarding' THEN 'Onboarding'
                        WHEN r.OnboardingStatus = 'Active'
                         AND NOT EXISTS (
                                SELECT 1 FROM kafka.BatchJourneys bj
                                WHERE bj.CuId = r.CU_ID AND bj.FinalStatus = 'Completed'
                         ) THEN 'ReadyForFirstFeed'
                        ELSE 'BAU'
                    END AS LifecycleState,
                    (
                        SELECT MAX(bj2.PublishedAt)
                        FROM kafka.BatchJourneys bj2
                        WHERE bj2.CuId = r.CU_ID AND bj2.FinalStatus = 'Completed'
                    ) AS LastCompletedAt
                FROM cfl.CU_Registry r
            )
            SELECT
                SUM(CASE WHEN LifecycleState = 'Onboarding'        THEN 1 ELSE 0 END) AS Onboarding,
                SUM(CASE WHEN LifecycleState = 'ReadyForFirstFeed'  THEN 1 ELSE 0 END) AS ReadyForFirstFeed,
                SUM(CASE WHEN LifecycleState = 'BAU'                THEN 1 ELSE 0 END) AS Bau,
                COUNT(*) AS Total,
                SUM(CASE
                    WHEN LifecycleState = 'BAU'
                     AND ISNULL(LastCompletedAt, '1900-01-01') < DATEADD(day, -3, GETUTCDATE())
                    THEN 1 ELSE 0 END) AS OverdueBau,
                SUM(CASE
                    WHEN LifecycleState = 'ReadyForFirstFeed'
                     AND DATEDIFF(day, ISNULL(StateEnteredAt, CreatedAt), GETUTCDATE()) > 7
                    THEN 1 ELSE 0 END) AS OverdueReady
            FROM CuStates;
            """;

        using var db = Connect();
        return await db.QuerySingleAsync<LifecycleCountsDto>(sql);
    }

    // ─── CU Fleet ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns all CU partners with derived lifecycle state, health status,
    /// and latest feed metrics. Supports optional filtering.
    /// Sources: <c>cfl.CU_Registry</c>, <c>kafka.BatchJourneys</c>,
    /// <c>kafka.DlqEvents</c>, <c>adapter.CU_Schedule</c>.
    /// </summary>
    public async Task<IEnumerable<CuFleetRowDto>> GetCuFleetAsync(CuFleetFilters filters)
    {
        const string sql = """
            WITH LatestFeed AS (
                SELECT
                    bj.CuId,
                    bj.CorrelationId,
                    bj.PublishedAt,
                    bj.TotalDurationMs,
                    bj.RecordsOut,
                    bj.RecordsDropped,
                    bj.FinalStatus,
                    ROW_NUMBER() OVER (PARTITION BY bj.CuId ORDER BY bj.IngestedAt DESC) AS rn
                FROM kafka.BatchJourneys bj
            ),
            LatestCompleted AS (
                SELECT
                    bj.CuId,
                    MAX(bj.PublishedAt) AS LastCompletedAt
                FROM kafka.BatchJourneys bj
                WHERE bj.FinalStatus = 'Completed'
                GROUP BY bj.CuId
            ),
            Fleet AS (
                SELECT
                    r.CU_ID                 AS CuId,
                    r.CU_Name               AS CuName,
                    r.CoreBankingSystem     AS CoreBankingPlatform,
                    r.OnboardingStatus,
                    r.ActiveMappingVersion,
                    r.AssignedEngineer,
                    r.StateEnteredAt,
                    r.CreatedAt,
                    DATEDIFF(day, ISNULL(r.StateEnteredAt, r.CreatedAt), GETUTCDATE())
                        AS DaysInState,

                    -- Derived lifecycle state (not a stored column)
                    CASE
                        WHEN r.OnboardingStatus = 'Onboarding'          THEN 'Onboarding'
                        WHEN r.OnboardingStatus = 'Active'
                         AND lc.CuId IS NULL                            THEN 'ReadyForFirstFeed'
                        ELSE 'BAU'
                    END AS LifecycleState,

                    CAST(lf.CorrelationId AS nvarchar(50)) AS LastFeedCorrelationId,
                    lf.PublishedAt          AS LastFeedDeliveredAt,
                    lf.TotalDurationMs      AS LastFeedDurationMs,
                    lf.RecordsOut           AS LastFeedMemberRecords,
                    lf.RecordsDropped       AS LastFeedRecordsRejected,
                    s.NextFeedExpectedAt,

                    -- Health status per Section 3 of MONITORING_SPEC.md
                    CASE
                        WHEN r.OnboardingStatus = 'Onboarding'  THEN 'Awaiting'
                        WHEN lc.CuId IS NULL                    THEN 'Awaiting'
                        WHEN EXISTS (
                            SELECT 1 FROM kafka.DlqEvents dlq
                            WHERE dlq.CuId = r.CU_ID AND dlq.ResolvedFlag = 0
                        ) OR lf.FinalStatus = 'Failed'          THEN 'Failed'
                        WHEN s.NextFeedExpectedAt IS NOT NULL
                         AND DATEADD(minute, ISNULL(s.DeliveryWindowMinutes, 120), s.NextFeedExpectedAt) < GETUTCDATE()
                         AND ISNULL(lc.LastCompletedAt, '1900-01-01') < s.NextFeedExpectedAt
                                                                THEN 'Overdue'
                        WHEN s.NextFeedExpectedAt IS NULL
                         AND DATEDIFF(day, ISNULL(lc.LastCompletedAt, '1900-01-01'), GETUTCDATE()) > 3
                                                                THEN 'Overdue'
                        ELSE 'Healthy'
                    END AS HealthStatus

                FROM cfl.CU_Registry r
                LEFT JOIN LatestFeed lf         ON lf.CuId = r.CU_ID AND lf.rn = 1
                LEFT JOIN LatestCompleted lc    ON lc.CuId = r.CU_ID
                LEFT JOIN adapter.CU_Schedule s ON s.CuId  = r.CU_ID
            )
            SELECT *
            FROM Fleet
            WHERE (@Search         IS NULL OR CuName             LIKE '%' + @Search   + '%')
              AND (@LifecycleState IS NULL OR LifecycleState     =           @LifecycleState)
              AND (@HealthStatus   IS NULL OR HealthStatus       =           @HealthStatus)
              AND (@Platform       IS NULL OR CoreBankingPlatform =           @Platform)
            ORDER BY CuName;
            """;

        using var db = Connect();
        return await db.QueryAsync<CuFleetRowDto>(sql, new
        {
            filters.Search,
            filters.LifecycleState,
            filters.HealthStatus,
            filters.Platform
        });
    }

    // ─── Save Note / Owner ────────────────────────────────────────────────────

    /// <summary>
    /// Persists a lifecycle panel note and optionally updates the assigned engineer.
    /// Inserts into <c>ops.CU_Notes</c> when note text is provided,
    /// and updates <c>cfl.CU_Registry.AssignedEngineer</c> when an owner is provided.
    /// Both writes run in a single transaction.
    /// Requires Migration 004 (ops.CU_Notes).
    /// </summary>
    public async Task SaveCuNoteAsync(LifecyclePanelNoteRequest req)
    {
        using var db = Connect();
        db.Open();
        using var tx = db.BeginTransaction();

        if (!string.IsNullOrWhiteSpace(req.Note))
        {
            await db.ExecuteAsync("""
                INSERT INTO ops.CU_Notes (CuId, NoteText, AuthorId)
                VALUES (@CuId, @Note, @OwnerId)
                """, req, tx);
        }

        if (!string.IsNullOrWhiteSpace(req.OwnerId))
        {
            await db.ExecuteAsync("""
                UPDATE cfl.CU_Registry
                SET AssignedEngineer = @OwnerId
                WHERE CU_ID = @CuId
                """, req, tx);
        }

        tx.Commit();
    }

    // ─── Lifecycle Panel ──────────────────────────────────────────────────────

    /// <summary>
    /// Returns CU partners belonging to the given lifecycle state.
    /// Used by the programme view drill-down panels (Onboarding, Ready for First Feed, BAU).
    /// Source: <c>cfl.CU_Registry</c> + <c>kafka.BatchJourneys</c>.
    /// </summary>
    public async Task<IEnumerable<CuConfigurationDto>> GetLifecyclePanelCusAsync(LifecycleState state)
    {
        const string sql = """
            SELECT
                r.CU_ID                 AS CuId,
                r.CU_Name               AS CuName,
                r.CoreBankingSystem     AS CoreBankingPlatform,
                r.OnboardingStatus,
                r.ActiveMappingVersion,
                r.AssignedEngineer,
                r.StateEnteredAt,
                r.CreatedAt,
                DATEDIFF(day, ISNULL(r.StateEnteredAt, r.CreatedAt), GETUTCDATE()) AS DaysInState,
                CASE
                    WHEN r.OnboardingStatus = 'Onboarding'     THEN 'Onboarding'
                    WHEN r.OnboardingStatus = 'Active'
                     AND NOT EXISTS (
                            SELECT 1 FROM kafka.BatchJourneys bj
                            WHERE bj.CuId = r.CU_ID AND bj.FinalStatus = 'Completed'
                     )                                         THEN 'ReadyForFirstFeed'
                    ELSE 'BAU'
                END AS LifecycleState
            FROM cfl.CU_Registry r
            WHERE CASE
                    WHEN r.OnboardingStatus = 'Onboarding'     THEN 'Onboarding'
                    WHEN r.OnboardingStatus = 'Active'
                     AND NOT EXISTS (
                            SELECT 1 FROM kafka.BatchJourneys bj
                            WHERE bj.CuId = r.CU_ID AND bj.FinalStatus = 'Completed'
                     )                                         THEN 'ReadyForFirstFeed'
                    ELSE 'BAU'
                  END = @state
            ORDER BY r.CU_Name;
            """;

        using var db = Connect();
        return await db.QueryAsync<CuConfigurationDto>(sql, new { state = state.ToString() });
    }
}
