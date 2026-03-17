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
                ISNULL(SUM(CASE WHEN JSON_VALUE(Metrics,'$.rowsFailed') = '0'
                         THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*),0), 0)      AS SuccessRate,
                COUNT(DISTINCT CuId)                                                AS ActiveCus
            FROM telemetry.AdapterEvents
            WHERE EventType = 'RunCompleted'
              AND CAST(Timestamp AS DATE) = CAST(GETUTCDATE() AS DATE);
            """;

        const string slaSql = """
            SELECT COUNT(*) AS SlaBreachesToday
            FROM telemetry.AdapterEvents
            WHERE EventType = 'IngestionCompleted'
              AND JSON_VALUE(BusinessContext,'$.slaBreach') = 'true'
              AND CAST(Timestamp AS DATE) = CAST(GETUTCDATE() AS DATE);
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
                EventId,
                EventType,
                CuId,
                JSON_VALUE(BlobContext,'$.blobName')                                      AS BlobName,
                Timestamp,
                CAST(JSON_VALUE(PipelineMetrics,'$.totalProcessingDurationMs') AS BIGINT) AS TotalProcessingDurationMs,
                CASE
                    WHEN JSON_VALUE(ErrorContext,'$.status') IS NOT NULL
                        THEN JSON_VALUE(ErrorContext,'$.status')
                    WHEN CAST(JSON_VALUE(PipelineMetrics,'$.rowsFailed') AS INT) > 0
                        THEN 'partial'
                    ELSE 'success'
                END AS Status
            FROM telemetry.AdapterEvents
            WHERE EventType IN ('RunCompleted','BlobReceived','IngestionCompleted')
            ORDER BY Timestamp DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<LiveFeedEventDto>(sql);
    }

    public async Task<IEnumerable<CuHealthCardDto>> GetCuHealthAsync()
    {
        const string sql = """
            WITH CollapsedRuns AS (
                SELECT
                    CuId,
                    CorrelationId,
                    MAX(Timestamp) AS RunTime,
                    MAX(CASE WHEN EventType IN ('IngestionFailed','RunFailed') THEN 1 ELSE NULL END) AS HasError,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CASE WHEN JSON_VALUE(BusinessContext,'$.slaBreach') = 'true' THEN 1 ELSE 0 END END) AS SlaBreach,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(BusinessContext,'$.filesReceivedTodayForCu') AS INT) END) AS FilesReceivedTodayForCu,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.rowsWrittenToTarget') AS BIGINT) END) AS RowsWrittenToTarget
                FROM telemetry.AdapterEvents
                WHERE CAST(Timestamp AS DATE) = CAST(GETUTCDATE() AS DATE)
                GROUP BY CuId, CorrelationId
            )
            SELECT
                CuId,
                MAX(RunTime) AS LastRunTime,
                CASE
                    WHEN MAX(HasError) IS NOT NULL THEN 'failed'
                    WHEN MAX(SlaBreach) = 1        THEN 'warning'
                    ELSE 'success'
                END AS LastRunStatus,
                ISNULL(MAX(FilesReceivedTodayForCu), 0)  AS FilesToday,
                ISNULL(SUM(RowsWrittenToTarget), 0)       AS RowsToday,
                CASE WHEN MAX(SlaBreach) = 1 THEN 1 ELSE 0 END AS SlaBreached
            FROM CollapsedRuns
            GROUP BY CuId
            ORDER BY CuId;
            """;

        using var db = Connect();
        return await db.QueryAsync<CuHealthCardDto>(sql);
    }

    public async Task<IEnumerable<TimelinePointDto>> GetTodayTimelineAsync()
    {
        const string sql = """
            WITH CollapsedRuns AS (
                SELECT
                    CuId,
                    CorrelationId,
                    MIN(Timestamp) AS StartTime,
                    MAX(CASE WHEN EventType IN ('IngestionFailed','RunFailed')
                        THEN JSON_VALUE(ErrorContext,'$.status') END) AS ErrorStatus,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CASE WHEN JSON_VALUE(BusinessContext,'$.slaBreach') = 'true' THEN 1 ELSE 0 END END) AS SlaBreach
                FROM telemetry.AdapterEvents
                WHERE CAST(Timestamp AS DATE) = CAST(GETUTCDATE() AS DATE)
                GROUP BY CuId, CorrelationId
            )
            SELECT
                CuId,
                StartTime,
                CASE
                    WHEN ErrorStatus IS NOT NULL THEN 'failed'
                    WHEN SlaBreach = 1           THEN 'warning'
                    ELSE 'success'
                END AS Status
            FROM CollapsedRuns
            ORDER BY StartTime;
            """;

        using var db = Connect();
        return await db.QueryAsync<TimelinePointDto>(sql);
    }

    public async Task<IEnumerable<HourlyRowsDto>> GetHourlyRowsAsync()
    {
        const string sql = """
            SELECT
                DATEPART(HOUR, Timestamp)                                          AS Hour,
                SUM(CAST(JSON_VALUE(PipelineMetrics,'$.rowsWrittenToTarget') AS BIGINT)) AS TotalRows
            FROM telemetry.AdapterEvents
            WHERE EventType = 'IngestionCompleted'
              AND CAST(Timestamp AS DATE) = CAST(GETUTCDATE() AS DATE)
            GROUP BY DATEPART(HOUR, Timestamp)
            ORDER BY Hour;
            """;

        using var db = Connect();
        return await db.QueryAsync<HourlyRowsDto>(sql);
    }

    // ─── Run Explorer ─────────────────────────────────────────────────────────

    public async Task<IEnumerable<RunSummaryDto>> GetRunsAsync(RunFilters f)
    {
        const string sql = """
            WITH RunData AS (
                SELECT
                    CorrelationId,
                    CuId,
                    MIN(Timestamp) AS StartedAt,
                    MAX(CASE WHEN EventType = 'BlobReceived'
                        THEN JSON_VALUE(BlobContext,'$.blobName') END)                       AS BlobName,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN JSON_VALUE(BusinessContext,'$.fileType') END)                   AS FileType,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.totalProcessingDurationMs') AS INT) END) AS TotalProcessingDurationMs,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.rowsProcessed') AS INT) END) AS RowsProcessed,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.rowsFailed') AS INT) END)    AS RowsFailed,
                    MAX(CASE WHEN EventType = 'ValidationCompleted'
                        THEN CASE WHEN JSON_VALUE(ValidationMetrics,'$.validationPassed') = 'true' THEN 1 ELSE 0 END END) AS ValidationPassedInt,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CASE WHEN JSON_VALUE(BusinessContext,'$.slaBreach') = 'true' THEN 1 ELSE 0 END END) AS SlaBreachInt,
                    MAX(CASE WHEN EventType IN ('IngestionFailed','RunFailed')
                        THEN JSON_VALUE(ErrorContext,'$.status') END)                        AS ErrorStatus
                FROM telemetry.AdapterEvents
                WHERE (@CuId IS NULL OR CuId = @CuId)
                  AND (@From IS NULL OR Timestamp >= @From)
                  AND (@To   IS NULL OR Timestamp <= @To)
                GROUP BY CorrelationId, CuId
            )
            SELECT
                CorrelationId,
                CuId,
                BlobName,
                FileType,
                StartedAt,
                TotalProcessingDurationMs,
                RowsProcessed,
                RowsFailed,
                CAST(ValidationPassedInt AS BIT) AS ValidationPassed,
                CAST(SlaBreachInt AS BIT)        AS SlaBreach
            FROM RunData
            WHERE (@FileType  IS NULL OR FileType    = @FileType)
              AND (@SlaBreach IS NULL OR CAST(SlaBreachInt AS BIT) = @SlaBreach)
              AND (@Status    IS NULL OR ISNULL(ErrorStatus,'success') = @Status)
            ORDER BY StartedAt DESC;
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
                EventId,
                EventType,
                Stage,
                Timestamp,
                JSON_VALUE(BlobContext,'$.blobName')                                      AS BlobName,
                JSON_VALUE(HostContext,'$.hostName')                                       AS HostName,
                CAST(JSON_VALUE(HostContext,'$.memoryUsedMb') AS FLOAT)                   AS MemoryUsedMb,
                CAST(JSON_VALUE(ValidationMetrics,'$.schemaMatchScore') AS DECIMAL(5,2)) AS SchemaMatchScore,
                CAST(JSON_VALUE(ValidationMetrics,'$.validationErrorsCount') AS INT)     AS ValidationErrors,
                CAST(JSON_VALUE(PipelineMetrics,'$.rowsProcessed') AS INT)               AS RowsProcessed,
                CAST(JSON_VALUE(PipelineMetrics,'$.totalProcessingDurationMs') AS BIGINT) AS TotalDurationMs
            FROM telemetry.AdapterEvents
            WHERE CorrelationId = @correlationId
            ORDER BY Timestamp;
            """;

        const string stageSql = """
            SELECT
                CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.parse')     AS INT)   AS Parse,
                CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.map')       AS INT)   AS Map,
                CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.transform') AS INT)   AS Transform,
                CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.validate')  AS INT)   AS Validate,
                CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.load')      AS INT)   AS Load,
                CAST(JSON_VALUE(PipelineMetrics,'$.totalProcessingDurationMs') AS BIGINT) AS Total
            FROM telemetry.AdapterEvents
            WHERE CorrelationId = @correlationId
              AND EventType = 'IngestionCompleted';
            """;

        const string validationSql = """
            SELECT
                CAST(CASE WHEN JSON_VALUE(ValidationMetrics,'$.validationPassed') = 'true' THEN 1 ELSE 0 END AS BIT) AS ValidationPassed,
                CAST(JSON_VALUE(ValidationMetrics,'$.validationErrorsCount')   AS INT)          AS ErrorsCount,
                CAST(JSON_VALUE(ValidationMetrics,'$.validationWarningsCount') AS INT)          AS WarningsCount,
                CAST(JSON_VALUE(ValidationMetrics,'$.schemaMatchScore')        AS DECIMAL(5,2)) AS SchemaMatchScore,
                JSON_QUERY(ValidationMetrics,'$.missingRequiredColumns')                        AS MissingRequiredColumns,
                JSON_QUERY(ValidationMetrics,'$.unknownColumnsDetected')                        AS UnknownColumnsDetected,
                CAST(JSON_VALUE(ValidationMetrics,'$.dataTypeMismatchCount')   AS INT)          AS DataTypeMismatchCount,
                CAST(JSON_VALUE(ValidationMetrics,'$.nullViolations')          AS INT)          AS NullViolations
            FROM telemetry.AdapterEvents
            WHERE CorrelationId = @correlationId
              AND EventType = 'ValidationCompleted';
            """;

        const string hostSql = """
            SELECT TOP 1
                JSON_VALUE(HostContext,'$.hostName')                                AS HostName,
                CAST(JSON_VALUE(HostContext,'$.processId')        AS INT)           AS ProcessId,
                CAST(JSON_VALUE(HostContext,'$.cpuUsagePercent')  AS DECIMAL(5,2))  AS CpuUsagePercent,
                CAST(JSON_VALUE(HostContext,'$.memoryUsedMb')     AS DECIMAL(10,2)) AS MemoryUsedMb,
                CAST(JSON_VALUE(HostContext,'$.threadId')         AS INT)           AS ThreadId,
                JSON_VALUE(HostContext,'$.workerId')                                AS WorkerId,
                JSON_VALUE(HostContext,'$.environment')                             AS Environment
            FROM telemetry.AdapterEvents
            WHERE CorrelationId = @correlationId
              AND EventType = 'IngestionCompleted'
              AND HostContext IS NOT NULL
            ORDER BY Timestamp DESC;
            """;

        const string bizSql = """
            SELECT
                JSON_VALUE(BusinessContext,'$.fileType')                                               AS FileType,
                CAST(JSON_VALUE(BusinessContext,'$.expectedRecordCount')     AS INT)                   AS ExpectedRecordCount,
                CAST(JSON_VALUE(BusinessContext,'$.actualRecordCount')       AS INT)                   AS ActualRecordCount,
                CAST(JSON_VALUE(BusinessContext,'$.recordCountVariance')     AS INT)                   AS RecordCountVariance,
                CAST(CASE WHEN JSON_VALUE(BusinessContext,'$.isFirstRunOfDay') = 'true' THEN 1 ELSE 0 END AS BIT) AS IsFirstRunOfDay,
                CAST(JSON_VALUE(BusinessContext,'$.filesReceivedTodayForCu') AS INT)                   AS FilesReceivedTodayForCu,
                CAST(CASE WHEN JSON_VALUE(BusinessContext,'$.slaBreach') = 'true' THEN 1 ELSE 0 END AS BIT) AS SlaBreach,
                CAST(JSON_VALUE(BusinessContext,'$.slaThresholdMs')          AS INT)                   AS SlaThresholdMs
            FROM telemetry.AdapterEvents
            WHERE CorrelationId = @correlationId
              AND EventType = 'IngestionCompleted'
              AND BusinessContext IS NOT NULL;
            """;

        const string errSql = """
            SELECT TOP 1
                JSON_VALUE(ErrorContext,'$.status')                                                    AS Status,
                JSON_VALUE(ErrorContext,'$.errorCode')                                                 AS ErrorCode,
                JSON_VALUE(ErrorContext,'$.errorMessage')                                              AS ErrorMessage,
                JSON_VALUE(ErrorContext,'$.errorStackTrace')                                           AS ErrorStackTrace,
                JSON_VALUE(ErrorContext,'$.failedStage')                                               AS FailedStage,
                CAST(JSON_VALUE(ErrorContext,'$.retryAttemptNumber') AS INT)                          AS RetryAttemptNumber,
                JSON_VALUE(ErrorContext,'$.retryReason')                                               AS RetryReason,
                CAST(CASE WHEN JSON_VALUE(ErrorContext,'$.isRecoverable') = 'true' THEN 1 ELSE 0 END AS BIT) AS IsRecoverable
            FROM telemetry.AdapterEvents
            WHERE CorrelationId = @correlationId
              AND EventType IN ('IngestionFailed','RunFailed','RetryAttempted')
              AND ErrorContext IS NOT NULL
            ORDER BY Timestamp DESC;
            """;

        var param = new { correlationId = correlationId.ToString() };
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
            WITH CollapsedRuns AS (
                SELECT
                    CuId,
                    CorrelationId,
                    AdapterId,
                    MIN(Timestamp) AS RunStarted,
                    MAX(Timestamp) AS RunEnded,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.rowsFailed') AS INT) END)            AS RowsFailed,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.totalProcessingDurationMs') AS FLOAT) END) AS TotalDurationMs,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.rowsWrittenToTarget') AS BIGINT) END) AS RowsWrittenToTarget,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CASE WHEN JSON_VALUE(BusinessContext,'$.slaBreach') = 'true' THEN 1 ELSE 0 END END) AS SlaBreach
                FROM telemetry.AdapterEvents
                WHERE CuId = @cuId
                GROUP BY CuId, CorrelationId, AdapterId
            )
            SELECT
                CuId,
                MAX(AdapterId)                                                                  AS AdapterId,
                COUNT(DISTINCT CorrelationId)                                                   AS TotalRuns,
                ISNULL(SUM(CASE WHEN ISNULL(RowsFailed,0) = 0 THEN 1 ELSE 0 END)
                        * 100.0 / NULLIF(COUNT(*),0), 0)                                       AS SuccessRate,
                AVG(TotalDurationMs)                                                            AS AvgDurationMs,
                ISNULL(SUM(RowsWrittenToTarget), 0)                                            AS TotalRowsProcessed,
                SUM(CASE WHEN SlaBreach = 1 THEN 1 ELSE 0 END)                                AS SlaBreachCount,
                MIN(RunStarted)                                                                 AS FirstFileReceived,
                MAX(RunEnded)                                                                   AS MostRecentFileReceived
            FROM CollapsedRuns
            GROUP BY CuId;
            """;

        using var db = Connect();
        return await db.QuerySingleOrDefaultAsync<CuSummaryDto>(sql, new { cuId });
    }

    public async Task<IEnumerable<DurationTrendDto>> GetCuDurationTrendAsync(string cuId, int days)
    {
        const string sql = """
            SELECT
                Timestamp                                                           AS Date,
                CAST(JSON_VALUE(PipelineMetrics,'$.totalProcessingDurationMs') AS INT) AS DurationMs,
                CAST(JSON_VALUE(BusinessContext,'$.slaThresholdMs') AS INT)        AS SlaThresholdMs
            FROM telemetry.AdapterEvents
            WHERE CuId = @cuId
              AND EventType = 'IngestionCompleted'
              AND Timestamp >= DATEADD(DAY, -@days, GETUTCDATE())
            ORDER BY Timestamp;
            """;

        using var db = Connect();
        return await db.QueryAsync<DurationTrendDto>(sql, new { cuId, days });
    }

    public async Task<IEnumerable<DailyVolumeDto>> GetCuDailyVolumeAsync(string cuId)
    {
        const string sql = """
            SELECT
                CAST(Timestamp AS DATE)                                                    AS Date,
                COUNT(*)                                                                    AS FileCount,
                ISNULL(SUM(CAST(JSON_VALUE(PipelineMetrics,'$.rowsWrittenToTarget') AS BIGINT)), 0) AS TotalRows
            FROM telemetry.AdapterEvents
            WHERE CuId = @cuId
              AND EventType = 'IngestionCompleted'
              AND Timestamp >= DATEADD(DAY, -30, GETUTCDATE())
            GROUP BY CAST(Timestamp AS DATE)
            ORDER BY Date;
            """;

        using var db = Connect();
        return await db.QueryAsync<DailyVolumeDto>(sql, new { cuId });
    }

    public async Task<IEnumerable<ValidationTrendDto>> GetCuValidationTrendAsync(string cuId)
    {
        const string sql = """
            SELECT
                Timestamp                                                                   AS Date,
                CAST(JSON_VALUE(ValidationMetrics,'$.schemaMatchScore') AS DECIMAL(5,2))  AS SchemaMatchScore
            FROM telemetry.AdapterEvents
            WHERE CuId = @cuId
              AND EventType = 'ValidationCompleted'
              AND Timestamp >= DATEADD(DAY, -90, GETUTCDATE())
            ORDER BY Timestamp;
            """;

        using var db = Connect();
        return await db.QueryAsync<ValidationTrendDto>(sql, new { cuId });
    }

    public async Task<IEnumerable<RunSummaryDto>> GetCuRecentRunsAsync(string cuId)
    {
        const string sql = """
            WITH RunData AS (
                SELECT
                    CorrelationId,
                    CuId,
                    MIN(Timestamp) AS StartedAt,
                    MAX(CASE WHEN EventType = 'BlobReceived'
                        THEN JSON_VALUE(BlobContext,'$.blobName') END)                       AS BlobName,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN JSON_VALUE(BusinessContext,'$.fileType') END)                   AS FileType,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.totalProcessingDurationMs') AS INT) END) AS TotalProcessingDurationMs,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.rowsProcessed') AS INT) END) AS RowsProcessed,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.rowsFailed') AS INT) END)    AS RowsFailed,
                    MAX(CASE WHEN EventType = 'ValidationCompleted'
                        THEN CASE WHEN JSON_VALUE(ValidationMetrics,'$.validationPassed') = 'true' THEN 1 ELSE 0 END END) AS ValidationPassedInt,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CASE WHEN JSON_VALUE(BusinessContext,'$.slaBreach') = 'true' THEN 1 ELSE 0 END END) AS SlaBreachInt
                FROM telemetry.AdapterEvents
                WHERE CuId = @cuId
                GROUP BY CorrelationId, CuId
            ),
            Ranked AS (
                SELECT *, ROW_NUMBER() OVER (ORDER BY StartedAt DESC) AS Rn FROM RunData
            )
            SELECT
                CorrelationId,
                CuId,
                BlobName,
                FileType,
                StartedAt,
                TotalProcessingDurationMs,
                RowsProcessed,
                RowsFailed,
                CAST(ValidationPassedInt AS BIT) AS ValidationPassed,
                CAST(SlaBreachInt AS BIT)        AS SlaBreach
            FROM Ranked
            WHERE Rn <= 20
            ORDER BY StartedAt DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<RunSummaryDto>(sql, new { cuId });
    }

    public async Task<IEnumerable<ErrorFrequencyDto>> GetCuErrorHistoryAsync(string cuId)
    {
        const string sql = """
            SELECT
                JSON_VALUE(ErrorContext,'$.errorCode') AS ErrorCode,
                COUNT(*) AS Count
            FROM telemetry.AdapterEvents
            WHERE CuId = @cuId
              AND EventType IN ('IngestionFailed','RunFailed')
              AND JSON_VALUE(ErrorContext,'$.errorCode') IS NOT NULL
            GROUP BY JSON_VALUE(ErrorContext,'$.errorCode')
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
                CuId,
                AVG(CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.parse')     AS FLOAT)) AS AvgParseMs,
                AVG(CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.map')       AS FLOAT)) AS AvgMapMs,
                AVG(CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.transform') AS FLOAT)) AS AvgTransformMs,
                AVG(CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.validate')  AS FLOAT)) AS AvgValidateMs,
                AVG(CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.load')      AS FLOAT)) AS AvgLoadMs
            FROM telemetry.AdapterEvents
            WHERE EventType = 'IngestionCompleted'
            GROUP BY CuId
            ORDER BY CuId;
            """;

        using var db = Connect();
        return await db.QueryAsync<StageDurationHeatmapDto>(sql);
    }

    public async Task<IEnumerable<ThroughputTrendDto>> GetThroughputTrendAsync()
    {
        const string sql = """
            SELECT
                Timestamp                                                                       AS Date,
                CAST(JSON_VALUE(PipelineMetrics,'$.throughputRowsPerSec') AS DECIMAL(10,2))   AS ThroughputRowsPerSec
            FROM telemetry.AdapterEvents
            WHERE EventType = 'IngestionCompleted'
              AND Timestamp >= DATEADD(DAY, -30, GETUTCDATE())
            ORDER BY Timestamp;
            """;

        using var db = Connect();
        return await db.QueryAsync<ThroughputTrendDto>(sql);
    }

    public async Task<IEnumerable<SlowestRunDto>> GetSlowestRunsAsync()
    {
        const string sql = """
            WITH RunData AS (
                SELECT
                    CorrelationId,
                    CuId,
                    MIN(Timestamp) AS StartedAt,
                    MAX(CASE WHEN EventType = 'BlobReceived'
                        THEN JSON_VALUE(BlobContext,'$.blobName') END)                       AS BlobName,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.totalProcessingDurationMs') AS INT) END) AS TotalProcessingDurationMs
                FROM telemetry.AdapterEvents
                GROUP BY CorrelationId, CuId
            ),
            Ranked AS (
                SELECT *, ROW_NUMBER() OVER (ORDER BY TotalProcessingDurationMs DESC) AS Rn
                FROM RunData
                WHERE TotalProcessingDurationMs IS NOT NULL
            )
            SELECT CorrelationId, CuId, BlobName, TotalProcessingDurationMs, StartedAt
            FROM Ranked
            WHERE Rn <= 10
            ORDER BY TotalProcessingDurationMs DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<SlowestRunDto>(sql);
    }

    public async Task<StageSplitDto> GetStageSplitAsync()
    {
        const string sql = """
            SELECT
                AVG(CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.parse')     AS FLOAT)) AS AvgParseMs,
                AVG(CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.map')       AS FLOAT)) AS AvgMapMs,
                AVG(CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.transform') AS FLOAT)) AS AvgTransformMs,
                AVG(CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.validate')  AS FLOAT)) AS AvgValidateMs,
                AVG(CAST(JSON_VALUE(PipelineMetrics,'$.stageDurations.load')      AS FLOAT)) AS AvgLoadMs
            FROM telemetry.AdapterEvents
            WHERE EventType = 'IngestionCompleted'
              AND JSON_VALUE(PipelineMetrics,'$.stageDurations.parse') IS NOT NULL;
            """;

        using var db = Connect();
        return await db.QuerySingleAsync<StageSplitDto>(sql);
    }

    public async Task<IEnumerable<MemoryTrendDto>> GetMemoryTrendAsync()
    {
        const string sql = """
            SELECT
                Timestamp,
                CAST(JSON_VALUE(HostContext,'$.memoryUsedMb') AS DECIMAL(10,2)) AS MemoryUsedMb,
                JSON_VALUE(HostContext,'$.hostName')                              AS HostName
            FROM telemetry.AdapterEvents
            WHERE EventType = 'IngestionCompleted'
              AND Timestamp >= DATEADD(DAY, -30, GETUTCDATE())
              AND HostContext IS NOT NULL
            ORDER BY Timestamp;
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
                    CuId,
                    CAST(JSON_VALUE(ValidationMetrics,'$.schemaMatchScore') AS DECIMAL(5,2)) AS SchemaMatchScore,
                    Timestamp,
                    ROW_NUMBER() OVER (PARTITION BY CuId ORDER BY Timestamp DESC) AS Rn
                FROM telemetry.AdapterEvents
                WHERE EventType = 'ValidationCompleted'
                  AND ValidationMetrics IS NOT NULL
            ),
            Latest AS (
                SELECT CuId, SchemaMatchScore AS LatestSchemaMatchScore, Timestamp AS LastValidationTime
                FROM Ranked WHERE Rn = 1
            ),
            Avg30 AS (
                SELECT
                    CuId,
                    AVG(CAST(JSON_VALUE(ValidationMetrics,'$.schemaMatchScore') AS FLOAT)) AS Avg30d
                FROM telemetry.AdapterEvents
                WHERE EventType = 'ValidationCompleted'
                  AND Timestamp >= DATEADD(DAY, -30, GETUTCDATE())
                GROUP BY CuId
            )
            SELECT
                l.CuId,
                l.LatestSchemaMatchScore,
                l.LastValidationTime,
                CASE
                    WHEN l.LatestSchemaMatchScore > ISNULL(a.Avg30d, l.LatestSchemaMatchScore) THEN 'up'
                    WHEN l.LatestSchemaMatchScore < ISNULL(a.Avg30d, l.LatestSchemaMatchScore) THEN 'down'
                    ELSE 'stable'
                END AS Trend
            FROM Latest l
            LEFT JOIN Avg30 a ON a.CuId = l.CuId
            ORDER BY l.CuId;
            """;

        using var db = Connect();
        return await db.QueryAsync<SchemaHealthRowDto>(sql);
    }

    public async Task<IEnumerable<ValidationFailureDto>> GetValidationFailuresAsync()
    {
        const string sql = """
            WITH FailedValidations AS (
                SELECT
                    CorrelationId,
                    CuId,
                    Timestamp,
                    CAST(JSON_VALUE(ValidationMetrics,'$.validationErrorsCount') AS INT)  AS ErrorCount,
                    JSON_QUERY(ValidationMetrics,'$.missingRequiredColumns')               AS MissingColumns,
                    JSON_QUERY(ValidationMetrics,'$.unknownColumnsDetected')               AS UnknownColumns
                FROM telemetry.AdapterEvents
                WHERE EventType = 'ValidationCompleted'
                  AND JSON_VALUE(ValidationMetrics,'$.validationPassed') = 'false'
                  AND Timestamp >= DATEADD(DAY, -30, GETUTCDATE())
            ),
            BlobNames AS (
                SELECT CorrelationId, JSON_VALUE(BlobContext,'$.blobName') AS BlobName
                FROM telemetry.AdapterEvents
                WHERE EventType = 'BlobReceived'
            )
            SELECT
                fv.CorrelationId,
                fv.CuId,
                bn.BlobName,
                fv.Timestamp,
                fv.ErrorCount,
                fv.MissingColumns,
                fv.UnknownColumns
            FROM FailedValidations fv
            LEFT JOIN BlobNames bn ON bn.CorrelationId = fv.CorrelationId
            ORDER BY fv.Timestamp DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<ValidationFailureDto>(sql);
    }

    public async Task<IEnumerable<SchemaDriftAlertDto>> GetSchemaDriftAlertsAsync()
    {
        const string sql = """
            WITH Latest AS (
                SELECT
                    CuId,
                    CAST(JSON_VALUE(ValidationMetrics,'$.schemaMatchScore') AS FLOAT) AS CurrentScore,
                    ROW_NUMBER() OVER (PARTITION BY CuId ORDER BY Timestamp DESC) AS Rn
                FROM telemetry.AdapterEvents
                WHERE EventType = 'ValidationCompleted'
                  AND ValidationMetrics IS NOT NULL
            ),
            Avg30 AS (
                SELECT
                    CuId,
                    AVG(CAST(JSON_VALUE(ValidationMetrics,'$.schemaMatchScore') AS FLOAT)) AS AvgScore30d
                FROM telemetry.AdapterEvents
                WHERE EventType = 'ValidationCompleted'
                  AND Timestamp >= DATEADD(DAY, -30, GETUTCDATE())
                GROUP BY CuId
            )
            SELECT
                l.CuId,
                l.CurrentScore,
                a.AvgScore30d,
                ISNULL(a.AvgScore30d, 0) - l.CurrentScore AS Drop
            FROM Latest l
            JOIN Avg30 a ON a.CuId = l.CuId
            WHERE l.Rn = 1
              AND (ISNULL(a.AvgScore30d, 0) - l.CurrentScore) > 5
            ORDER BY Drop DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<SchemaDriftAlertDto>(sql);
    }

    public async Task<IEnumerable<ColumnAnomalyDto>> GetColumnAnomaliesAsync()
    {
        const string sql = """
            SELECT j.[value] AS ColumnName, 'missing' AS AnomalyType, COUNT(*) AS OccurrenceCount
            FROM telemetry.AdapterEvents
            CROSS APPLY OPENJSON(JSON_QUERY(ValidationMetrics,'$.missingRequiredColumns')) j
            WHERE EventType = 'ValidationCompleted'
              AND JSON_QUERY(ValidationMetrics,'$.missingRequiredColumns') IS NOT NULL
              AND JSON_QUERY(ValidationMetrics,'$.missingRequiredColumns') != '[]'
              AND ISJSON(JSON_QUERY(ValidationMetrics,'$.missingRequiredColumns')) = 1
            GROUP BY j.[value]
            UNION ALL
            SELECT j.[value] AS ColumnName, 'unknown' AS AnomalyType, COUNT(*) AS OccurrenceCount
            FROM telemetry.AdapterEvents
            CROSS APPLY OPENJSON(JSON_QUERY(ValidationMetrics,'$.unknownColumnsDetected')) j
            WHERE EventType = 'ValidationCompleted'
              AND JSON_QUERY(ValidationMetrics,'$.unknownColumnsDetected') IS NOT NULL
              AND JSON_QUERY(ValidationMetrics,'$.unknownColumnsDetected') != '[]'
              AND ISJSON(JSON_QUERY(ValidationMetrics,'$.unknownColumnsDetected')) = 1
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
            WITH CollapsedRuns AS (
                SELECT
                    CorrelationId,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CASE WHEN JSON_VALUE(BusinessContext,'$.slaBreach') = 'true' THEN 1 ELSE 0 END END) AS SlaBreach,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.totalProcessingDurationMs') AS FLOAT) END) AS TotalDurationMs,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(BusinessContext,'$.slaThresholdMs') AS BIGINT) END) AS SlaThresholdMs,
                    MAX(CASE WHEN EventType IN ('RunCompleted','IngestionCompleted') THEN 1 ELSE NULL END) AS IsComplete
                FROM telemetry.AdapterEvents
                WHERE Timestamp >= DATEADD(MONTH, -1, GETUTCDATE())
                GROUP BY CorrelationId
            )
            SELECT
                COUNT(*)                                                                                AS TotalRunsThisMonth,
                SUM(CASE WHEN ISNULL(SlaBreach,0) = 0 THEN 1 ELSE 0 END)                              AS SlaMetCount,
                ISNULL(SUM(CASE WHEN ISNULL(SlaBreach,0) = 0 THEN 1 ELSE 0 END)
                        * 100.0 / NULLIF(COUNT(*),0), 0)                                               AS SlaMetPercent,
                SUM(CASE WHEN SlaBreach = 1 THEN 1 ELSE 0 END)                                        AS SlaBreachCount,
                ISNULL(SUM(CASE WHEN SlaBreach = 1 THEN 1 ELSE 0 END)
                        * 100.0 / NULLIF(COUNT(*),0), 0)                                               AS SlaBreachPercent,
                AVG(TotalDurationMs)                                                                    AS AvgDurationMs,
                MAX(SlaThresholdMs)                                                                     AS SlaThresholdMs
            FROM CollapsedRuns
            WHERE IsComplete IS NOT NULL;
            """;

        using var db = Connect();
        return await db.QuerySingleAsync<SlaSummaryDto>(sql);
    }

    public async Task<IEnumerable<SlaBreachDto>> GetSlaBreachesAsync()
    {
        const string sql = """
            WITH CollapsedRuns AS (
                SELECT
                    CorrelationId,
                    CuId,
                    MIN(Timestamp) AS RunTimestamp,
                    MAX(CASE WHEN EventType = 'BlobReceived'
                        THEN JSON_VALUE(BlobContext,'$.blobName') END)                      AS BlobName,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(PipelineMetrics,'$.totalProcessingDurationMs') AS INT) END) AS DurationMs,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CAST(JSON_VALUE(BusinessContext,'$.slaThresholdMs') AS INT) END) AS ThresholdMs,
                    MAX(CASE WHEN EventType = 'IngestionCompleted'
                        THEN CASE WHEN JSON_VALUE(BusinessContext,'$.slaBreach') = 'true' THEN 1 ELSE 0 END END) AS SlaBreach
                FROM telemetry.AdapterEvents
                GROUP BY CorrelationId, CuId
            )
            SELECT
                CorrelationId,
                CuId,
                BlobName,
                DurationMs,
                ThresholdMs,
                DurationMs - ThresholdMs AS OverageMs,
                RunTimestamp AS Timestamp
            FROM CollapsedRuns
            WHERE SlaBreach = 1
            ORDER BY RunTimestamp DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<SlaBreachDto>(sql);
    }

    public async Task<IEnumerable<ErrorSummaryDto>> GetErrorSummaryAsync()
    {
        const string sql = """
            SELECT
                JSON_VALUE(ErrorContext,'$.errorCode')  AS ErrorCode,
                COUNT(*)                                AS Count,
                STRING_AGG(DISTINCT CuId, ', ')         AS AffectedCus,
                MIN(Timestamp)                          AS FirstSeen,
                MAX(Timestamp)                          AS LastSeen
            FROM telemetry.AdapterEvents
            WHERE EventType IN ('IngestionFailed','RunFailed')
              AND JSON_VALUE(ErrorContext,'$.errorCode') IS NOT NULL
            GROUP BY JSON_VALUE(ErrorContext,'$.errorCode')
            ORDER BY Count DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<ErrorSummaryDto>(sql);
    }

    public async Task<IEnumerable<RetryRunDto>> GetRetryRunsAsync()
    {
        const string sql = """
            WITH RetryEvents AS (
                SELECT
                    CorrelationId,
                    CuId,
                    Timestamp,
                    CAST(JSON_VALUE(ErrorContext,'$.retryAttemptNumber') AS INT) AS RetryAttemptNumber,
                    JSON_VALUE(ErrorContext,'$.failedStage')                      AS FailedStage
                FROM telemetry.AdapterEvents
                WHERE EventType = 'RetryAttempted'
                  AND CAST(JSON_VALUE(ErrorContext,'$.retryAttemptNumber') AS INT) > 0
            ),
            BlobNames AS (
                SELECT CorrelationId, JSON_VALUE(BlobContext,'$.blobName') AS BlobName
                FROM telemetry.AdapterEvents
                WHERE EventType = 'BlobReceived'
            )
            SELECT
                re.CorrelationId,
                re.CuId,
                bn.BlobName,
                re.RetryAttemptNumber,
                re.FailedStage,
                re.Timestamp
            FROM RetryEvents re
            LEFT JOIN BlobNames bn ON bn.CorrelationId = re.CorrelationId
            ORDER BY re.RetryAttemptNumber DESC, re.Timestamp DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<RetryRunDto>(sql);
    }

    public async Task<IEnumerable<FailedRunDto>> GetFailedRunsAsync()
    {
        const string sql = """
            WITH FailedEvents AS (
                SELECT
                    CorrelationId,
                    CuId,
                    Timestamp,
                    JSON_VALUE(ErrorContext,'$.errorCode')    AS ErrorCode,
                    JSON_VALUE(ErrorContext,'$.errorMessage') AS ErrorMessage,
                    CAST(CASE WHEN JSON_VALUE(ErrorContext,'$.isRecoverable') = 'true' THEN 1 ELSE 0 END AS BIT) AS IsRecoverable
                FROM telemetry.AdapterEvents
                WHERE EventType IN ('IngestionFailed','RunFailed')
                  AND JSON_VALUE(ErrorContext,'$.isRecoverable') = 'false'
            ),
            BlobNames AS (
                SELECT CorrelationId, JSON_VALUE(BlobContext,'$.blobName') AS BlobName
                FROM telemetry.AdapterEvents
                WHERE EventType = 'BlobReceived'
            )
            SELECT
                fe.CorrelationId,
                fe.CuId,
                bn.BlobName,
                fe.ErrorCode,
                fe.ErrorMessage,
                fe.IsRecoverable,
                fe.Timestamp
            FROM FailedEvents fe
            LEFT JOIN BlobNames bn ON bn.CorrelationId = fe.CorrelationId
            ORDER BY fe.Timestamp DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<FailedRunDto>(sql);
    }
}
