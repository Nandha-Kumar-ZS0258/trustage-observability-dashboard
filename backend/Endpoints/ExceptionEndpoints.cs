using TruStage.Observability.Api.Models.Exceptions;
using TruStage.Observability.Api.Repositories;

namespace TruStage.Observability.Api.Endpoints;

/// <summary>Request body for PATCH /api/exceptions/{id}/resolve</summary>
public record PatchResolveRequest(string ResolvedById);

public static class ExceptionEndpoints
{
    public static void MapExceptionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/exceptions");

        // GET /api/exceptions/summary
        group.MapGet("/summary", async (ExceptionRepository repo) =>
            Results.Ok(await repo.GetSummaryAsync()));

        // GET /api/exceptions/unresolved-count
        // Registered before /{id} to avoid route ambiguity.
        group.MapGet("/unresolved-count", async (ExceptionRepository repo) =>
            Results.Ok(await repo.GetUnresolvedCountAsync()));

        // GET /api/exceptions?cuId=&status=resolved|unresolved&step=
        group.MapGet("/", async (
            ExceptionRepository repo,
            string? cuId,
            string? status,
            string? step) =>
        {
            bool? resolved = status switch
            {
                "resolved"   => true,
                "unresolved" => false,
                _            => null
            };

            var filters = new ExceptionFilters
            {
                CuId     = cuId,
                Resolved = resolved,
                Step     = step,
            };
            return Results.Ok(await repo.GetExceptionsAsync(filters));
        });

        // GET /api/exceptions/{id}
        group.MapGet("/{id:int}", async (ExceptionRepository repo, int id) =>
        {
            var exc = await repo.GetExceptionByIdAsync(id);
            return exc is null ? Results.NotFound() : Results.Ok(exc);
        });

        // PATCH /api/exceptions/{id}/owner
        group.MapPatch("/{id:int}/owner", async (
            ExceptionRepository repo,
            int id,
            PatchOwnerRequest body) =>
        {
            var updated = await repo.PatchOwnerAsync(id, body.OwnerId);
            return updated ? Results.NoContent() : Results.NotFound();
        });

        // PATCH /api/exceptions/{id}/note
        group.MapPatch("/{id:int}/note", async (
            ExceptionRepository repo,
            int id,
            PatchNoteRequest body) =>
        {
            var updated = await repo.PatchNoteAsync(id, body.Note);
            return updated ? Results.NoContent() : Results.NotFound();
        });

        // PATCH /api/exceptions/{id}/resolve
        group.MapPatch("/{id:int}/resolve", async (
            ExceptionRepository repo,
            int id,
            PatchResolveRequest body) =>
        {
            var updated = await repo.ResolveAsync(id, body.ResolvedById);
            return updated ? Results.NoContent() : Results.NotFound();
        });
    }
}
