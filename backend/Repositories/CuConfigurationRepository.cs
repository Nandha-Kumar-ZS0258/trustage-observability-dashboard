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
                COUNT(*)                                                            AS TotalCus,
                SUM(CASE WHEN onboardingStatus = 'active'     THEN 1 ELSE 0 END)  AS ActiveCount,
                SUM(CASE WHEN onboardingStatus = 'onboarding' THEN 1 ELSE 0 END)  AS OnboardingCount,
                SUM(CASE WHEN onboardingStatus = 'inactive'   THEN 1 ELSE 0 END)  AS InactiveCount
            FROM observability.CuConfiguration;
            """;

        using var db = Connect();
        return await db.QuerySingleAsync<CuSetupKpiDto>(sql);
    }

    // ─── CU Directory ────────────────────────────────────────────────────────

    public async Task<IEnumerable<CuConfigurationDto>> GetDirectoryAsync(CuDirectoryFilters f)
    {
        const string sql = """
            SELECT
                cc.cuId,
                cc.displayName,
                cc.adapterId,
                cc.containerName,
                cc.fileTypes,
                cc.slaThresholdMs,
                cc.mappingVersion,
                cc.environment,
                CAST(cc.onboardingDate AS DATE)  AS onboardingDate,
                cc.onboardingStatus,
                cc.ownerTeam,
                cc.notes,
                MIN(ie.timestamp)                AS firstRunAt,
                CASE
                    WHEN
                        MAX(CASE WHEN ie.adapterId    <> cc.adapterId    THEN 1 ELSE 0 END) = 1
                        OR MAX(CASE WHEN pm.mappingVersion IS NOT NULL
                                         AND pm.mappingVersion <> cc.mappingVersion THEN 1 ELSE 0 END) = 1
                        OR MAX(CASE WHEN bc.containerName IS NOT NULL
                                         AND bc.containerName <> cc.containerName THEN 1 ELSE 0 END) = 1
                    THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
                END AS hasDrift
            FROM observability.CuConfiguration cc
            LEFT JOIN observability.IngestionEvents  ie ON ie.cuId          = cc.cuId
            LEFT JOIN observability.PipelineMetrics  pm ON pm.correlationId = ie.correlationId
            LEFT JOIN observability.BlobContext      bc ON bc.correlationId = ie.correlationId
            WHERE (@Status      IS NULL OR cc.onboardingStatus = @Status)
              AND (@Environment IS NULL OR cc.environment      = @Environment)
              AND (@OwnerTeam   IS NULL OR cc.ownerTeam        = @OwnerTeam)
              AND (@AdapterId   IS NULL OR cc.adapterId        = @AdapterId)
            GROUP BY
                cc.cuId, cc.displayName, cc.adapterId, cc.containerName,
                cc.fileTypes, cc.slaThresholdMs, cc.mappingVersion,
                cc.environment, cc.onboardingDate, cc.onboardingStatus,
                cc.ownerTeam, cc.notes
            ORDER BY cc.displayName;
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
            WITH LatestEvents AS (
                SELECT
                    ie.cuId,
                    MAX(ie.adapterId)           AS observedAdapterId,
                    MAX(pm.mappingVersion)       AS observedMappingVersion,
                    MAX(bc.containerName)        AS observedContainerName,
                    MAX(bc_sla.slaThresholdMs)   AS observedSlaThresholdMs,
                    STRING_AGG(DISTINCT biz.fileType, ', ')
                        WITHIN GROUP (ORDER BY biz.fileType) AS observedFileTypes
                FROM observability.IngestionEvents ie
                LEFT JOIN observability.PipelineMetrics pm  ON pm.correlationId  = ie.correlationId
                LEFT JOIN observability.BlobContext     bc  ON bc.correlationId  = ie.correlationId
                LEFT JOIN observability.BusinessContext biz ON biz.correlationId = ie.correlationId
                LEFT JOIN observability.BusinessContext bc_sla ON bc_sla.correlationId = ie.correlationId
                WHERE (@CuId IS NULL OR ie.cuId = @CuId)
                GROUP BY ie.cuId
            ),
            DriftRows AS (
                SELECT cc.cuId, cc.displayName,
                       'adapterId'       AS Field,
                       cc.adapterId      AS Configured,
                       le.observedAdapterId AS Observed,
                       CASE WHEN le.observedAdapterId IS NOT NULL
                                 AND le.observedAdapterId <> cc.adapterId THEN CAST(1 AS BIT)
                            ELSE CAST(0 AS BIT) END AS IsDrift
                FROM observability.CuConfiguration cc
                LEFT JOIN LatestEvents le ON le.cuId = cc.cuId

                UNION ALL

                SELECT cc.cuId, cc.displayName,
                       'mappingVersion',
                       ISNULL(cc.mappingVersion, '(not set)'),
                       le.observedMappingVersion,
                       CASE WHEN le.observedMappingVersion IS NOT NULL
                                 AND le.observedMappingVersion <> ISNULL(cc.mappingVersion, '') THEN CAST(1 AS BIT)
                            ELSE CAST(0 AS BIT) END
                FROM observability.CuConfiguration cc
                LEFT JOIN LatestEvents le ON le.cuId = cc.cuId

                UNION ALL

                SELECT cc.cuId, cc.displayName,
                       'containerName',
                       cc.containerName,
                       le.observedContainerName,
                       CASE WHEN le.observedContainerName IS NOT NULL
                                 AND le.observedContainerName <> cc.containerName THEN CAST(1 AS BIT)
                            ELSE CAST(0 AS BIT) END
                FROM observability.CuConfiguration cc
                LEFT JOIN LatestEvents le ON le.cuId = cc.cuId

                UNION ALL

                SELECT cc.cuId, cc.displayName,
                       'slaThresholdMs',
                       CAST(cc.slaThresholdMs AS NVARCHAR),
                       CAST(le.observedSlaThresholdMs AS NVARCHAR),
                       CASE WHEN le.observedSlaThresholdMs IS NOT NULL
                                 AND le.observedSlaThresholdMs <> cc.slaThresholdMs THEN CAST(1 AS BIT)
                            ELSE CAST(0 AS BIT) END
                FROM observability.CuConfiguration cc
                LEFT JOIN LatestEvents le ON le.cuId = cc.cuId

                UNION ALL

                SELECT cc.cuId, cc.displayName,
                       'fileTypes',
                       ISNULL(cc.fileTypes, '(not set)'),
                       le.observedFileTypes,
                       CAST(0 AS BIT)   -- informational only, not flagged as drift
                FROM observability.CuConfiguration cc
                LEFT JOIN LatestEvents le ON le.cuId = cc.cuId
            )
            SELECT cuId, displayName, Field, Configured, Observed, IsDrift
            FROM DriftRows
            WHERE (@CuId IS NULL OR cuId = @CuId)
            ORDER BY displayName, Field;
            """;

        using var db = Connect();
        return await db.QueryAsync<CuDriftRowDto>(sql, new { CuId = cuId });
    }

    // ─── Onboarding Timeline ─────────────────────────────────────────────────

    public async Task<IEnumerable<OnboardingMonthDto>> GetOnboardingTimelineAsync()
    {
        const string sql = """
            SELECT
                FORMAT(onboardingDate, 'yyyy-MM') AS Month,
                COUNT(*)                          AS Count
            FROM observability.CuConfiguration
            GROUP BY FORMAT(onboardingDate, 'yyyy-MM')
            ORDER BY Month;
            """;

        using var db = Connect();
        return await db.QueryAsync<OnboardingMonthDto>(sql);
    }

    // ─── Adapter Spread ──────────────────────────────────────────────────────

    public async Task<IEnumerable<AdapterSpreadDto>> GetAdapterSpreadAsync()
    {
        const string sql = """
            SELECT adapterId, COUNT(*) AS Count
            FROM observability.CuConfiguration
            GROUP BY adapterId
            ORDER BY Count DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<AdapterSpreadDto>(sql);
    }

    // ─── Mapping Version Spread ──────────────────────────────────────────────

    public async Task<IEnumerable<MappingSpreadDto>> GetMappingSpreadAsync()
    {
        const string sql = """
            SELECT mappingVersion, COUNT(*) AS Count
            FROM observability.CuConfiguration
            WHERE mappingVersion IS NOT NULL
            GROUP BY mappingVersion
            ORDER BY Count DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<MappingSpreadDto>(sql);
    }

    // ─── First Delivery Gap ──────────────────────────────────────────────────

    public async Task<IEnumerable<FirstDeliveryGapDto>> GetFirstDeliveryGapAsync()
    {
        const string sql = """
            SELECT
                cc.displayName,
                cc.cuId,
                cc.onboardingStatus,
                DATEDIFF(DAY, cc.onboardingDate, MIN(ie.timestamp)) AS GapDays
            FROM observability.CuConfiguration cc
            LEFT JOIN observability.IngestionEvents ie
                ON ie.cuId = cc.cuId AND ie.eventType = 'RunCompleted'
            GROUP BY cc.cuId, cc.displayName, cc.onboardingDate, cc.onboardingStatus
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
                    ie.cuId,
                    COUNT(*)                                                             AS TotalRuns,
                    SUM(CASE WHEN JSON_VALUE(ie.metrics,'$.rowsFailed') = '0'
                             THEN 1.0 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)        AS SuccessRate
                FROM observability.IngestionEvents ie
                WHERE ie.eventType = 'RunCompleted'
                GROUP BY ie.cuId
            )
            SELECT
                ISNULL(cc.ownerTeam, '(unassigned)')  AS OwnerTeam,
                COUNT(*)                              AS TotalCus,
                SUM(CASE WHEN cc.onboardingStatus = 'active'     THEN 1 ELSE 0 END) AS ActiveCount,
                SUM(CASE WHEN cc.onboardingStatus = 'onboarding' THEN 1 ELSE 0 END) AS OnboardingCount,
                AVG(cs.SuccessRate)                   AS AvgSuccessRate
            FROM observability.CuConfiguration cc
            LEFT JOIN CuStats cs ON cs.cuId = cc.cuId
            GROUP BY ISNULL(cc.ownerTeam, '(unassigned)')
            ORDER BY TotalCus DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<OwnerTeamDto>(sql);
    }
}
