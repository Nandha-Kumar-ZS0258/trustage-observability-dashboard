using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using TruStage.Observability.Api.Models;

namespace TruStage.Observability.Api.Repositories;

public class CuConfigurationRepository(IConfiguration config)
{
    private IDbConnection Connect() =>
        new SqlConnection(config.GetConnectionString("TruStage"));

    // ─── KPI Strip ───────────────────────────────────────────────────────────

    public async Task<CuSetupKpiDto> GetKpisAsync()
    {
        const string sql = """
            SELECT
                COUNT(*)                                                                    AS TotalCus,
                SUM(CASE WHEN OnboardingStatus = 'Active'     THEN 1 ELSE 0 END)          AS ActiveCount,
                SUM(CASE WHEN OnboardingStatus = 'Onboarding' THEN 1 ELSE 0 END)          AS OnboardingCount,
                0                                                                           AS InactiveCount
            FROM cfl.CU_Registry;
            """;

        using var db = Connect();
        return await db.QuerySingleAsync<CuSetupKpiDto>(sql);
    }

    // ─── CU Directory ────────────────────────────────────────────────────────

    public async Task<IEnumerable<CuConfigurationDto>> GetDirectoryAsync(CuDirectoryFilters f)
    {
        const string sql = """
            WITH LatestObserved AS (
                SELECT
                    CuId,
                    MAX(AdapterId)                                                                  AS ObservedAdapterId,
                    MAX(CASE WHEN EventType = 'BlobReceived'
                        THEN JSON_VALUE(BlobContext,'$.containerName') END)                        AS ObservedContainerName,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN JSON_VALUE(PipelineMetrics,'$.mappingVersion') END)                   AS ObservedMappingVersion,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN JSON_VALUE(BusinessContext,'$.slaThresholdMs') END)                   AS ObservedSlaThresholdMs,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN JSON_VALUE(HostContext,'$.environment') END)                          AS ObservedEnvironment,
                    STRING_AGG(CASE WHEN EventType = 'IngestionCompleted'
                        AND JSON_VALUE(BusinessContext,'$.fileType') IS NOT NULL
                        THEN JSON_VALUE(BusinessContext,'$.fileType') END, ', ')                   AS ObservedFileTypes,
                    MIN(Timestamp)                                                                  AS FirstRunAt
                FROM telemetry.AdapterEvents
                GROUP BY CuId
            )
            SELECT
                r.CU_ID                                         AS CuId,
                r.CU_Name                                       AS DisplayName,
                ISNULL(lo.ObservedAdapterId, '')                AS AdapterId,
                ISNULL(lo.ObservedContainerName, '')            AS ContainerName,
                lo.ObservedFileTypes                            AS FileTypes,
                ISNULL(CAST(lo.ObservedSlaThresholdMs AS INT), 0) AS SlaThresholdMs,
                CAST(r.ActiveMappingVersion AS NVARCHAR)        AS MappingVersion,
                ISNULL(lo.ObservedEnvironment, '')              AS Environment,
                CAST(r.CreatedAt AS DATE)                       AS OnboardingDate,
                r.OnboardingStatus,
                r.AssignedEngineer                              AS OwnerTeam,
                NULL                                            AS Notes,
                lo.FirstRunAt,
                CASE
                    WHEN lo.ObservedMappingVersion IS NOT NULL
                         AND lo.ObservedMappingVersion <> CAST(r.ActiveMappingVersion AS NVARCHAR)
                    THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
                END                                             AS HasDrift
            FROM cfl.CU_Registry r
            LEFT JOIN LatestObserved lo ON lo.CuId = r.CU_ID
            WHERE (@Status      IS NULL OR r.OnboardingStatus      = @Status)
              AND (@Environment IS NULL OR lo.ObservedEnvironment  = @Environment)
              AND (@OwnerTeam   IS NULL OR r.AssignedEngineer      = @OwnerTeam)
              AND (@AdapterId   IS NULL OR lo.ObservedAdapterId    = @AdapterId)
            ORDER BY r.CU_Name;
            """;

        using var db = Connect();
        return await db.QueryAsync<CuConfigurationDto>(sql, new
        {
            f.Status,
            f.Environment,
            f.OwnerTeam,
            f.AdapterId,
        });
    }

