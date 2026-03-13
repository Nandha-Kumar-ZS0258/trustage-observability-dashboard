using Azure.Storage.Blobs;
using TruStage.Observability.Api.Models;

namespace TruStage.Observability.Api.Endpoints;

public static class DemoEndpoints
{
    public static void MapDemoEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/demo");

        // POST /api/demo/upload
        // Accepts a multipart file upload and stores it in Azure Blob Storage
        // under the CreditUnionJson/{filename} path.
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
    }
}
