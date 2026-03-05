using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class ValidationEndpoints
{
    public static void MapValidationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/observability/validation");

        group.MapGet("/health", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetSchemaHealthAsync()));

        group.MapGet("/failures", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetValidationFailuresAsync()));

        group.MapGet("/drift-alerts", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetSchemaDriftAlertsAsync()));

        group.MapGet("/column-anomalies", async (ObservabilityRepository repo) =>
            Results.Ok(await repo.GetColumnAnomaliesAsync()));
    }
}