    // ─── Config vs Reality Drift ─────────────────────────────────────────────

    public async Task<IEnumerable<CuDriftRowDto>> GetDriftAsync(string? cuId = null)
    {
        const string sql = """
            WITH LatestObserved AS (
                SELECT
                    CuId,
                    MAX(AdapterId)                                                                  AS ObservedAdapterId,
                    MAX(CASE WHEN EventType = 'BlobReceived'
                        THEN JSON_VALUE(BlobContext,'$.containerName') END)                        AS ObservedContainerName,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN JSON_VALUE(PipelineMetrics,'$.mappingVersion') END)                   AS ObservedMappingVersion,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN JSON_VALUE(BusinessContext,'$.slaThresholdMs') END)                   AS ObservedSlaThresholdMs,
                    STRING_AGG(CASE WHEN EventType = 'IngestionCompleted'
                        AND JSON_VALUE(BusinessContext,'$.fileType') IS NOT NULL
                        THEN JSON_VALUE(BusinessContext,'$.fileType') END, ', ')                   AS ObservedFileTypes
                FROM telemetry.AdapterEvents
                WHERE (@CuId IS NULL OR CuId = @CuId)
                GROUP BY CuId
            ),
            DriftRows AS (
                -- mappingVersion: registry is the configured baseline
                SELECT r.CU_ID AS CuId, r.CU_Name AS DisplayName,
                       'mappingVersion'                      AS Field,
                       CAST(r.ActiveMappingVersion AS NVARCHAR) AS Configured,
                       lo.ObservedMappingVersion             AS Observed,
                       CASE WHEN lo.ObservedMappingVersion IS NOT NULL
                                 AND lo.ObservedMappingVersion <> CAST(r.ActiveMappingVersion AS NVARCHAR)
                            THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsDrift
                FROM cfl.CU_Registry r
                LEFT JOIN LatestObserved lo ON lo.CuId = r.CU_ID

                UNION ALL

                -- adapterId: observed only, no configured baseline in registry
                SELECT r.CU_ID, r.CU_Name,
                       'adapterId', NULL, lo.ObservedAdapterId, CAST(0 AS BIT)
                FROM cfl.CU_Registry r
                LEFT JOIN LatestObserved lo ON lo.CuId = r.CU_ID

                UNION ALL

                -- containerName: observed only
                SELECT r.CU_ID, r.CU_Name,
                       'containerName', NULL, lo.ObservedContainerName, CAST(0 AS BIT)
                FROM cfl.CU_Registry r
                LEFT JOIN LatestObserved lo ON lo.CuId = r.CU_ID

                UNION ALL

                -- slaThresholdMs: observed only
                SELECT r.CU_ID, r.CU_Name,
                       'slaThresholdMs', NULL, lo.ObservedSlaThresholdMs, CAST(0 AS BIT)
                FROM cfl.CU_Registry r
                LEFT JOIN LatestObserved lo ON lo.CuId = r.CU_ID

                UNION ALL

                -- fileTypes: observed only, informational
                SELECT r.CU_ID, r.CU_Name,
                       'fileTypes', NULL, lo.ObservedFileTypes, CAST(0 AS BIT)
                FROM cfl.CU_Registry r
                LEFT JOIN LatestObserved lo ON lo.CuId = r.CU_ID
            )
            SELECT CuId, DisplayName, Field, Configured, Observed, IsDrift
            FROM DriftRows
            WHERE (@CuId IS NULL OR CuId = @CuId)
            ORDER BY DisplayName, Field;
            """;

        using var db = Connect();
        return await db.QueryAsync<CuDriftRowDto>(sql, new { CuId = cuId });
    }

    // ─── Onboarding Timeline ─────────────────────────────────────────────────

