using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using TruStage.Observability.Api.Models.Exceptions;

namespace TruStage.Observability.Api.Repositories;

/// <summary>Filters for <see cref="ExceptionRepository.GetExceptionsAsync"/>.</summary>
public class ExceptionFilters
{
    public string?         CuId     { get; set; }
    public bool?           Resolved { get; set; }
    public string?         Step     { get; set; }
    public DateTimeOffset? From     { get; set; }
    public DateTimeOffset? To       { get; set; }
}

/// <summary>
/// Queries pipeline failure data from <c>kafka.DlqEvents</c>.
/// Also handles owner assignment and resolution tracking (PATCH operations).
/// StageName → step label mapping is applied at the API serialization layer, not here.
/// </summary>
public class ExceptionRepository(IConfiguration config)
{
    private IDbConnection Connect() =>
        new SqlConnection(config.GetConnectionString("TruStage"));

    // ─── Summary ──────────────────────────────────────────────────────────────
    /// <summary>
    /// Returns aggregate exception counts for the Feed Exceptions KPI cards.
    /// Source: <c>kafka.DlqEvents</c>.
    /// </summary>
    public async Task<ExceptionSummaryDto> GetSummaryAsync()
    {
        const string sql = """
            SELECT
                COUNT(*)                                                                 AS TotalAllTime,
                SUM(CASE WHEN ResolvedFlag = 0 THEN 1 ELSE 0 END)                       AS ActiveUnresolved,
                SUM(CASE
                    WHEN ResolvedFlag = 1
                     AND CAST(ResolvedAt AS DATE) = CAST(GETUTCDATE() AS DATE)
                    THEN 1 ELSE 0 END)                                                   AS ResolvedToday,
                SUM(CASE WHEN RecurrenceCount > 1 THEN 1 ELSE 0 END)                    AS RecurringCount
            FROM kafka.DlqEvents;
            """;

        using var db = Connect();
        return await db.QuerySingleAsync<ExceptionSummaryDto>(sql);
    }

    // ─── Exception List ───────────────────────────────────────────────────────

    /// <summary>
    /// Returns a filtered list of DLQ exceptions joined with CU names.
    /// Sources: <c>kafka.DlqEvents</c> JOIN <c>cfl.CU_Registry</c>.
    /// </summary>
    public async Task<IEnumerable<FeedExceptionDto>> GetExceptionsAsync(ExceptionFilters filters)
    {
        const string sql = """
            SELECT
                CAST(dlq.Id AS NVARCHAR(50))    AS ExceptionId,
                CAST(dlq.CorrelationId AS nvarchar(50)) AS FeedReferenceId,
                dlq.CuId,
                r.CU_Name                       AS CuName,
                ISNULL(dlq.TopicName, dlq.StageName)
                                                AS ExceptionCode,
                CASE
                    WHEN ISJSON(dlq.Payload) = 1
                    THEN ISNULL(
                            JSON_VALUE(dlq.Payload, '$.message'),
                            ISNULL(JSON_VALUE(dlq.Payload, '$.error'), LEFT(dlq.Payload, 500))
                         )
                    ELSE LEFT(ISNULL(dlq.Payload, ''), 500)
                END                             AS ExceptionMessage,
                dlq.StageName                   AS FailedStep,
                3                               AS RetryCount,
                dlq.Payload                     AS RawPayload,
                dlq.ResolvedFlag,
                dlq.ResolvedAt,
                dlq.ResolvedById,
                dlq.OwnerId,
                dlq.OwnerNote,
                dlq.OwnerNoteAt,
                dlq.OccurredAt                  AS FirstOccurredAt,
                dlq.RecurrenceCount
            FROM kafka.DlqEvents dlq
            JOIN cfl.CU_Registry r ON r.CU_ID = dlq.CuId
            WHERE (@CuId     IS NULL OR dlq.CuId        = @CuId)
              AND (@Resolved IS NULL OR dlq.ResolvedFlag = @Resolved)
              AND (@Step     IS NULL OR dlq.StageName    = @Step)
              AND (@From     IS NULL OR dlq.OccurredAt  >= @From)
              AND (@To       IS NULL OR dlq.OccurredAt  <= @To)
            ORDER BY dlq.OccurredAt DESC;
            """;

        using var db = Connect();
        return await db.QueryAsync<FeedExceptionDto>(sql, new
        {
            filters.CuId,
            Resolved = filters.Resolved.HasValue ? (object)(filters.Resolved.Value ? 1 : 0) : null,
            filters.Step,
            filters.From,
            filters.To
        });
    }

