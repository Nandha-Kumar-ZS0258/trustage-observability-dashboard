using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using TruStage.Observability.Api.Models;

namespace TruStage.Observability.Api.Repositories;

public class ObservabilityRepository(IConfiguration config)
{
    private IDbConnection Connect() =>
        new SqlConnection(config.GetConnectionString("TruStage"));

    // ─── Overview ─────────────────────────────────────────────────────────────

    public async Task<OverviewKpiDto> GetTodayKpisAsync()
    {
        const string sql = """
            SELECT
                COUNT(*)                                                            AS TotalRuns,
                ISNULL(SUM(CASE WHEN JSON_VALUE(metrics,'$.rowsFailed') = '0'
                         THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*),0), 0)      AS SuccessRate,
                COUNT(DISTINCT cuId)                                                AS ActiveCus
            FROM observability.IngestionEvents
            WHERE eventType = 'RunCompleted'
              AND CAST(timestamp AS DATE) = CAST(GETUTCDATE() AS DATE);
            """;

        const string slaSql = """
            SELECT COUNT(*) AS SlaBreachesToday
            FROM observability.BusinessContext bc
            JOIN observability.IngestionEvents ie ON bc.eventId = ie.eventId
            WHERE bc.slaBreach = 1
              AND CAST(ie.timestamp AS DATE) = CAST(GETUTCDATE() AS DATE);
            """;

        using var db = Connect();
        var kpi = await db.QuerySingleAsync<dynamic>(sql);
        var sla = await db.QuerySingleAsync<dynamic>(slaSql);

        return new OverviewKpiDto
        {
            TotalRuns        = (int)(kpi.TotalRuns        ?? 0),
            SuccessRate      = (double)(kpi.SuccessRate   ?? 0),
            SlaBreachesToday = (int)(sla.SlaBreachesToday ?? 0),
            ActiveCus        = (int)(kpi.ActiveCus        ?? 0),
        };
    }

