using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class FeedsEndpoints
{
    public static void MapFeedsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/feeds");

        // GET /api/feeds/today/summary
        group.MapGet("/today/summary", async (FeedsRepository repo) =>
            Results.Ok(await repo.GetTodaySummaryAsync()));

        // GET /api/feeds/today/gantt
        group.MapGet("/today/gantt", async (FeedsRepository repo) =>
            Results.Ok(await repo.GetGanttDataAsync()));

        // GET /api/feeds/today/ticker
        // Returns the 20 most recent feed events today for the live ticker strip.
        group.MapGet("/today/ticker", async (FeedsRepository repo) =>
        {
            var today = DateTimeOffset.UtcNow.Date;
            var feeds = await repo.GetFeedListAsync(new FeedListFilters
            {
                From = new DateTimeOffset(today, TimeSpan.Zero)
            });
            return Results.Ok(feeds.Take(20));
        });

        // GET /api/feeds/today/grid
        // Returns BAU CU partner cards for the today's feeds status grid.
        group.MapGet("/today/grid", async (ProgrammeRepository prog) =>
        {
            var bau = await prog.GetCuFleetAsync(new CuFleetFilters
            {
                LifecycleState = "BAU"
            });
            return Results.Ok(bau);
        });
    }
}
