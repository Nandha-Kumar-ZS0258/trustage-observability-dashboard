using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class HistoryEndpoints
{
    public static void MapHistoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/history");

        // GET /api/history/feeds?cuId=&from=&to=&status=
        group.MapGet("/feeds", async (
            FeedsRepository repo,
            string? cuId,
            DateTimeOffset? from,
            DateTimeOffset? to,
            string? status) =>
        {
            var filters = new FeedListFilters
            {
                CuId   = cuId,
                From   = from,
                To     = to,
                Status = status,
            };
            return Results.Ok(await repo.GetFeedListAsync(filters));
        });

        // GET /api/history/feeds/{feedRefId}
        group.MapGet("/feeds/{feedRefId}", async (
            FeedsRepository repo,
            string feedRefId) =>
        {
            var detail = await repo.GetFeedDetailAsync(feedRefId);
            return detail is null ? Results.NotFound() : Results.Ok(detail);
        });
    }
}