    public async Task<IEnumerable<LiveFeedEventDto>> GetLiveFeedAsync()
    {
        const string sql = """
            SELECT TOP 20
                ie.eventId,
                ie.eventType,
                ie.cuId,
                bc.blobName,
                ie.timestamp,
                pm.totalProcessingDurationMs,
                CASE
                    WHEN ec.status IS NOT NULL THEN ec.status
                    WHEN pm.rowsFailed > 0 THEN 'partial'
                    ELSE 'success'
                END AS Status
            FROM observability.IngestionEvents ie
            LEFT JOIN observability.BlobContext bc       ON bc.correlationId = ie.correlationId
            LEFT JOIN observability.PipelineMetrics pm   ON pm.correlationId = ie.correlationId
            LEFT JOIN observability.ErrorContext ec      ON ec.correlationId = ie.correlationId
            WHERE ie.eventType IN ('RunCompleted','BlobReceived','IngestionCompleted')
            ORDER BY ie.timestamp DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<LiveFeedEventDto>(sql);
    }

    public async Task<IEnumerable<CuHealthCardDto>> GetCuHealthAsync()
    {
        const string sql = """
            SELECT
                ie.cuId,
                MAX(ie.timestamp)       AS LastRunTime,
                CASE
                    WHEN MAX(CAST(ec.isRecoverable AS INT)) IS NOT NULL THEN 'failed'
                    WHEN MAX(CAST(biz.slaBreach AS INT)) = 1 THEN 'warning'
                    ELSE 'success'
                END AS LastRunStatus,
                ISNULL(MAX(biz.filesReceivedTodayForCu), 0)     AS FilesToday,
                ISNULL(SUM(CAST(pm.rowsWrittenToTarget AS BIGINT)), 0)  AS RowsToday,
                CASE WHEN MAX(CAST(biz.slaBreach AS INT)) = 1 THEN 1 ELSE 0 END AS SlaBreached
            FROM observability.IngestionEvents ie
            LEFT JOIN observability.BusinessContext biz ON biz.correlationId = ie.correlationId
            LEFT JOIN observability.PipelineMetrics pm  ON pm.correlationId  = ie.correlationId
            LEFT JOIN observability.ErrorContext ec     ON ec.correlationId  = ie.correlationId
            WHERE ie.eventType = 'RunCompleted'
              AND CAST(ie.timestamp AS DATE) = CAST(GETUTCDATE() AS DATE)
            GROUP BY ie.cuId
            ORDER BY ie.cuId;
            """;

        using var db = Connect();
        return await db.QueryAsync<CuHealthCardDto>(sql);
    }

    public async Task<IEnumerable<TimelinePointDto>> GetTodayTimelineAsync()
    {
        const string sql = """
            SELECT
                ie.cuId,
                ie.timestamp AS StartTime,
                CASE
                    WHEN ec.status IS NOT NULL THEN 'failed'
                    WHEN biz.slaBreach = 1 THEN 'warning'
                    ELSE 'success'
                END AS Status
            FROM observability.IngestionEvents ie
            LEFT JOIN observability.BusinessContext biz ON biz.correlationId = ie.correlationId
            LEFT JOIN observability.ErrorContext ec     ON ec.correlationId  = ie.correlationId
            WHERE ie.eventType = 'RunCompleted'
              AND CAST(ie.timestamp AS DATE) = CAST(GETUTCDATE() AS DATE)
            ORDER BY ie.timestamp;
            """;

        using var db = Connect();
        return await db.QueryAsync<TimelinePointDto>(sql);
    }

    public async Task<IEnumerable<HourlyRowsDto>> GetHourlyRowsAsync()
    {
        const string sql = """
            SELECT
                DATEPART(HOUR, pm.ingestionEndTime) AS Hour,
                SUM(CAST(pm.rowsWrittenToTarget AS BIGINT)) AS TotalRows
            FROM observability.PipelineMetrics pm
            WHERE CAST(pm.ingestionEndTime AS DATE) = CAST(GETUTCDATE() AS DATE)
            GROUP BY DATEPART(HOUR, pm.ingestionEndTime)
            ORDER BY Hour;
            """;

        using var db = Connect();
        return await db.QueryAsync<HourlyRowsDto>(sql);
    }

    // ─── Run Explorer ─────────────────────────────────────────────────────────

    public async Task<IEnumerable<RunSummaryDto>> GetRunsAsync(RunFilters f)
    {
        const string sql = """
            SELECT
                ie.correlationId,
                ie.cuId,
                bc.blobName,
                biz.fileType,
                MIN(ie.timestamp)                   AS startedAt,
                pm.totalProcessingDurationMs,
                pm.rowsProcessed,
                pm.rowsFailed,
                vm.validationPassed,
                biz.slaBreach
            FROM observability.IngestionEvents ie
            LEFT JOIN observability.BlobContext       bc  ON bc.correlationId  = ie.correlationId
            LEFT JOIN observability.PipelineMetrics   pm  ON pm.correlationId  = ie.correlationId
            LEFT JOIN observability.ValidationMetrics vm  ON vm.correlationId  = ie.correlationId
            LEFT JOIN observability.BusinessContext   biz ON biz.correlationId = ie.correlationId
            LEFT JOIN observability.ErrorContext      ec  ON ec.correlationId  = ie.correlationId
            WHERE ie.eventType = 'RunCompleted'
              AND (@CuId      IS NULL OR ie.cuId      = @CuId)
              AND (@FileType  IS NULL OR biz.fileType = @FileType)
              AND (@From      IS NULL OR ie.timestamp >= @From)
              AND (@To        IS NULL OR ie.timestamp <= @To)
              AND (@SlaBreach IS NULL OR biz.slaBreach = @SlaBreach)
              AND (@Status    IS NULL OR ISNULL(ec.status,'success') = @Status)
            GROUP BY
                ie.correlationId, ie.cuId, bc.blobName, biz.fileType,
                pm.totalProcessingDurationMs, pm.rowsProcessed, pm.rowsFailed,
                vm.validationPassed, biz.slaBreach
            ORDER BY MIN(ie.timestamp) DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<RunSummaryDto>(sql, new
        {
            f.CuId,
            f.FileType,
            f.From,
            f.To,
            f.SlaBreach,
            f.Status
        });
    }

