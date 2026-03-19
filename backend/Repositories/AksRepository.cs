using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using TruStage.Observability.Api.Models;

namespace TruStage.Observability.Api.Repositories;

public class AksRepository(IConfiguration config)
{
    private IDbConnection Connect() => new SqlConnection(config.GetConnectionString("TruStage"));

    // ── KPI summary ───────────────────────────────────────────────────────────

    public async Task<AksKpiDto> GetAksKpisAsync()
    {
        const string sql = """
            SELECT
                (SELECT COUNT(*) FROM clustermetrics.NodeHealth WHERE IsOnline = 1)                                    AS NodesOnline,
                (SELECT COUNT(*) FROM clustermetrics.NodeHealth)                                                       AS NodesTotal,
                (SELECT COUNT(*) FROM clustermetrics.AdaptorPodHealth WHERE PodStatus = 'Running')                     AS PodsRunning,
                (SELECT COUNT(*) FROM clustermetrics.ClusterEvents WHERE LastSeen >= DATEADD(hour, -24, SYSUTCDATETIME())) AS WarningsLast24h,
                (SELECT COUNT(*) FROM clustermetrics.ClusterEvents WHERE Reason = 'OOMKilling'
                    AND LastSeen >= DATEADD(hour, -24, SYSUTCDATETIME()))                                   AS OomKillsLast24h,
                (SELECT ISNULL(SUM(RestartCount), 0) FROM clustermetrics.AdaptorPodHealth)                             AS TotalRestarts,
                (SELECT COUNT(*) FROM clustermetrics.AdaptorPodHealth WHERE IsReady = 1)                               AS AdaptorsReady,
                (SELECT COUNT(*) FROM clustermetrics.AdaptorPodHealth)                                                 AS AdaptorsTotal
            """;

        using var db = Connect();
        return await db.QuerySingleAsync<AksKpiDto>(sql);
    }

    // ── Adaptor pod health ────────────────────────────────────────────────────

    public async Task<IEnumerable<AdaptorPodHealthDto>> GetAdaptorHealthAsync()
    {
        const string sql = """
            SELECT
                AdaptorId, PodName, DeploymentName, Namespace,
                PodStatus, ContainerStatus, ContainerStatusReason,
                IsReady, RestartCount, NodeName, PodIp, PodStartTime, LastSyncedAt
            FROM clustermetrics.AdaptorPodHealth
            ORDER BY AdaptorId
            """;

        using var db = Connect();
        return await db.QueryAsync<AdaptorPodHealthDto>(sql);
    }

    public async Task<AdaptorPodHealthDto?> GetAdaptorHealthByIdAsync(string adaptorId)
    {
        const string sql = """
            SELECT
                AdaptorId, PodName, DeploymentName, Namespace,
                PodStatus, ContainerStatus, ContainerStatusReason,
                IsReady, RestartCount, NodeName, PodIp, PodStartTime, LastSyncedAt
            FROM clustermetrics.AdaptorPodHealth
            WHERE AdaptorId = @adaptorId
            """;

        using var db = Connect();
        return await db.QuerySingleOrDefaultAsync<AdaptorPodHealthDto>(sql, new { adaptorId });
    }

    // ── Cluster events ────────────────────────────────────────────────────────

    public async Task<IEnumerable<ClusterEventDto>> GetClusterEventsAsync(int hours = 24)
    {
        const string sql = """
            SELECT
                Id, AdaptorId, ObjectKind, ObjectName, Namespace,
                Reason, Message, EventCount, FirstSeen, LastSeen,
                KubeEventType, SourceComponent
            FROM clustermetrics.ClusterEvents
            WHERE LastSeen >= DATEADD(hour, @negHours, SYSUTCDATETIME())
            ORDER BY LastSeen DESC
            """;

        using var db = Connect();
        return await db.QueryAsync<ClusterEventDto>(sql, new { negHours = -hours });
    }

    public async Task<IEnumerable<EventSummaryDto>> GetEventSummaryAsync(int hours = 24)
    {
        const string sql = """
            SELECT
                Reason,
                ObjectKind,
                COUNT(*) AS Count
            FROM clustermetrics.ClusterEvents
            WHERE LastSeen >= DATEADD(hour, @negHours, SYSUTCDATETIME())
            GROUP BY Reason, ObjectKind
            ORDER BY Count DESC
            """;

        using var db = Connect();
        return await db.QueryAsync<EventSummaryDto>(sql, new { negHours = -hours });
    }

