using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class AksEndpoints
{
    public static void MapAksEndpoints(this WebApplication app)
    {
        // ── KPI summary ───────────────────────────────────────────────────────
        app.MapGet("/api/cluster/summary", async (AksRepository repo) =>
            Results.Ok(await repo.GetAksKpisAsync()));

        // ── Adaptor pod health ────────────────────────────────────────────────
        app.MapGet("/api/cluster/adaptors", async (AksRepository repo) =>
            Results.Ok(await repo.GetAdaptorHealthAsync()));

        app.MapGet("/api/cluster/adaptors/{adaptorId}", async (string adaptorId, AksRepository repo) =>
        {
            var adaptor = await repo.GetAdaptorHealthByIdAsync(adaptorId);
            return adaptor is null ? Results.NotFound() : Results.Ok(adaptor);
        });

        // ── Cluster events ────────────────────────────────────────────────────
        app.MapGet("/api/cluster/events", async (AksRepository repo, int hours = 24) =>
            Results.Ok(await repo.GetClusterEventsAsync(hours)));

        app.MapGet("/api/cluster/events/summary", async (AksRepository repo, int hours = 24) =>
            Results.Ok(await repo.GetEventSummaryAsync(hours)));

        // ── Node health ───────────────────────────────────────────────────────
        app.MapGet("/api/cluster/nodes", async (AksRepository repo) =>
            Results.Ok(await repo.GetNodeHealthAsync()));

        // ── Adaptor drill-down ────────────────────────────────────────────────
        app.MapGet("/api/cluster/adaptors/{adaptorId}/history", async (string adaptorId, AksRepository repo, int hours = 24, int days = 7) =>
            Results.Ok(new
            {
                uptime        = await repo.GetAdaptorUptimeAsync(adaptorId, hours),
                restartTrend  = await repo.GetRestartTrendAsync(adaptorId, days),
                probeTimeline = await repo.GetProbeFailureTimelineAsync(adaptorId, hours),
            }));

        app.MapGet("/api/cluster/adaptors/{adaptorId}/events", async (string adaptorId, AksRepository repo, int hours = 24) =>
            Results.Ok(await repo.GetAdaptorEventsAsync(adaptorId, hours)));

        // ── Adaptor run logs ──────────────────────────────────────────────────
        app.MapGet("/api/cluster/runs", async (AksRepository repo, int limit = 50) =>
            Results.Ok(await repo.GetRecentRunsAsync(limit)));

        app.MapGet("/api/cluster/runs/{batchId}", async (string batchId, AksRepository repo) =>
        {
            var ctx = await repo.GetRunContextAsync(batchId);
            return ctx is null ? Results.NotFound() : Results.Ok(ctx);
        });
    }
}