    public async Task<RunDetailDto?> GetRunDetailAsync(Guid correlationId)
    {
        const string eventsSql = """
            SELECT
                ie.eventId,
                ie.eventType,
                ie.stage,
                ie.timestamp,
                bc.blobName,
                hc.hostName,
                hc.memoryUsedMb,
                vm.schemaMatchScore,
                vm.validationErrorsCount AS ValidationErrors,
                pm.rowsProcessed,
                pm.totalProcessingDurationMs AS TotalDurationMs
            FROM observability.IngestionEvents ie
            LEFT JOIN observability.BlobContext       bc  ON bc.eventId = ie.eventId
            LEFT JOIN observability.HostContext       hc  ON hc.eventId = ie.eventId
            LEFT JOIN observability.ValidationMetrics vm  ON vm.eventId = ie.eventId
            LEFT JOIN observability.PipelineMetrics   pm  ON pm.eventId = ie.eventId
            WHERE ie.correlationId = @correlationId
            ORDER BY ie.timestamp;
            """;

        const string stageSql = """
            SELECT
                stageDuration_download AS Download,
                stageDuration_process  AS Process,
                stageDuration_persist  AS Persist,
                totalProcessingDurationMs AS Total
            FROM observability.PipelineMetrics
            WHERE correlationId = @correlationId;
            """;

        const string validationSql = """
            SELECT
                validationPassed,
                validationErrorsCount   AS ErrorsCount,
                validationWarningsCount AS WarningsCount,
                schemaMatchScore,
                missingRequiredColumns,
                unknownColumnsDetected,
                dataTypeMismatchCount,
                nullViolations
            FROM observability.ValidationMetrics
            WHERE correlationId = @correlationId;
            """;

        const string hostSql = """
            SELECT TOP 1
                hostName, processId, cpuUsagePercent, memoryUsedMb, threadId, workerId, environment
            FROM observability.HostContext
            WHERE correlationId = @correlationId
            ORDER BY id DESC;
            """;

        const string bizSql = """
            SELECT
                fileType, expectedRecordCount, actualRecordCount, recordCountVariance,
                isFirstRunOfDay, filesReceivedTodayForCu, slaBreach, slaThresholdMs
            FROM observability.BusinessContext
            WHERE correlationId = @correlationId;
            """;

        const string errSql = """
            SELECT
                status, errorCode, errorMessage, errorStackTrace, failedStage,
                retryAttemptNumber, retryReason, isRecoverable
            FROM observability.ErrorContext
            WHERE correlationId = @correlationId;
            """;

        var param = new { correlationId };
        using var db = Connect();

        var events     = await db.QueryAsync<RunEventDto>(eventsSql, param);
        var stage      = await db.QuerySingleOrDefaultAsync<StageDurationsDto>(stageSql, param);
        var validation = await db.QuerySingleOrDefaultAsync<ValidationDetailDto>(validationSql, param);
        var host       = await db.QuerySingleOrDefaultAsync<HostDetailDto>(hostSql, param);
        var biz        = await db.QuerySingleOrDefaultAsync<BusinessDetailDto>(bizSql, param);
        var error      = await db.QuerySingleOrDefaultAsync<ErrorDetailDto>(errSql, param);

        if (!events.Any()) return null;

        return new RunDetailDto { Events = events, StageDurations = stage, Validation = validation, Host = host, Business = biz, Error = error };
    }

    // ─── CU Detail ───────────────────────────────────────────────────────────

