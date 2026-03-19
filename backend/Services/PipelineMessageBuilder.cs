using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using TruStage.Observability.Api.Models;

namespace TruStage.Observability.Api.Services;

/// <summary>
/// Stateless helper that converts <see cref="AdapterEventRow"/> records into
/// human-readable <see cref="PipelineLogEventDto"/> lines, mirroring the
/// adaptor's console output (same detail as <c>kubectl logs</c>).
///
/// Used by both <see cref="DemoTraceService"/> (live polling) and the
/// <c>GET /api/demo/history</c> endpoint (batch history queries).
/// </summary>
public static class PipelineMessageBuilder
{
    // ── Data access ───────────────────────────────────────────────────────────

    /// <summary>
    /// Fetches <see cref="AdapterEventRow"/> records created after <paramref name="since"/>
    /// from <c>telemetry.AdapterEvents</c>, ordered by <c>CreatedAt</c>.
    /// </summary>
    public static async Task<IEnumerable<AdapterEventRow>> FetchEventsAsync(
        string connStr, DateTimeOffset since, CancellationToken ct)
    {
        const string sql = """
            SELECT
                EventId,
                EventType,
                CuId,
                CorrelationId,
                CreatedAt,
                BlobContext,
                PipelineMetrics,
                ValidationMetrics,
                ErrorContext
            FROM telemetry.AdapterEvents
            WHERE CreatedAt > @since
            ORDER BY CreatedAt
            """;

        using IDbConnection db = new SqlConnection(connStr);
        return await db.QueryAsync<AdapterEventRow>(sql, new { since }, commandTimeout: 10)
            .ConfigureAwait(false);
    }

    // ── Batch (history) ───────────────────────────────────────────────────────

    /// <summary>
    /// Converts a batch of rows into log events.  Does a first pass to
    /// aggregate per-run metrics so messages have the correct counts even
    /// when rows arrive out of order.
    /// </summary>
    public static IEnumerable<PipelineLogEventDto> BuildFromRows(
        IReadOnlyList<AdapterEventRow> rows)
    {
        // First pass: collect per-run metrics
        var metrics = new Dictionary<string, RunMetrics>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
            UpdateMetrics(metrics, row);

        // Second pass: emit messages in chronological order
        foreach (var row in rows)
            foreach (var (stage, level, msg) in BuildMessages(row, metrics))
                yield return new PipelineLogEventDto(stage, level, msg, row.CreatedAt);
    }

    // ── Incremental (live) ────────────────────────────────────────────────────