    public async Task<IEnumerable<OnboardingMonthDto>> GetOnboardingTimelineAsync()
    {
        const string sql = """
            SELECT
                FORMAT(CreatedAt, 'yyyy-MM') AS Month,
                COUNT(*)                     AS Count
            FROM cfl.CU_Registry
            GROUP BY FORMAT(CreatedAt, 'yyyy-MM')
            ORDER BY Month;
            """;

        using var db = Connect();
        return await db.QueryAsync<OnboardingMonthDto>(sql);
    }

    // ─── Adapter Spread ──────────────────────────────────────────────────────

    public async Task<IEnumerable<AdapterSpreadDto>> GetAdapterSpreadAsync()
    {
        const string sql = """
            SELECT ObservedAdapterId AS AdapterId, COUNT(*) AS Count
            FROM (
                SELECT CuId, MAX(AdapterId) AS ObservedAdapterId
                FROM telemetry.AdapterEvents
                GROUP BY CuId
            ) CuAdapters
            WHERE ObservedAdapterId IS NOT NULL
            GROUP BY ObservedAdapterId
            ORDER BY Count DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<AdapterSpreadDto>(sql);
    }

    // ─── Mapping Version Spread ──────────────────────────────────────────────

    public async Task<IEnumerable<MappingSpreadDto>> GetMappingSpreadAsync()
    {
        const string sql = """
            SELECT
                CAST(ActiveMappingVersion AS NVARCHAR) AS MappingVersion,
                COUNT(*)                               AS Count
            FROM cfl.CU_Registry
            WHERE ActiveMappingVersion IS NOT NULL
            GROUP BY ActiveMappingVersion
            ORDER BY Count DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<MappingSpreadDto>(sql);
    }

    // ─── First Delivery Gap ──────────────────────────────────────────────────

    public async Task<IEnumerable<FirstDeliveryGapDto>> GetFirstDeliveryGapAsync()
    {
        const string sql = """
            WITH FirstRuns AS (
                SELECT CuId, MIN(Timestamp) AS FirstRunAt
                FROM telemetry.AdapterEvents
                WHERE EventType IN ('RunCompleted','IngestionCompleted')
                GROUP BY CuId
            )
            SELECT
                r.CU_Name       AS DisplayName,
                r.CU_ID         AS CuId,
                r.OnboardingStatus,
                DATEDIFF(DAY, r.CreatedAt, fr.FirstRunAt) AS GapDays
            FROM cfl.CU_Registry r
            LEFT JOIN FirstRuns fr ON fr.CuId = r.CU_ID
            ORDER BY GapDays DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<FirstDeliveryGapDto>(sql);
    }

    // ─── Owner Team Load ─────────────────────────────────────────────────────

    public async Task<IEnumerable<OwnerTeamDto>> GetOwnerTeamsAsync()
    {
        const string sql = """
            WITH CuStats AS (
                SELECT
                    CuId,
                    COUNT(*)                                                                     AS TotalRuns,
                    SUM(CASE WHEN JSON_VALUE(Metrics,'$.rowsFailed') = '0' THEN 1.0 ELSE 0 END)
                        * 100.0 / NULLIF(COUNT(*), 0)                                           AS SuccessRate
                FROM telemetry.AdapterEvents
                WHERE EventType = 'RunCompleted'
                GROUP BY CuId
            )
            SELECT
                ISNULL(r.AssignedEngineer, '(unassigned)') AS OwnerTeam,
                COUNT(*)                                    AS TotalCus,
                SUM(CASE WHEN r.OnboardingStatus = 'Active'     THEN 1 ELSE 0 END) AS ActiveCount,
                SUM(CASE WHEN r.OnboardingStatus = 'Onboarding' THEN 1 ELSE 0 END) AS OnboardingCount,
                AVG(cs.SuccessRate)                         AS AvgSuccessRate
            FROM cfl.CU_Registry r
            LEFT JOIN CuStats cs ON cs.CuId = r.CU_ID
            GROUP BY ISNULL(r.AssignedEngineer, '(unassigned)')
            ORDER BY TotalCus DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<OwnerTeamDto>(sql);
    }
}