    // ── Node health ───────────────────────────────────────────────────────────

    public async Task<IEnumerable<NodeHealthDto>> GetNodeHealthAsync()
    {
        const string sql = """
            SELECT NodeName, OsType, AgentVersion, LastHeartbeat, IsOnline
            FROM clustermetrics.NodeHealth
            ORDER BY NodeName
            """;

        using var db = Connect();
        return await db.QueryAsync<NodeHealthDto>(sql);
    }

    // ── Adaptor history (uptime, restart trend, probe failures) ──────────────

    public async Task<AdaptorUptimeDto> GetAdaptorUptimeAsync(string adaptorId, int hours = 24)
    {
        const string sql = """
            SELECT
                @adaptorId AS AdaptorId,
                COUNT(*)   AS TotalSamples,
                SUM(CASE WHEN IsReady = 1 THEN 1 ELSE 0 END) AS ReadySamples,
                CAST(
                    SUM(CASE WHEN IsReady = 1 THEN 1.0 ELSE 0.0 END)
                    / NULLIF(COUNT(*), 0) * 100
                AS DECIMAL(5,1)) AS UptimePercent
            FROM clustermetrics.AdaptorHealthSnapshot
            WHERE AdaptorId = @adaptorId
              AND SnapshotTime >= DATEADD(hour, @negHours, SYSUTCDATETIME())
            """;

        using var db = Connect();
        return await db.QuerySingleAsync<AdaptorUptimeDto>(sql, new { adaptorId, negHours = -hours });
    }

    public async Task<IEnumerable<RestartTrendDto>> GetRestartTrendAsync(string adaptorId, int days = 7)
    {
        const string sql = """
            SELECT
                CONVERT(NVARCHAR(10), SnapshotTime, 23) AS Day,
                MAX(RestartCount) AS RestartCount
            FROM clustermetrics.AdaptorHealthSnapshot
            WHERE AdaptorId = @adaptorId
              AND SnapshotTime >= DATEADD(day, @negDays, SYSUTCDATETIME())
            GROUP BY CONVERT(NVARCHAR(10), SnapshotTime, 23)
            ORDER BY Day
            """;

        using var db = Connect();
        return await db.QueryAsync<RestartTrendDto>(sql, new { adaptorId, negDays = -days });
    }

    public async Task<IEnumerable<ProbeFailureTimelineDto>> GetProbeFailureTimelineAsync(string adaptorId, int hours = 24)
    {
        const string sql = """
            SELECT
                CONVERT(NVARCHAR(16),
                    DATEADD(hour, DATEDIFF(hour, 0, LastSeen), 0), 126) AS Hour,
                SUM(EventCount) AS FailureCount
            FROM clustermetrics.ClusterEvents
            WHERE AdaptorId = @adaptorId
              AND Reason IN ('Unhealthy', 'BackOff', 'CrashLoopBackOff')
              AND LastSeen >= DATEADD(hour, @negHours, SYSUTCDATETIME())
            GROUP BY DATEADD(hour, DATEDIFF(hour, 0, LastSeen), 0)
            ORDER BY Hour
            """;

        using var db = Connect();
        return await db.QueryAsync<ProbeFailureTimelineDto>(sql, new { adaptorId, negHours = -hours });
    }

    public async Task<IEnumerable<ClusterEventDto>> GetAdaptorEventsAsync(string adaptorId, int hours = 24)
    {
        const string sql = """
            SELECT Id, AdaptorId, ObjectKind, ObjectName, Namespace,
                   Reason, Message, EventCount, FirstSeen, LastSeen,
                   KubeEventType, SourceComponent
            FROM clustermetrics.ClusterEvents
            WHERE AdaptorId = @adaptorId
              AND LastSeen >= DATEADD(hour, @negHours, SYSUTCDATETIME())
            ORDER BY LastSeen DESC
            """;

        using var db = Connect();
        return await db.QueryAsync<ClusterEventDto>(sql, new { adaptorId, negHours = -hours });
    }

