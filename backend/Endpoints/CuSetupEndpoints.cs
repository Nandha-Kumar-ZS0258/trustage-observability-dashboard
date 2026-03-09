using TruStage.Observability.Api.Models;
using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class CuSetupEndpoints
{
    public static void MapCuSetupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/observability/cu-setup");

        group.MapGet("/kpis", async (CuConfigurationRepository repo) =>
            Results.Ok(await repo.GetKpisAsync()));

        group.MapGet("/", async (
            CuConfigurationRepository repo,
            string? status,
            string? environment,
            string? ownerTeam,
            string? adapterId) =>
        {
            var filters = new CuDirectoryFilters
            {
                Status      = status,
                Environment = environment,
                OwnerTeam   = ownerTeam,
                AdapterId   = adapterId,
            };
            return Results.Ok(await repo.GetDirectoryAsync(filters));
        });

        group.MapGet("/drift", async (CuConfigurationRepository repo) =>
            Results.Ok(await repo.GetDriftAsync()));

        group.MapGet("/{cuId}/drift", async (CuConfigurationRepository repo, string cuId) =>
            Results.Ok(await repo.GetDriftAsync(cuId)));

        group.MapGet("/onboarding-timeline", async (CuConfigurationRepository repo) =>
            Results.Ok(await repo.GetOnboardingTimelineAsync()));

        group.MapGet("/adapter-spread", async (CuConfigurationRepository repo) =>
            Results.Ok(await repo.GetAdapterSpreadAsync()));

        group.MapGet("/mapping-spread", async (CuConfigurationRepository repo) =>
            Results.Ok(await repo.GetMappingSpreadAsync()));

        group.MapGet("/first-delivery-gap", async (CuConfigurationRepository repo) =>
            Results.Ok(await repo.GetFirstDeliveryGapAsync()));

        group.MapGet("/owner-teams", async (CuConfigurationRepository repo) =>
            Results.Ok(await repo.GetOwnerTeamsAsync()));
    }
}
