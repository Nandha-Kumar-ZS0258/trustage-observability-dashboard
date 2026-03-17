using System.Data;
using Dapper;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.SqlClient;
using TruStage.Observability.Api.Hubs;
using TruStage.Observability.Api.Models;

namespace TruStage.Observability.Api.Services;

/// <summary>
/// Background service that polls <c>telemetry.AdapterEvents</c> every second and
/// broadcasts new rows to connected SignalR clients as <see cref="PipelineLogEventDto"/>.
///
/// Works whether the adaptor runs locally or in k8s — both write to the same SQL
/// database, so no tunnels or third-party tools are required.
///
/// Watermark strategy: tracks the latest <c>CreatedAt</c> seen. Each tick fetches
/// rows where <c>CreatedAt > watermark - 2s</c> (small lookback to handle late writes)
/// and deduplicates by <c>EventId</c> so nothing is broadcast twice.
/// </summary>
public sealed class DemoTraceService : IHostedService, IDisposable
{
    private static readonly Dictionary<string, string> EventTypeToStage =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["BlobReceived"]        = "blob",
            ["IngestionStarted"]    = "ingestion",
            ["IngestionFailed"]     = "ingestion",
            ["MappingApplied"]      = "transform",
            ["SchemaDetected"]      = "schemaValidation",
            ["ValidationCompleted"] = "rulesValidation",
            ["IngestionCompleted"]  = "publishing",
            ["RunCompleted"]        = "publishing",
            ["RunFailed"]           = "system",
            ["RetryAttempted"]      = "system",
        };

    private readonly IHubContext<TelemetryHub> _hub;
    private readonly IConfiguration            _config;
    private readonly ILogger<DemoTraceService> _logger;
    private CancellationTokenSource?           _cts;
    private Task?                              _pollTask;

    public DemoTraceService(
        IHubContext<TelemetryHub>  hub,
        IConfiguration             config,
        ILogger<DemoTraceService>  logger)
    {
        _hub    = hub;
        _config = config;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        var connStr = _config.GetConnectionString("TruStage");
        if (string.IsNullOrWhiteSpace(connStr))
        {
            _logger.LogWarning("[DemoTrace] ConnectionStrings:TruStage is not configured — Demo tab polling disabled.");
            return Task.CompletedTask;
        }

        _cts      = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _pollTask = PollLoopAsync(connStr, _cts.Token);
        _logger.LogInformation("[DemoTrace] Polling telemetry.AdapterEvents every 1 s for live Demo tab updates.");
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_cts is null) return;
        await _cts.CancelAsync().ConfigureAwait(false);
        try { await (_pollTask ?? Task.CompletedTask).ConfigureAwait(false); }
        catch (OperationCanceledException) { }
    }

    public void Dispose() => _cts?.Dispose();

    // ── Poll loop ─────────────────────────────────────────────────────────────

    private async Task PollLoopAsync(string connStr, CancellationToken ct)
    {
        int pollMs = _config.GetValue("Demo:PollIntervalMs", 1_000);

        // Start watermark at "now" so old history is not replayed on startup.
        // Subtract 1 s to catch any events written in the same second as startup.
        DateTimeOffset watermark = DateTimeOffset.UtcNow.AddSeconds(-1);

        // Tracks EventIds already broadcast within the lookback window (prevents duplicates
        // when two rows share the same CreatedAt millisecond and fall within the 2-s overlap).
        var seen = new HashSet<Guid>();

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(pollMs, ct).ConfigureAwait(false);

                // Fetch from (watermark - 2 s) to catch any rows that were committed
                // slightly late relative to the previous tick.
                var fetchSince = watermark.AddSeconds(-2);
                var rows = await FetchNewEventsAsync(connStr, fetchSince, ct).ConfigureAwait(false);

                DateTimeOffset newWatermark = watermark;

                foreach (var row in rows)
                {
                    if (ct.IsCancellationRequested) break;

                    // Skip rows already broadcast (within the 2-s lookback overlap)
                    if (!seen.Add(row.EventId)) continue;

                    // Skip rows older than or equal to the current watermark — these are
                    // the overlap rows that weren't in seen yet but are not new
                    if (row.CreatedAt <= watermark) continue;

                    string stage = EventTypeToStage.TryGetValue(row.EventType, out var s) ? s : "system";
                    string level = row.EventType is "RunFailed" or "IngestionFailed" ? "error"
                                 : row.EventType is "RetryAttempted"                 ? "warn"
                                 : "info";

                    var evt = new PipelineLogEventDto(stage, level, BuildMessage(row), row.CreatedAt);
                    await _hub.Clients.All.SendAsync("PipelineLog", evt, ct).ConfigureAwait(false);

                    _logger.LogDebug("[DemoTrace] Broadcast {EventType} for CU {CuId} → {Stage}",
                        row.EventType, row.CuId, stage);

                    if (row.CreatedAt > newWatermark)
                        newWatermark = row.CreatedAt;
                }

                watermark = newWatermark;

                // Prevent unbounded growth — clear when large; the CreatedAt check above
                // handles correctness even after a clear, so this is safe.
                if (seen.Count > 200)
                    seen.Clear();
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DemoTrace] Poll tick failed — retrying next interval.");
            }
        }
    }

    private static async Task<IEnumerable<AdapterEventRow>> FetchNewEventsAsync(
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
        return await db.QueryAsync<AdapterEventRow>(sql, new { since }, commandTimeout: 5)
            .ConfigureAwait(false);
    }

    // ── Message builder ───────────────────────────────────────────────────────

    private static string BuildMessage(AdapterEventRow row)
    {
        string cu   = string.IsNullOrEmpty(row.CuId) ? "unknown" : row.CuId;
        string corr = string.IsNullOrEmpty(row.CorrelationId) ? ""
                    : $" [{row.CorrelationId[..Math.Min(8, row.CorrelationId.Length)]}…]";

        return row.EventType switch
        {
            "BlobReceived" when JsonTryGet(row.BlobContext, "blobName") is { } bn
                => $"[blob] Blob received: {bn} for CU {cu}{corr}",

            "BlobReceived"       => $"[blob] Blob trigger received for CU {cu}{corr}",
            "IngestionStarted"   => $"[ingestion] Ingestion started for CU {cu}{corr}",
            "MappingApplied"     => $"[transform] Mapping applied for CU {cu}{corr}",
            "SchemaDetected"     => $"[schemaValidation] Schema validation passed for CU {cu}{corr}",

            "ValidationCompleted" when JsonTryGet(row.ValidationMetrics, "validationErrorsCount") is { } ec
                => $"[rulesValidation] Rules validation complete — {ec} error(s) for CU {cu}{corr}",

            "ValidationCompleted" => $"[rulesValidation] Rules validation complete for CU {cu}{corr}",

            "IngestionCompleted" when JsonTryGet(row.PipelineMetrics, "rowsProcessed") is { } rp
                => $"[publishing] Ingestion completed — {rp} rows processed for CU {cu}{corr}",

            "IngestionCompleted" => $"[publishing] Ingestion completed for CU {cu}{corr}",
            "RunCompleted"       => $"[publishing] Run completed for CU {cu}{corr}",

            "RunFailed" when JsonTryGet(row.ErrorContext, "errorMessage") is { } em
                => $"[system] Run failed for CU {cu}: {em}{corr}",

            "RunFailed"       => $"[system] Run failed for CU {cu}{corr}",
            "IngestionFailed" => $"[ingestion] Ingestion failed for CU {cu}{corr}",
            "RetryAttempted"  => $"[system] Retry attempted for CU {cu}{corr}",
            _                 => $"[system] {row.EventType} for CU {cu}{corr}",
        };
    }

    // Extracts a scalar string value from a JSON column without a full parse.
    private static string? JsonTryGet(string? json, string key)
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

    // ── DB row model ──────────────────────────────────────────────────────────

    private sealed class AdapterEventRow
    {
        public Guid           EventId           { get; set; }
        public string         EventType         { get; set; } = "";
        public string         CuId              { get; set; } = "";
        public string         CorrelationId     { get; set; } = "";
        public DateTimeOffset CreatedAt         { get; set; }
        public string?        BlobContext       { get; set; }
        public string?        PipelineMetrics   { get; set; }
        public string?        ValidationMetrics { get; set; }
        public string?        ErrorContext      { get; set; }
    }
}
