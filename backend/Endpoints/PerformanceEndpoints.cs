using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class PerformanceEndpoints
{
    public static void MapPerformanceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/observability/performance");

        group.MapGet("/stages", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetStageDurationHeatmapAsync()));

        group.MapGet("/throughput", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetThroughputTrendAsync()));

        group.MapGet("/slowest-runs", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetSlowestRunsAsync()));

        group.MapGet("/stage-split", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetStageSplitAsync()));

        group.MapGet("/memory", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetMemoryTrendAsync()));
    }
}
