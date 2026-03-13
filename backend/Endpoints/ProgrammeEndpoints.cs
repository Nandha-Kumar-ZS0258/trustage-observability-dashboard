using TruStage.Observability.Api.Models.Programme;
using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

public static class ProgrammeEndpoints
{
    public static void MapProgrammeEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/programme");

        // GET /api/programme/lifecycle-counts
        group.MapGet("/lifecycle-counts", async (ProgrammeRepository repo) =>
            Results.Ok(await repo.GetLifecycleCountsAsync()));

        // GET /api/programme/cu-fleet?state=&platform=&health=&search=
        group.MapGet("/cu-fleet", async (
            ProgrammeRepository repo,
            string? state,
            string? platform,
            string? health,
            string? search) =>
        {
            var filters = new CuFleetFilters
            {
                LifecycleState = state,
                Platform       = platform,
                HealthStatus   = health,
                Search         = search,
            };
            return Results.Ok(await repo.GetCuFleetAsync(filters));
        });

        // GET /api/programme/lifecycle-panel/{state}
        group.MapGet("/lifecycle-panel/{state}", async (
            ProgrammeRepository repo,
            string state) =>
        {
            if (!Enum.TryParse<LifecycleState>(state, ignoreCase: true, out var ls))
                return Results.BadRequest($"Unknown lifecycle state '{state}'. " +
                                          "Valid values: Onboarding, ReadyForFirstFeed, BAU.");
            return Results.Ok(await repo.GetLifecyclePanelCusAsync(ls));
        });

        // POST /api/programme/lifecycle-panel/note
        // Accepts a free-text note (and optional owner) for a CU in a lifecycle panel.
        // Stub: returns 200 immediately. Full persistence requires a future notes table migration.
        group.MapPost("/lifecycle-panel/note", (LifecyclePanelNoteRequest req) =>
            Results.Ok(new { saved = true }));
    }
}
