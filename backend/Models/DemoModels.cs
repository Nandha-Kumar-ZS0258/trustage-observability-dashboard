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
