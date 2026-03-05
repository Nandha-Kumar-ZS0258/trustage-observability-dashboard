using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class OverviewEndpoints
{
    public static void MapOverviewEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/observability");

        group.MapGet("/kpis/today", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetTodayKpisAsync()));

        group.MapGet("/feed/live", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetLiveFeedAsync()));

        group.MapGet("/cu/health", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetCuHealthAsync()));

        group.MapGet("/overview/timeline", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetTodayTimelineAsync()));

        group.MapGet("/overview/hourly-rows", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetHourlyRowsAsync()));
    }
}