    public async Task<CuSummaryDto?> GetCuSummaryAsync(string cuId)
    {
        const string sql = """
            SELECT
                ie.cuId,
                MAX(ie.adapterId)                                                       AS AdapterId,
                COUNT(DISTINCT ie.correlationId)                                        AS TotalRuns,
                ISNULL(SUM(CASE WHEN pm.rowsFailed = 0 THEN 1 ELSE 0 END)
                        * 100.0 / NULLIF(COUNT(*), 0), 0)                              AS SuccessRate,
                AVG(CAST(pm.totalProcessingDurationMs AS FLOAT))                       AS AvgDurationMs,
                ISNULL(SUM(CAST(pm.rowsWrittenToTarget AS BIGINT)), 0)                 AS TotalRowsProcessed,
                SUM(CASE WHEN biz.slaBreach = 1 THEN 1 ELSE 0 END)                    AS SlaBreachCount,
                MIN(ie.timestamp)                                                       AS FirstFileReceived,
                MAX(ie.timestamp)                                                       AS MostRecentFileReceived
            FROM observability.IngestionEvents ie
            LEFT JOIN observability.PipelineMetrics pm  ON pm.correlationId = ie.correlationId
            LEFT JOIN observability.BusinessContext biz ON biz.correlationId = ie.correlationId
            WHERE ie.cuId = @cuId AND ie.eventType = 'RunCompleted'
            GROUP BY ie.cuId;
            """;

        using var db = Connect();
        return await db.QuerySingleOrDefaultAsync<CuSummaryDto>(sql, new { cuId });
    }

    public async Task<IEnumerable<DurationTrendDto>> GetCuDurationTrendAsync(string cuId, int days)
    {
        const string sql = """
            SELECT
                ie.timestamp AS Date,
                pm.totalProcessingDurationMs AS DurationMs,
                biz.slaThresholdMs
            FROM observability.IngestionEvents ie
            JOIN observability.PipelineMetrics pm   ON pm.correlationId  = ie.correlationId
            LEFT JOIN observability.BusinessContext biz ON biz.correlationId = ie.correlationId
            WHERE ie.cuId = @cuId
              AND ie.eventType = 'RunCompleted'
              AND ie.timestamp >= DATEADD(DAY, -@days, GETUTCDATE())
            ORDER BY ie.timestamp;
            """;

        using var db = Connect();
        return await db.QueryAsync<DurationTrendDto>(sql, new { cuId, days });
    }

    public async Task<IEnumerable<DailyVolumeDto>> GetCuDailyVolumeAsync(string cuId)
    {
        const string sql = """
            SELECT
                CAST(pm.ingestionEndTime AS DATE)               AS Date,
                COUNT(*)                                        AS FileCount,
                ISNULL(SUM(CAST(pm.rowsWrittenToTarget AS BIGINT)), 0) AS TotalRows
            FROM observability.PipelineMetrics pm
            JOIN observability.IngestionEvents ie ON pm.correlationId = ie.correlationId
            WHERE ie.cuId = @cuId
              AND pm.ingestionEndTime >= DATEADD(DAY, -30, GETUTCDATE())
            GROUP BY CAST(pm.ingestionEndTime AS DATE)
            ORDER BY Date;
            """;

        using var db = Connect();
        return await db.QueryAsync<DailyVolumeDto>(sql, new { cuId });
    }

    public async Task<IEnumerable<ValidationTrendDto>> GetCuValidationTrendAsync(string cuId)
    {
        const string sql = """
            SELECT
                ie.timestamp AS Date,
                vm.schemaMatchScore
            FROM observability.ValidationMetrics vm
            JOIN observability.IngestionEvents ie ON vm.correlationId = ie.correlationId
            WHERE ie.cuId = @cuId
              AND ie.timestamp >= DATEADD(DAY, -90, GETUTCDATE())
            ORDER BY ie.timestamp;
            """;

        using var db = Connect();
        return await db.QueryAsync<ValidationTrendDto>(sql, new { cuId });
    }