    // ─── Single Exception ─────────────────────────────────────────────────────

    /// <summary>
    /// Returns a single DLQ exception by its primary key.
    /// Source: <c>kafka.DlqEvents</c> JOIN <c>cfl.CU_Registry</c>.
    /// </summary>
    public async Task<FeedExceptionDto?> GetExceptionByIdAsync(int id)
    {
        const string sql = """
            SELECT
                CAST(dlq.Id AS NVARCHAR(50))    AS ExceptionId,
                CAST(dlq.CorrelationId AS nvarchar(50)) AS FeedReferenceId,
                dlq.CuId,
                r.CU_Name                       AS CuName,
                ISNULL(dlq.TopicName, dlq.StageName)
                                                AS ExceptionCode,
                CASE
                    WHEN ISJSON(dlq.Payload) = 1
                    THEN ISNULL(
                            JSON_VALUE(dlq.Payload, '$.message'),
                            ISNULL(JSON_VALUE(dlq.Payload, '$.error'), LEFT(dlq.Payload, 500))
                         )
                    ELSE LEFT(ISNULL(dlq.Payload, ''), 500)
                END                             AS ExceptionMessage,
                dlq.StageName                   AS FailedStep,
                3                               AS RetryCount,
                dlq.Payload                     AS RawPayload,
                dlq.ResolvedFlag,
                dlq.ResolvedAt,
                dlq.ResolvedById,
                dlq.OwnerId,
                dlq.OwnerNote,
                dlq.OwnerNoteAt,
                dlq.OccurredAt                  AS FirstOccurredAt,
                dlq.RecurrenceCount
            FROM kafka.DlqEvents dlq
            JOIN cfl.CU_Registry r ON r.CU_ID = dlq.CuId
            WHERE dlq.Id = @id;
            """;

        using var db = Connect();
        return await db.QuerySingleOrDefaultAsync<FeedExceptionDto>(sql, new { id });
    }

    // ─── Patch Operations ─────────────────────────────────────────────────────

    /// <summary>
    /// Assigns an owner to a DLQ exception (kafka.DlqEvents.OwnerId).
    /// Returns true if the row was found and updated.
    /// </summary>
    public async Task<bool> PatchOwnerAsync(int id, string ownerId)
    {
        const string sql = """
            UPDATE kafka.DlqEvents
            SET OwnerId = @ownerId
            WHERE Id = @id;
            """;

        using var db = Connect();
        var rows = await db.ExecuteAsync(sql, new { id, ownerId });
        return rows > 0;
    }

    /// <summary>
    /// Saves an investigation note against a DLQ exception (kafka.DlqEvents.OwnerNote).
    /// Also stamps OwnerNoteAt with the current UTC time.
    /// Returns true if the row was found and updated.
    /// </summary>
    public async Task<bool> PatchNoteAsync(int id, string note)
    {
        const string sql = """
            UPDATE kafka.DlqEvents
            SET OwnerNote   = @note,
                OwnerNoteAt = GETUTCDATE()
            WHERE Id = @id;
            """;

        using var db = Connect();
        var rows = await db.ExecuteAsync(sql, new { id, note });
        return rows > 0;
    }

    /// <summary>
    /// Marks a DLQ exception as resolved (ResolvedFlag = 1).
    /// Stamps ResolvedAt and ResolvedById. Returns true if found and updated.
    /// </summary>
    public async Task<bool> ResolveAsync(int id, string resolvedById)
    {
        const string sql = """
            UPDATE kafka.DlqEvents
            SET ResolvedFlag  = 1,
                ResolvedAt    = GETUTCDATE(),
                ResolvedById  = @resolvedById
            WHERE Id = @id;
            """;

        using var db = Connect();
        var rows = await db.ExecuteAsync(sql, new { id, resolvedById });
        return rows > 0;
    }

    // ─── Unresolved Count ─────────────────────────────────────────────────────

    /// <summary>
    /// Returns the count of unresolved exceptions for the sidebar badge.
    /// Source: <c>kafka.DlqEvents</c>.
    /// </summary>
    public async Task<int> GetUnresolvedCountAsync()
    {
        const string sql = """
            SELECT COUNT(*) FROM kafka.DlqEvents WHERE ResolvedFlag = 0;
            """;

        using var db = Connect();
        return await db.ExecuteScalarAsync<int>(sql);
    }
}
