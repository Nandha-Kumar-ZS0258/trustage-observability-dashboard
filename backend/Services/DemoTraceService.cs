using Microsoft.AspNetCore.SignalR;
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
    private readonly Dictionary<string, RunMetrics> _activeRuns = new();

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
            _logger.LogWarning("[DemoTrace] ConnectionStrings:TruStage is not configured — Pipeline Trace polling disabled.");
            return Task.CompletedTask;
        }

        _cts      = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _pollTask = PollLoopAsync(connStr, _cts.Token);
        _logger.LogInformation("[DemoTrace] Polling telemetry.AdapterEvents every 1 s for live Pipeline Trace updates.");
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

                var fetchSince = watermark.AddSeconds(-2);
                var rows = await PipelineMessageBuilder
                    .FetchEventsAsync(connStr, fetchSince, ct)
                    .ConfigureAwait(false);

                DateTimeOffset newWatermark = watermark;

                foreach (var row in rows)
                {
                    if (ct.IsCancellationRequested) break;

                    if (!seen.Add(row.EventId)) continue;
                    if (row.CreatedAt <= watermark) continue;

                    PipelineMessageBuilder.UpdateMetrics(_activeRuns, row);

                    foreach (var (msgStage, msgLevel, msg) in PipelineMessageBuilder.BuildMessages(row, _activeRuns))
                    {
                        var evt = new PipelineLogEventDto(msgStage, msgLevel, msg, row.CreatedAt);
                        await _hub.Clients.All.SendAsync("PipelineLog", evt, ct).ConfigureAwait(false);
                    }

                    _logger.LogDebug("[DemoTrace] Broadcast {EventType} for CU {CuId}",
                        row.EventType, row.CuId);

                    if (row.EventType is "RunCompleted" or "RunFailed")
                    {
                        if (_activeRuns.TryGetValue(row.CorrelationId, out var m))
                        {
                            await _hub.Clients.All.SendAsync("PipelineSummary",
                                new PipelineSummaryDto(m.Submitted, m.Ingested, m.Blocked, m.Warnings), ct)
                                .ConfigureAwait(false);
                            _activeRuns.Remove(row.CorrelationId);
                        }
                    }

                    if (row.CreatedAt > newWatermark)
                        newWatermark = row.CreatedAt;
                }

                watermark = newWatermark;

                if (seen.Count > 200) seen.Clear();
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DemoTrace] Poll tick failed — retrying next interval.");
            }
        }
    }
}