    public async Task<IEnumerable<RunSummaryDto>> GetCuRecentRunsAsync(string cuId)
    {
        const string sql = """
            SELECT TOP 20
                ie.correlationId,
                ie.cuId,
                bc.blobName,
                biz.fileType,
                MIN(ie.timestamp)                   AS startedAt,
                pm.totalProcessingDurationMs,
                pm.rowsProcessed,
                pm.rowsFailed,
                vm.validationPassed,
                biz.slaBreach
            FROM observability.IngestionEvents ie
            LEFT JOIN observability.BlobContext       bc  ON bc.correlationId  = ie.correlationId
            LEFT JOIN observability.PipelineMetrics   pm  ON pm.correlationId  = ie.correlationId
            LEFT JOIN observability.ValidationMetrics vm  ON vm.correlationId  = ie.correlationId
            LEFT JOIN observability.BusinessContext   biz ON biz.correlationId = ie.correlationId
            WHERE ie.eventType = 'RunCompleted' AND ie.cuId = @cuId
            GROUP BY
                ie.correlationId, ie.cuId, bc.blobName, biz.fileType,
                pm.totalProcessingDurationMs, pm.rowsProcessed, pm.rowsFailed,
                vm.validationPassed, biz.slaBreach
            ORDER BY MIN(ie.timestamp) DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<RunSummaryDto>(sql, new { cuId });
    }

    public async Task<IEnumerable<ErrorFrequencyDto>> GetCuErrorHistoryAsync(string cuId)
    {
        const string sql = """
            SELECT
                ec.errorCode,
                COUNT(*) AS Count
            FROM observability.ErrorContext ec
            JOIN observability.IngestionEvents ie ON ec.correlationId = ie.correlationId
            WHERE ie.cuId = @cuId AND ec.errorCode IS NOT NULL
            GROUP BY ec.errorCode
            ORDER BY Count DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<ErrorFrequencyDto>(sql, new { cuId });
    }

    // ─── Performance ─────────────────────────────────────────────────────────

    public async Task<IEnumerable<StageDurationHeatmapDto>> GetStageDurationHeatmapAsync()
    {
        const string sql = """
            SELECT
                ie.cuId,
                AVG(CAST(pm.stageDuration_download AS FLOAT)) AS AvgDownloadMs,
                AVG(CAST(pm.stageDuration_process  AS FLOAT)) AS AvgProcessMs,
                AVG(CAST(pm.stageDuration_persist  AS FLOAT)) AS AvgPersistMs
            FROM observability.PipelineMetrics pm
            JOIN observability.IngestionEvents ie ON pm.correlationId = ie.correlationId
            GROUP BY ie.cuId
            ORDER BY ie.cuId;
            """;

        using var db = Connect();
        return await db.QueryAsync<StageDurationHeatmapDto>(sql);
    }

    public async Task<IEnumerable<ThroughputTrendDto>> GetThroughputTrendAsync()
    {
        const string sql = """
            SELECT
                pm.ingestionEndTime AS Date,
                pm.throughputRowsPerSec AS ThroughputRowsPerSec
            FROM observability.PipelineMetrics pm
            WHERE pm.ingestionEndTime >= DATEADD(DAY, -30, GETUTCDATE())
            ORDER BY pm.ingestionEndTime;
            """;

        using var db = Connect();
        return await db.QueryAsync<ThroughputTrendDto>(sql);
    }