    // ── Adaptor run logs ──────────────────────────────────────────────────────

    public async Task<IEnumerable<AdaptorRunSummaryDto>> GetRecentRunsAsync(int limit = 50)
    {
        const string sql = """
            SELECT
                r.BatchId,
                r.CuId,
                MAX(r.FileName)   AS FileName,
                r.PodName,
                r.NodeName,
                MIN(r.StageTime)  AS RunStart,
                MAX(r.StageTime)  AS RunEnd,
                DATEDIFF(millisecond, MIN(r.StageTime), MAX(r.StageTime)) AS TotalDurationMs,
                MAX(r.Outcome)    AS FinalOutcome
            FROM clustermetrics.AdaptorRunLog r
            GROUP BY r.BatchId, r.CuId, r.PodName, r.NodeName
            ORDER BY MAX(r.StageTime) DESC
            OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY
            """;

        using var db = Connect();
        return await db.QueryAsync<AdaptorRunSummaryDto>(sql, new { limit });
    }

    public async Task<AdaptorRunContextDto?> GetRunContextAsync(string id)
    {
        using var db = Connect();

        // The caller may pass either:
        //   (a) a BatchId directly from clustermetrics.AdaptorRunLog  (AKS Runs table)
        //   (b) a pipeline CorrelationId from kafka.BatchJourneys (Run Explorer deep-link)
        // Try (a) first — cheaper and covers the common AKS-tab case.

        const string directCheckSql = """
            SELECT COUNT(*)
            FROM clustermetrics.AdaptorRunLog
            WHERE BatchId = TRY_CAST(@id AS UNIQUEIDENTIFIER)
            """;

        var directCount = await db.QuerySingleAsync<int>(directCheckSql, new { id });

        string? batchId;
        if (directCount > 0)
        {
            // (a) id is already the BatchId
            batchId = id;
        }
        else
        {
            // (b) resolve CorrelationId → BatchId via kafka.BatchJourneys
            const string resolveSql = """
                SELECT TOP 1 LOWER(CAST(BatchId AS NVARCHAR(36)))
                FROM kafka.BatchJourneys
                WHERE CorrelationId = TRY_CAST(@id AS UNIQUEIDENTIFIER)
                  AND BatchId IS NOT NULL
                ORDER BY Id DESC
                """;

            batchId = await db.QuerySingleOrDefaultAsync<string?>(resolveSql, new { id });
            if (batchId is null) return null;
        }

        const string summarySql = """
            SELECT
                BatchId,
                CuId,
                MAX(FileName)   AS FileName,
                PodName,
                NodeName,
                MIN(StageTime)  AS RunStart,
                MAX(StageTime)  AS RunEnd,
                DATEDIFF(millisecond, MIN(StageTime), MAX(StageTime)) AS TotalDurationMs,
                MAX(Outcome)    AS FinalOutcome
            FROM clustermetrics.AdaptorRunLog
            WHERE BatchId = TRY_CAST(@batchId AS UNIQUEIDENTIFIER)
            GROUP BY BatchId, CuId, PodName, NodeName
            """;

        // Collapse duplicate stage-name rows (e.g. two "Publishing" rows — one for member
        // persistence, one for the final gate check) into a single entry per stage.
        // MIN(StageTime)  → when the stage first fired
        // MAX(...)        → picks the non-null / most-complete value across all rows for that stage
        const string stagesSql = """
            SELECT
                Stage,
                MIN(StageTime)    AS StageTime,
                MAX(MemberCount)  AS MemberCount,
                MAX(ErrorCount)   AS ErrorCount,
                MAX(WarningCount) AS WarningCount,
                MAX(GateResult)   AS GateResult,
                MAX(Outcome)      AS Outcome
            FROM clustermetrics.AdaptorRunLog
            WHERE BatchId = TRY_CAST(@batchId AS UNIQUEIDENTIFIER)
            GROUP BY Stage
            ORDER BY MIN(StageTime) ASC
            """;

        var summary = await db.QuerySingleOrDefaultAsync<AdaptorRunContextDto>(summarySql, new { batchId });
        if (summary is null) return null;

        summary.Stages = await db.QueryAsync<AdaptorRunStageDto>(stagesSql, new { batchId });
        return summary;
    }
}
