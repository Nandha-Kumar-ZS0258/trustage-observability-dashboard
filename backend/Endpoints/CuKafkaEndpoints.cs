using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class CuKafkaEndpoints
{
    public static void MapCuKafkaEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cu");

        // GET /api/cu/{cuId}/step-timing-trend
        // Used by CU Detail page stacked-area chart — per-feed stage durations.
        group.MapGet("/{cuId}/step-timing-trend", async (
            FeedsRepository repo,
            string cuId) =>
            Results.Ok(await repo.GetCuStepTimingTrendAsync(cuId)));
    }
}