    public async Task<IEnumerable<SlowestRunDto>> GetSlowestRunsAsync()
    {
        const string sql = """
            SELECT TOP 10
                ie.correlationId,
                ie.cuId,
                bc.blobName,
                pm.totalProcessingDurationMs,
                MIN(ie.timestamp) AS StartedAt
            FROM observability.PipelineMetrics pm
            JOIN observability.IngestionEvents ie ON pm.correlationId = ie.correlationId
            LEFT JOIN observability.BlobContext bc ON bc.correlationId = ie.correlationId
            WHERE ie.eventType = 'RunCompleted'
            GROUP BY ie.correlationId, ie.cuId, bc.blobName, pm.totalProcessingDurationMs
            ORDER BY pm.totalProcessingDurationMs DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<SlowestRunDto>(sql);
    }

    public async Task<StageSplitDto> GetStageSplitAsync()
    {
        const string sql = """
            SELECT
                AVG(CAST(stageDuration_download AS FLOAT)) AS AvgDownloadMs,
                AVG(CAST(stageDuration_process  AS FLOAT)) AS AvgProcessMs,
                AVG(CAST(stageDuration_persist  AS FLOAT)) AS AvgPersistMs
            FROM observability.PipelineMetrics
            WHERE stageDuration_download IS NOT NULL;
            """;

        using var db = Connect();
        return await db.QuerySingleAsync<StageSplitDto>(sql);
    }

    public async Task<IEnumerable<MemoryTrendDto>> GetMemoryTrendAsync()
    {
        const string sql = """
            SELECT
                ie.timestamp,
                hc.memoryUsedMb,
                hc.hostName
            FROM observability.HostContext hc
            JOIN observability.IngestionEvents ie ON hc.eventId = ie.eventId
            WHERE ie.eventType = 'IngestionCompleted'
              AND ie.timestamp >= DATEADD(DAY, -30, GETUTCDATE())
            ORDER BY ie.timestamp;
            """;

        using var db = Connect();
        return await db.QueryAsync<MemoryTrendDto>(sql);
    }

    // ─── Schema Health ───────────────────────────────────────────────────────

    public async Task<IEnumerable<SchemaHealthRowDto>> GetSchemaHealthAsync()
    {
        const string sql = """
            WITH Ranked AS (
                SELECT
                    ie.cuId,
                    vm.schemaMatchScore,
                    ie.timestamp,
                    ROW_NUMBER() OVER (PARTITION BY ie.cuId ORDER BY ie.timestamp DESC) AS rn
                FROM observability.ValidationMetrics vm
                JOIN observability.IngestionEvents ie ON vm.eventId = ie.eventId
            ),
            Latest AS (
                SELECT cuId, schemaMatchScore AS LatestSchemaMatchScore, timestamp AS LastValidationTime
                FROM Ranked WHERE rn = 1
            ),
            Avg30 AS (
                SELECT ie.cuId, AVG(CAST(vm.schemaMatchScore AS FLOAT)) AS Avg30d
                FROM observability.ValidationMetrics vm
                JOIN observability.IngestionEvents ie ON vm.eventId = ie.eventId
                WHERE ie.timestamp >= DATEADD(DAY, -30, GETUTCDATE())
                GROUP BY ie.cuId
            )
            SELECT
                l.cuId,
                l.LatestSchemaMatchScore,
                l.LastValidationTime,
                CASE
                    WHEN l.LatestSchemaMatchScore > ISNULL(a.Avg30d, l.LatestSchemaMatchScore) THEN 'up'
                    WHEN l.LatestSchemaMatchScore < ISNULL(a.Avg30d, l.LatestSchemaMatchScore) THEN 'down'
                    ELSE 'stable'
                END AS Trend
            FROM Latest l
            LEFT JOIN Avg30 a ON a.cuId = l.cuId
            ORDER BY l.cuId;
            """;

        using var db = Connect();
        return await db.QueryAsync<SchemaHealthRowDto>(sql);
    }

    public async Task<IEnumerable<ValidationFailureDto>> GetValidationFailuresAsync()
    {
        const string sql = """
            SELECT
                ie.correlationId,
                ie.cuId,
                bc.blobName,
                ie.timestamp,
                vm.validationErrorsCount AS ErrorCount,
                vm.missingRequiredColumns AS MissingColumns,
                vm.unknownColumnsDetected AS UnknownColumns
            FROM observability.ValidationMetrics vm
            JOIN observability.IngestionEvents ie ON vm.eventId = ie.eventId
            LEFT JOIN observability.BlobContext bc ON bc.correlationId = ie.correlationId
            WHERE vm.validationPassed = 0
              AND ie.timestamp >= DATEADD(DAY, -30, GETUTCDATE())
            ORDER BY ie.timestamp DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<ValidationFailureDto>(sql);
    }

