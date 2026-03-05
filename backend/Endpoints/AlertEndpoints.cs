using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class AlertEndpoints
{
    public static void MapAlertEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/observability/alerts");

        group.MapGet("/sla", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetSlaSummaryAsync()));

        group.MapGet("/sla/breaches", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetSlaBreachesAsync()));

        group.MapGet("/errors", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetErrorSummaryAsync()));

        group.MapGet("/retries", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetRetryRunsAsync()));

        group.MapGet("/failed-runs", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetFailedRunsAsync()));
    }
}