    /// <summary>
    /// Builds log messages for a single row using an already-maintained
    /// metrics dictionary (updated incrementally by <see cref="DemoTraceService"/>).
    /// </summary>
    public static IEnumerable<(string Stage, string Level, string Message)> BuildMessages(
        AdapterEventRow row,
        IReadOnlyDictionary<string, RunMetrics> metrics)
    {
        string cu   = string.IsNullOrEmpty(row.CuId) ? "unknown" : row.CuId;
        string corr = string.IsNullOrEmpty(row.CorrelationId) ? ""
                    : $" [{row.CorrelationId[..Math.Min(8, row.CorrelationId.Length)]}…]";

        metrics.TryGetValue(row.CorrelationId ?? "", out var m);
        m ??= new RunMetrics(0, 0, 0, 0);

        switch (row.EventType)
        {
            case "BlobReceived":
            {
                var bn = JsonTryGet(row.BlobContext, "blobName") ?? "unknown.json";
                yield return ("blob", "info", $"[Program] BlobCreated event received. File={bn} CuId={cu}{corr}");
                yield return ("blob", "info", $"[Program] Published BlobDiscoveredEvent to topic {cu.ToLower()}_ingestion_listener");
                yield break;
            }

            case "IngestionStarted":
            {
                var dlBlob = m.BlobName is { Length: > 0 } b ? b
                           : JsonTryGet(row.BlobContext, "blobName") ?? "file.json";
                yield return ("ingestion", "info", $"[IngestionListener] Downloaded {dlBlob} for CU {cu}{corr}");
                yield return ("ingestion", "info", $"[IngestionListener] Ingestion started for CU {cu}{corr}");
                yield break;
            }

            case "MappingApplied":
            {
                var read      = JsonTryGet(row.PipelineMetrics, "rowsRead")      ?? JsonTryGet(row.PipelineMetrics, "rowsProcessed") ?? "0";
                var processed = JsonTryGet(row.PipelineMetrics, "rowsProcessed") ?? "0";
                var failed    = JsonTryGet(row.PipelineMetrics, "rowsFailed")    ?? "0";
                yield return ("ingestion", "info", $"[CreditUnionJsonAdapter] Adapter [{cu}] deserialized {read} members from file");
                yield return ("ingestion", "info", $"[CreditUnionJsonAdapter] Adapter [{cu}] finished: {processed} members, {failed} errors");
                yield return ("transform", "info", $"[TransformListener] Mapping applied for CU {cu}: {processed} members, {failed} errors{corr}");
                yield return ("ingestion", "info", $"[IngestionListener] CU {cu} processed successfully (attempt 1/3)");
                yield return ("transform", "info", $"[TransformListener] CU {cu} processed successfully (attempt 1/3)");
                yield break;
            }

            case "SchemaDetected":
            {
                var members = JsonTryGet(row.PipelineMetrics, "rowsProcessed") ?? JsonTryGet(row.PipelineMetrics, "rowsRead") ?? "?";
                yield return ("schemaValidation", "info", $"[SchemaValidationListener] [SchemaValidation] CU {cu} passed schema validation ({members} members){corr}");
                yield return ("schemaValidation", "info", $"[SchemaValidationListener] CU {cu} processed successfully (attempt 1/3)");
                yield break;
            }

            case "ValidationCompleted":
            {
                int.TryParse(JsonTryGet(row.ValidationMetrics, "validationErrorsCount"),  out var errors);
                int.TryParse(JsonTryGet(row.ValidationMetrics, "validationWarningsCount"), out var warnings);
                string gate2  = errors > 0 ? "FAIL" : "PASS";
                string gLevel = errors > 0 ? "warn" : "info";
                yield return ("rulesValidation", gLevel,
                    $"[RulesValidationListener] Rules validation complete — Gate1=PASS Gate2={gate2} | blocked={errors} warnings={warnings} for CU {cu}{corr}");
                if (errors > 0)
                    yield return ("rulesValidation", "warn",
                        $"[RulesValidationListener] [RulesValidation] CU {cu}: {errors} hard failure(s) — bad records stripped, clean records will proceed");
                if (warnings > 0)
                    yield return ("rulesValidation", "warn",
                        $"[RulesValidationListener] [RulesValidation] CU {cu}: {warnings} advisory warning(s)");
                yield return ("rulesValidation", "info", $"[RulesValidationListener] CU {cu} processed successfully (attempt 1/3)");
                yield break;
            }

            case "IngestionCompleted":
            {
                var rw     = JsonTryGet(row.PipelineMetrics, "rowsWrittenToTarget")
                          ?? JsonTryGet(row.PipelineMetrics, "rowsProcessed") ?? "0";
                var durMs  = JsonTryGet(row.PipelineMetrics, "totalProcessingDurationMs") ?? "0";
                string gate3   = m.Blocked > 0 ? "FAIL" : "PASS";
                string overall = m.Blocked > 0 ? "Failed" : "Passed";
                string pubLvl  = m.Blocked > 0 ? "warn" : "info";
                yield return ("publishing", "info",  $"[PublishingListener] [Publishing] CU {cu}: persisted {rw} members{corr}");
                yield return ("publishing", pubLvl,  $"[PublishingListener] [Publishing] CU {cu}: Gate3={gate3} | Overall={overall} | Errors={m.Blocked} Warnings={m.Warnings}");
                if (!string.IsNullOrEmpty(m.BlobName))
                    yield return ("publishing", "info", $"[PublishingListener] [Publishing] CU {cu}: archived blob {m.BlobName}");
                yield return ("publishing", "info",  $"[PublishingListener] CU {cu} processed successfully (attempt 1/3, duration {durMs}ms)");
                yield break;
            }

            case "RunCompleted":
                yield return ("publishing", "info", $"[Program] Run completed for CU {cu}{corr}");
                yield break;

            case "RunFailed":
            {
                var em = JsonTryGet(row.ErrorContext, "errorMessage") ?? "unknown error";
                yield return ("system", "error", $"[Program] Run failed for CU {cu}: {em}{corr}");
                yield break;
            }

            case "IngestionFailed":
            {
                var em  = JsonTryGet(row.ErrorContext, "errorMessage");
                var msg = string.IsNullOrEmpty(em)
                    ? $"[IngestionListener] Ingestion failed for CU {cu}{corr}"
                    : $"[IngestionListener] Ingestion failed for CU {cu}: {em}{corr}";
                yield return ("ingestion", "error", msg);
                yield break;
            }

            case "RetryAttempted":
                yield return ("system", "warn", $"[Program] Retry attempted for CU {cu}{corr}");
                yield break;

            default:
                yield return ("system", "info", $"[System] {row.EventType} for CU {cu}{corr}");
                yield break;
        }
    }