    public async Task<IEnumerable<SchemaDriftAlertDto>> GetSchemaDriftAlertsAsync()
    {
        const string sql = """
            WITH Latest AS (
                SELECT
                    ie.cuId,
                    vm.schemaMatchScore AS CurrentScore,
                    ROW_NUMBER() OVER (PARTITION BY ie.cuId ORDER BY ie.timestamp DESC) AS rn
                FROM observability.ValidationMetrics vm
                JOIN observability.IngestionEvents ie ON vm.eventId = ie.eventId
            ),
            Avg30 AS (
                SELECT ie.cuId, AVG(CAST(vm.schemaMatchScore AS FLOAT)) AS AvgScore30d
                FROM observability.ValidationMetrics vm
                JOIN observability.IngestionEvents ie ON vm.eventId = ie.eventId
                WHERE ie.timestamp >= DATEADD(DAY, -30, GETUTCDATE())
                GROUP BY ie.cuId
            )
            SELECT
                l.cuId,
                CAST(l.CurrentScore AS FLOAT)   AS CurrentScore,
                a.AvgScore30d,
                ISNULL(a.AvgScore30d, 0) - CAST(l.CurrentScore AS FLOAT) AS Drop
            FROM Latest l
            JOIN Avg30 a ON a.cuId = l.cuId
            WHERE l.rn = 1
              AND (ISNULL(a.AvgScore30d, 0) - CAST(l.CurrentScore AS FLOAT)) > 5
            ORDER BY Drop DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<SchemaDriftAlertDto>(sql);
    }

    public async Task<IEnumerable<ColumnAnomalyDto>> GetColumnAnomaliesAsync()
    {
        const string sql = """
            SELECT j.[value] AS ColumnName, 'missing' AS AnomalyType, COUNT(*) AS OccurrenceCount
            FROM observability.ValidationMetrics vm
            CROSS APPLY OPENJSON(vm.missingRequiredColumns) j
            WHERE vm.missingRequiredColumns IS NOT NULL
              AND vm.missingRequiredColumns != '[]'
              AND ISJSON(vm.missingRequiredColumns) = 1
            GROUP BY j.[value]
            UNION ALL
            SELECT j.[value] AS ColumnName, 'unknown' AS AnomalyType, COUNT(*) AS OccurrenceCount
            FROM observability.ValidationMetrics vm
            CROSS APPLY OPENJSON(vm.unknownColumnsDetected) j
            WHERE vm.unknownColumnsDetected IS NOT NULL
              AND vm.unknownColumnsDetected != '[]'
              AND ISJSON(vm.unknownColumnsDetected) = 1
            GROUP BY j.[value]
            ORDER BY OccurrenceCount DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<ColumnAnomalyDto>(sql);
    }

    // ─── Alerts & SLA ────────────────────────────────────────────────────────

