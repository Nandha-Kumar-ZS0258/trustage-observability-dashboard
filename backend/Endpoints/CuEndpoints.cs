using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class CuEndpoints
{
    public static void MapCuEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/observability/cu");

        group.MapGet("/{cuId}", async (ObservabilityRepository repo, string cuId) =>
        {
            var summary = await repo.GetCuSummaryAsync(cuId);
            return summary is null ? Results.NotFound() : Results.Ok(summary);
        });

        group.MapGet("/{cuId}/duration-trend", async (
            ObservabilityRepository repo, string cuId, int days = 30) =>
            Results.Ok(await repo.GetCuDurationTrendAsync(cuId, days)));

        group.MapGet("/{cuId}/daily-volume", async (
            ObservabilityRepository repo, string cuId) =>
            Results.Ok(await repo.GetCuDailyVolumeAsync(cuId)));

        group.MapGet("/{cuId}/validation-trend", async (
            ObservabilityRepository repo, string cuId) =>
            Results.Ok(await repo.GetCuValidationTrendAsync(cuId)));

        group.MapGet("/{cuId}/runs", async (
            ObservabilityRepository repo, string cuId) =>
            Results.Ok(await repo.GetCuRecentRunsAsync(cuId)));

        group.MapGet("/{cuId}/errors", async (
            ObservabilityRepository repo, string cuId) =>
            Results.Ok(await repo.GetCuErrorHistoryAsync(cuId)));
    }
}
