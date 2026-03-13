using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.SignalR;
using TruStage.Observability.Api.Hubs;
using TruStage.Observability.Api.Models;

namespace TruStage.Observability.Api.Services;

/// <summary>
/// Background service that tails `kubectl logs -f deployment/trustage-adaptor -n trustage`
/// and broadcasts each parsed log line to connected SignalR clients as a PipelineLogEventDto.
/// </summary>
public sealed class DemoTraceService : IHostedService, IDisposable
{
    private readonly IHubContext<TelemetryHub> _hub;
    private readonly ILogger<DemoTraceService> _logger;
    private CancellationTokenSource? _cts;
    private Task? _loopTask;

    // Matches the stage bracket prefix, e.g. "[Ingestion]", "[RulesValidation]"
    private static readonly Regex StageRegex = new(@"\[([A-Za-z]+)\]", RegexOptions.Compiled);

    // Maps logger-name fragments and message keywords to stage identifiers
    private static readonly Dictionary<string, string> StageMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Ingestion"]        = "ingestion",
        ["Transform"]        = "transform",
        ["SchemaValidation"] = "schemaValidation",
        ["RulesValidation"]  = "rulesValidation",
        ["Publishing"]       = "publishing",
    };

    public DemoTraceService(IHubContext<TelemetryHub> hub, ILogger<DemoTraceService> logger)
    {
        _hub    = hub;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _cts      = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _loopTask = RunLoopAsync(_cts.Token);
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_cts is not null)
        {
            await _cts.CancelAsync();
        }
        if (_loopTask is not null)
        {
            await _loopTask.WaitAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private async Task RunLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await StreamKubectlLogsAsync(ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[DemoTrace] kubectl stream error — restarting in 5 s");
            }

            if (!ct.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromSeconds(5), ct).ConfigureAwait(false);
            }
        }
    }

    private async Task StreamKubectlLogsAsync(CancellationToken ct)
    {
        var psi = new ProcessStartInfo("kubectl",
            "logs -f deployment/trustage-adaptor -n trustage --timestamps=false")
        {
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            UseShellExecute        = false,
            CreateNoWindow         = true,
        };

        using var process = new Process { StartInfo = psi };

        process.Start();
        _logger.LogInformation("[DemoTrace] kubectl stream started (PID {Pid})", process.Id);

        string? levelLine = null;

        while (!ct.IsCancellationRequested)
        {
            var line = await process.StandardOutput.ReadLineAsync(ct).ConfigureAwait(false);
            if (line is null) break;   // process exited

            if (string.IsNullOrWhiteSpace(line)) continue;

            // kubectl output interleaves two-line log entries:
            //   Line 1 (no leading spaces): "info: TruStage.Adaptor.Listeners.IngestionListener[0]"
            //   Line 2 (leading spaces):    "      [Ingestion] Downloaded ..."
            if (!line.StartsWith(' ') && !line.StartsWith('\t'))
            {
                // This is the level/source header line — buffer it
                levelLine = line;
                continue;
            }

            // This is the indented message line
            var message = line.Trim();
            var level   = ParseLevel(levelLine);
            var stage   = ParseStage(message, levelLine);

            var evt = new PipelineLogEventDto(stage, level, message, DateTimeOffset.UtcNow);

            await _hub.Clients.All.SendAsync("PipelineLog", evt, ct).ConfigureAwait(false);

            levelLine = null;
        }

        if (!process.HasExited)
        {
            process.Kill(entireProcessTree: true);
        }

        _logger.LogInformation("[DemoTrace] kubectl stream ended");
    }

    private static string ParseLevel(string? headerLine)
    {
        if (headerLine is null) return "info";
        if (headerLine.StartsWith("warn",  StringComparison.OrdinalIgnoreCase)) return "warn";
        if (headerLine.StartsWith("error", StringComparison.OrdinalIgnoreCase)) return "error";
        return "info";
    }

    private static string ParseStage(string message, string? headerLine)
    {
        // Check for blob-related log lines from Program.cs (no bracket prefix)
        if (message.Contains("BlobCreated event received", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("Published BlobDiscoveredEvent", StringComparison.OrdinalIgnoreCase))
        {
            return "blob";
        }

        // Try to match [StageName] bracket prefix in the message
        var match = StageRegex.Match(message);
        if (match.Success)
        {
            var key = match.Groups[1].Value;
            if (StageMap.TryGetValue(key, out var stage))
                return stage;
        }

        // Fall back to inferring from the logger source header
        if (headerLine is not null)
        {
            foreach (var (key, stage) in StageMap)
            {
                if (headerLine.Contains(key, StringComparison.OrdinalIgnoreCase))
                    return stage;
            }
        }

        return "system";
    }

    public void Dispose() => _cts?.Dispose();
}