    public async Task<SlaSummaryDto> GetSlaSummaryAsync()
    {
        const string sql = """
            SELECT
                COUNT(*)                                                                AS TotalRunsThisMonth,
                SUM(CASE WHEN biz.slaBreach = 0 OR biz.slaBreach IS NULL THEN 1 ELSE 0 END) AS SlaMetCount,
                ISNULL(SUM(CASE WHEN biz.slaBreach = 0 OR biz.slaBreach IS NULL THEN 1 ELSE 0 END)
                        * 100.0 / NULLIF(COUNT(*), 0), 0)                              AS SlaMetPercent,
                SUM(CASE WHEN biz.slaBreach = 1 THEN 1 ELSE 0 END)                    AS SlaBreachCount,
                ISNULL(SUM(CASE WHEN biz.slaBreach = 1 THEN 1 ELSE 0 END)
                        * 100.0 / NULLIF(COUNT(*), 0), 0)                              AS SlaBreachPercent,
                AVG(CAST(pm.totalProcessingDurationMs AS FLOAT))                       AS AvgDurationMs,
                MAX(biz.slaThresholdMs)                                                AS SlaThresholdMs
            FROM observability.IngestionEvents ie
            LEFT JOIN observability.BusinessContext   biz ON biz.correlationId = ie.correlationId
            LEFT JOIN observability.PipelineMetrics   pm  ON pm.correlationId  = ie.correlationId
            WHERE ie.eventType = 'RunCompleted'
              AND ie.timestamp >= DATEADD(MONTH, -1, GETUTCDATE());
            """;

        using var db = Connect();
        return await db.QuerySingleAsync<SlaSummaryDto>(sql);
    }

    public async Task<IEnumerable<SlaBreachDto>> GetSlaBreachesAsync()
    {
        const string sql = """
            SELECT
                ie.correlationId,
                ie.cuId,
                bc.blobName,
                pm.totalProcessingDurationMs    AS DurationMs,
                biz.slaThresholdMs              AS ThresholdMs,
                pm.totalProcessingDurationMs - biz.slaThresholdMs AS OverageMs,
                ie.timestamp
            FROM observability.BusinessContext biz
            JOIN observability.IngestionEvents ie ON biz.correlationId = ie.correlationId
            LEFT JOIN observability.BlobContext bc ON bc.correlationId = ie.correlationId
            LEFT JOIN observability.PipelineMetrics pm ON pm.correlationId = ie.correlationId
            WHERE biz.slaBreach = 1 AND ie.eventType = 'RunCompleted'
            ORDER BY ie.timestamp DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<SlaBreachDto>(sql);
    }

    public async Task<IEnumerable<ErrorSummaryDto>> GetErrorSummaryAsync()
    {
        const string sql = """
            SELECT
                ec.errorCode,
                COUNT(*)                                            AS Count,
                STRING_AGG(DISTINCT ie.cuId, ', ')                 AS AffectedCus,
                MIN(ie.timestamp)                                   AS FirstSeen,
                MAX(ie.timestamp)                                   AS LastSeen
            FROM observability.ErrorContext ec
            JOIN observability.IngestionEvents ie ON ec.correlationId = ie.correlationId
            WHERE ec.errorCode IS NOT NULL
            GROUP BY ec.errorCode
            ORDER BY Count DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<ErrorSummaryDto>(sql);
    }

    public async Task<IEnumerable<RetryRunDto>> GetRetryRunsAsync()
    {
        const string sql = """
            SELECT
                ie.correlationId,
                ie.cuId,
                bc.blobName,
                ec.retryAttemptNumber,
                ec.failedStage,
                ie.timestamp
            FROM observability.ErrorContext ec
            JOIN observability.IngestionEvents ie ON ec.correlationId = ie.correlationId
            LEFT JOIN observability.BlobContext bc ON bc.correlationId = ie.correlationId
            WHERE ec.retryAttemptNumber > 0
            ORDER BY ec.retryAttemptNumber DESC, ie.timestamp DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<RetryRunDto>(sql);
    }

    public async Task<IEnumerable<FailedRunDto>> GetFailedRunsAsync()
    {
        const string sql = """
            SELECT
                ie.correlationId,
                ie.cuId,
                bc.blobName,
                ec.errorCode,
                ec.errorMessage,
                ec.isRecoverable,
                ie.timestamp
            FROM observability.ErrorContext ec
            JOIN observability.IngestionEvents ie ON ec.correlationId = ie.correlationId
            LEFT JOIN observability.BlobContext bc ON bc.correlationId = ie.correlationId
            WHERE ec.status = 'failed' AND ec.isRecoverable = 0
            ORDER BY ie.timestamp DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<FailedRunDto>(sql);
    }
}
