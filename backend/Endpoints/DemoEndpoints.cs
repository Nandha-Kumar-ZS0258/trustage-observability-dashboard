using Azure.Storage.Blobs;
using TruStage.Observability.Api.Models;
using TruStage.Observability.Api.Services;

namespace TruStage.Observability.Api.Endpoints;

public static class DemoEndpoints
{
    public static void MapDemoEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/demo");

        // POST /api/demo/upload
        // Accepts a multipart file upload and stores it in Azure Blob Storage
        // under the CreditUnionJson/{filename} path, which triggers the adaptor pipeline.
        group.MapPost("/upload", async (HttpRequest request, IConfiguration config, ILogger<Program> logger) =>
        {
            if (!request.HasFormContentType)
                return Results.BadRequest("Request must be multipart/form-data.");

            var form = await request.ReadFormAsync();
            var file = form.Files.GetFile("file");

            if (file is null || file.Length == 0)
                return Results.BadRequest("No file provided.");

            var connectionString = config["AzureStorage:ConnectionString"]
                ?? throw new InvalidOperationException("AzureStorage:ConnectionString is not configured.");
            var containerName = config["AzureStorage:ContainerName"] ?? "trustage";
            var blobName      = $"CreditUnionJson/{file.FileName}";

            try
            {
                var client    = new BlobServiceClient(connectionString);
                var container = client.GetBlobContainerClient(containerName);
                var blob      = container.GetBlobClient(blobName);

                using var stream = file.OpenReadStream();
                await blob.UploadAsync(stream, overwrite: true);

                var result = new DemoUploadResultDto(
                    BlobName:      blobName,
                    ContainerPath: $"{containerName}/{blobName}",
                    UploadedAt:    DateTimeOffset.UtcNow
                );

                logger.LogInformation("[Demo] Uploaded {File} → {BlobName}", file.FileName, blobName);
                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[Demo] Failed to upload {File}", file.FileName);
                return Results.Problem($"Upload failed: {ex.Message}");
            }
        })
        .DisableAntiforgery();

        // GET /api/demo/history?hours=24
        // Returns historical pipeline log events from telemetry.AdapterEvents,
        // converted via the same BuildMessages logic used by the live SignalR feed.
        // The frontend loads this on page mount to pre-populate the log panel.
        group.MapGet("/history", async (IConfiguration config, ILogger<Program> logger, int hours = 24) =>
        {
            hours = Math.Clamp(hours, 1, 168); // clamp to 1 h – 7 days

            var connStr = config.GetConnectionString("TruStage");
            if (string.IsNullOrWhiteSpace(connStr))
                return Results.Problem("Database connection is not configured.");

            var since = DateTimeOffset.UtcNow.AddHours(-hours);

            try
            {
                var rows   = (await PipelineMessageBuilder.FetchEventsAsync(connStr, since, CancellationToken.None)).ToList();
                var events = PipelineMessageBuilder.BuildFromRows(rows).ToList();

                logger.LogInformation("[Demo] History: {Events} log events across {Rows} adapter rows in last {Hours}h",
                    events.Count, rows.Count, hours);

                return Results.Ok(events);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[Demo] History query failed");
                return Results.Problem($"History query failed: {ex.Message}");
            }
        });
    }
}
