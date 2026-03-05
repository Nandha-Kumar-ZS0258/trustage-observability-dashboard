using TruStage.Observability.Api.Models;
using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class RunEndpoints
{
    public static void MapRunEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/observability");

        group.MapGet("/runs", async (
            ObservabilityRepository repo,
            string? cuId,
            string? fileType,
            DateTimeOffset? from,
            DateTimeOffset? to,
            bool? slaBreach,
            string? status) =>
        {
            var filters = new RunFilters { CuId = cuId, FileType = fileType, From = from, To = to, SlaBreach = slaBreach, Status = status };
            return Results.Ok(await repo.GetRunsAsync(filters));
        });

        group.MapGet("/runs/{correlationId:guid}", async (
            ObservabilityRepository repo,
            Guid correlationId) =>
        {
            var detail = await repo.GetRunDetailAsync(correlationId);
            return detail is null ? Results.NotFound() : Results.Ok(detail);
        });
    }
}
