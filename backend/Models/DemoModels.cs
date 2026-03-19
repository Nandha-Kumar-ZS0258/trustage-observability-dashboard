namespace TruStage.Observability.Api.Models;

public record PipelineLogEventDto(
    string Stage,       // blob | ingestion | transform | schemaValidation | rulesValidation | publishing | system
    string Level,       // info | warn | error
    string Message,
    DateTimeOffset Timestamp
);

public record DemoUploadResultDto(
    string BlobName,
    string ContainerPath,
    DateTimeOffset UploadedAt
);

public record PipelineSummaryDto(int Submitted, int Ingested, int Blocked, int Warnings);

// ── Shared row / metrics models (used by DemoTraceService + DemoEndpoints) ───

public sealed class AdapterEventRow
{
    public Guid           EventId           { get; set; }
    public string         EventType         { get; set; } = "";
    public string         CuId              { get; set; } = "";
    public string         CorrelationId     { get; set; } = "";
    public DateTimeOffset CreatedAt         { get; set; }
    public string?        BlobContext       { get; set; }
    public string?        PipelineMetrics   { get; set; }
    public string?        ValidationMetrics { get; set; }
    public string?        ErrorContext      { get; set; }
}

public sealed record RunMetrics(int Submitted, int Ingested, int Blocked, int Warnings, string BlobName = "");