    // ── Metrics accumulator ───────────────────────────────────────────────────

    public static void UpdateMetrics(Dictionary<string, RunMetrics> runs, AdapterEventRow row)
    {
        if (string.IsNullOrEmpty(row.CorrelationId)) return;
        runs.TryGetValue(row.CorrelationId, out var m);
        m ??= new RunMetrics(0, 0, 0, 0);

        m = row.EventType switch
        {
            "BlobReceived" when JsonTryGet(row.BlobContext, "blobName") is { } bn
                => m with { BlobName = bn },

            "MappingApplied" when JsonTryGet(row.PipelineMetrics, "rowsProcessed") is { } rp
                => m with { Submitted = int.TryParse(rp, out var n) ? n : m.Submitted },

            "ValidationCompleted"
                => m with {
                    Blocked  = int.TryParse(JsonTryGet(row.ValidationMetrics, "validationErrorsCount"),  out var b) ? b : m.Blocked,
                    Warnings = int.TryParse(JsonTryGet(row.ValidationMetrics, "validationWarningsCount"), out var w) ? w : m.Warnings,
                },

            "IngestionCompleted" when JsonTryGet(row.PipelineMetrics, "rowsWrittenToTarget") is { } rw
                => m with { Ingested = int.TryParse(rw, out var n) ? n : m.Ingested },

            "IngestionCompleted" when JsonTryGet(row.PipelineMetrics, "rowsProcessed") is { } rp
                => m with { Ingested = int.TryParse(rp, out var n) ? n : m.Ingested },

            _ => m
        };

        runs[row.CorrelationId] = m;
    }

    // ── JSON field extractor ──────────────────────────────────────────────────

    internal static string? JsonTryGet(string? json, string key)
    {
        if (string.IsNullOrEmpty(json)) return null;
        string search = $"\"{key}\":";
        int idx = json.IndexOf(search, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return null;
        idx += search.Length;
        while (idx < json.Length && json[idx] == ' ') idx++;
        if (idx >= json.Length) return null;
        if (json[idx] == '"')
        {
            int start = ++idx;
            while (idx < json.Length && !(json[idx] == '"' && json[idx - 1] != '\\')) idx++;
            return json[start..idx];
        }
        int numStart = idx;
        while (idx < json.Length && json[idx] != ',' && json[idx] != '}' && json[idx] != ' ') idx++;
        return json[numStart..idx];
    }
}
