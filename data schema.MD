 ============================================================
-- TELEMETRY DATABASE - DDL SCRIPTS
-- Database : TruStage
-- Schema   : observability
-- ============================================================

-- ============================================================
-- 0. CREATE SCHEMA
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'observability')
BEGIN
    EXEC('CREATE SCHEMA observability');
END
GO


-- ============================================================
-- 1. CORE EVENT LOG (every event lands here)
-- ============================================================
CREATE TABLE observability.IngestionEvents (
    id                  BIGINT IDENTITY(1,1)    NOT NULL,
    eventId             UNIQUEIDENTIFIER        NOT NULL,
    cuId                NVARCHAR(100)           NOT NULL,
    adapterId           NVARCHAR(200)           NOT NULL,
    eventType           NVARCHAR(100)           NOT NULL,   -- RunStarted, RunCompleted, BlobReceived, IngestionStarted, ValidationCompleted, IngestionCompleted
    stage               NVARCHAR(100)           NOT NULL,   -- CuRun
    timestamp           DATETIMEOFFSET          NOT NULL,
    correlationId       UNIQUEIDENTIFIER        NOT NULL,
    sessionId           UNIQUEIDENTIFIER        NULL,
    traceId             NVARCHAR(100)           NULL,
    spanId              NVARCHAR(100)           NULL,
    parentSpanId        NVARCHAR(100)           NULL,
    metadata            NVARCHAR(MAX)           NULL,       -- raw JSON of metadata bag
    metrics             NVARCHAR(MAX)           NULL,       -- raw JSON of top-level metrics (RunCompleted)
    createdAt           DATETIME2               NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_IngestionEvents PRIMARY KEY (id),
    CONSTRAINT UQ_IngestionEvents_eventId UNIQUE (eventId)
);

CREATE INDEX IX_IngestionEvents_correlationId  ON observability.IngestionEvents (correlationId);
CREATE INDEX IX_IngestionEvents_cuId           ON observability.IngestionEvents (cuId);
CREATE INDEX IX_IngestionEvents_eventType      ON observability.IngestionEvents (eventType);
CREATE INDEX IX_IngestionEvents_timestamp      ON observability.IngestionEvents (timestamp);
GO


-- ============================================================
-- 2. BLOB CONTEXT  (eventType = BlobReceived)
-- Maps to: blobContext { }
-- ============================================================
CREATE TABLE observability.BlobContext (
    id                      BIGINT IDENTITY(1,1)    NOT NULL,
    eventId                 UNIQUEIDENTIFIER        NOT NULL,
    correlationId           UNIQUEIDENTIFIER        NOT NULL,
    blobName                NVARCHAR(500)           NOT NULL,
    blobPath                NVARCHAR(1000)          NOT NULL,
    blobSizeBytes           BIGINT                  NULL,
    contentType             NVARCHAR(100)           NULL,
    eventTime               DATETIMEOFFSET          NULL,
    triggerReceivedTime     DATETIMEOFFSET          NULL,
    triggerLatencyMs        INT                     NULL,
    etag                    NVARCHAR(200)           NULL,
    containerName           NVARCHAR(200)           NOT NULL,

    CONSTRAINT PK_BlobContext PRIMARY KEY (id),
    CONSTRAINT FK_BlobContext_eventId FOREIGN KEY (eventId)
        REFERENCES observability.IngestionEvents (eventId)
);

CREATE INDEX IX_BlobContext_correlationId ON observability.BlobContext (correlationId);
CREATE INDEX IX_BlobContext_blobName      ON observability.BlobContext (blobName);
GO


-- ============================================================
-- 3. PIPELINE METRICS  (eventType = IngestionCompleted)
-- Maps to: pipelineMetrics { }
-- ============================================================
CREATE TABLE observability.PipelineMetrics (
    id                          BIGINT IDENTITY(1,1)    NOT NULL,
    eventId                     UNIQUEIDENTIFIER        NOT NULL,
    correlationId               UNIQUEIDENTIFIER        NOT NULL,
    ingestionStartTime          DATETIMEOFFSET          NULL,
    ingestionEndTime            DATETIMEOFFSET          NULL,
    totalProcessingDurationMs   INT                     NULL,
    -- stageDurations (flattened from JSON object)
    stageDuration_download      INT                     NULL,
    stageDuration_process       INT                     NULL,
    stageDuration_persist       INT                     NULL,
    -- row counts
    rowsRead                    INT                     NULL,
    rowsProcessed               INT                     NULL,
    rowsSkipped                 INT                     NULL,
    rowsFailed                  INT                     NULL,
    rowsWrittenToTarget         INT                     NULL,
    throughputRowsPerSec        DECIMAL(10, 2)          NULL,
    mappingVersion              NVARCHAR(100)           NULL,

    CONSTRAINT PK_PipelineMetrics PRIMARY KEY (id),
    CONSTRAINT FK_PipelineMetrics_eventId FOREIGN KEY (eventId)
        REFERENCES observability.IngestionEvents (eventId)
);

CREATE INDEX IX_PipelineMetrics_correlationId ON observability.PipelineMetrics (correlationId);
GO


-- ============================================================
-- 4. VALIDATION METRICS  (eventType = ValidationCompleted)
-- Maps to: validationMetrics { }
-- ============================================================
CREATE TABLE observability.ValidationMetrics (
    id                          BIGINT IDENTITY(1,1)    NOT NULL,
    eventId                     UNIQUEIDENTIFIER        NOT NULL,
    correlationId               UNIQUEIDENTIFIER        NOT NULL,
    validationPassed            BIT                     NOT NULL,
    validationErrorsCount       INT                     NULL,
    validationWarningsCount     INT                     NULL,
    schemaMatchScore            DECIMAL(5, 2)           NULL,
    missingRequiredColumns      NVARCHAR(MAX)           NULL,   -- JSON array []
    unknownColumnsDetected      NVARCHAR(MAX)           NULL,   -- JSON array []
    dataTypeMismatchCount       INT                     NULL,
    nullViolations              INT                     NULL,

    CONSTRAINT PK_ValidationMetrics PRIMARY KEY (id),
    CONSTRAINT FK_ValidationMetrics_eventId FOREIGN KEY (eventId)
        REFERENCES observability.IngestionEvents (eventId)
);

CREATE INDEX IX_ValidationMetrics_correlationId ON observability.ValidationMetrics (correlationId);
GO


-- ============================================================
-- 5. HOST CONTEXT  (eventType = IngestionStarted, IngestionCompleted)
-- Maps to: hostContext { }
-- ============================================================
CREATE TABLE observability.HostContext (
    id                  BIGINT IDENTITY(1,1)    NOT NULL,
    eventId             UNIQUEIDENTIFIER        NOT NULL,
    correlationId       UNIQUEIDENTIFIER        NOT NULL,
    hostName            NVARCHAR(200)           NULL,
    processId           INT                     NULL,
    cpuUsagePercent     DECIMAL(5, 2)           NULL,
    memoryUsedMb        DECIMAL(10, 2)          NULL,
    threadId            INT                     NULL,
    workerId            NVARCHAR(100)           NULL,
    environment         NVARCHAR(50)            NULL,

    CONSTRAINT PK_HostContext PRIMARY KEY (id),
    CONSTRAINT FK_HostContext_eventId FOREIGN KEY (eventId)
        REFERENCES observability.IngestionEvents (eventId)
);

CREATE INDEX IX_HostContext_correlationId ON observability.HostContext (correlationId);
CREATE INDEX IX_HostContext_hostName      ON observability.HostContext (hostName);
GO


-- ============================================================
-- 6. BUSINESS CONTEXT  (eventType = IngestionCompleted)
-- Maps to: businessContext { }
-- ============================================================
CREATE TABLE observability.BusinessContext (
    id                          BIGINT IDENTITY(1,1)    NOT NULL,
    eventId                     UNIQUEIDENTIFIER        NOT NULL,
    correlationId               UNIQUEIDENTIFIER        NOT NULL,
    fileType                    NVARCHAR(100)           NULL,
    expectedRecordCount         INT                     NULL,
    actualRecordCount           INT                     NULL,
    recordCountVariance         INT                     NULL,
    isFirstRunOfDay             BIT                     NULL,
    filesReceivedTodayForCu     INT                     NULL,
    slaBreach                   BIT                     NULL,
    slaThresholdMs              INT                     NULL,

    CONSTRAINT PK_BusinessContext PRIMARY KEY (id),
    CONSTRAINT FK_BusinessContext_eventId FOREIGN KEY (eventId)
        REFERENCES observability.IngestionEvents (eventId)
);

CREATE INDEX IX_BusinessContext_correlationId ON observability.BusinessContext (correlationId);
CREATE INDEX IX_BusinessContext_slaBreach     ON observability.BusinessContext (slaBreach);
GO


-- ============================================================
-- 7. ERROR CONTEXT  (future error events)
-- Maps to: errorContext { }  — currently null, ready for use
-- ============================================================
CREATE TABLE observability.ErrorContext (
    id                  BIGINT IDENTITY(1,1)    NOT NULL,
    eventId             UNIQUEIDENTIFIER        NOT NULL,
    correlationId       UNIQUEIDENTIFIER        NOT NULL,
    status              NVARCHAR(50)            NULL,   -- failed, partial, retrying
    errorCode           NVARCHAR(100)           NULL,
    errorMessage        NVARCHAR(MAX)           NULL,
    errorStackTrace     NVARCHAR(MAX)           NULL,
    failedStage         NVARCHAR(100)           NULL,   -- parse, map, transform, validate, load
    retryAttemptNumber  INT                     NULL    DEFAULT 0,
    retryReason         NVARCHAR(500)           NULL,
    isRecoverable       BIT                     NULL,

    CONSTRAINT PK_ErrorContext PRIMARY KEY (id),
    CONSTRAINT FK_ErrorContext_eventId FOREIGN KEY (eventId)
        REFERENCES observability.IngestionEvents (eventId)
);

CREATE INDEX IX_ErrorContext_correlationId ON observability.ErrorContext (correlationId);
CREATE INDEX IX_ErrorContext_errorCode     ON observability.ErrorContext (errorCode);
GO


-- ============================================================
-- 8. CU CONFIGURATION  (static setup — one row per Credit Union)
-- Populated manually when a CU is onboarded or updated.
-- Joined to event tables via cuId (not eventId / correlationId).
-- ============================================================
CREATE TABLE observability.CuConfiguration (
    id                  BIGINT IDENTITY(1,1)    NOT NULL,
    cuId                NVARCHAR(100)           NOT NULL,   -- matches IngestionEvents.cuId
    displayName         NVARCHAR(200)           NOT NULL,   -- human-readable CU name
    adapterId           NVARCHAR(200)           NOT NULL,   -- configured adapter/connector
    containerName       NVARCHAR(200)           NOT NULL,   -- expected Azure Blob container
    fileTypes           NVARCHAR(MAX)           NULL,       -- JSON array of expected file types e.g. ["full_export","delta"]
    slaThresholdMs      INT                     NOT NULL    DEFAULT 30000,  -- configured SLA limit in ms
    mappingVersion      NVARCHAR(100)           NULL,       -- assigned column mapping config version
    environment         NVARCHAR(50)            NOT NULL    DEFAULT 'production',  -- production | staging
    onboardingDate      DATE                    NOT NULL,   -- date CU was formally onboarded
    onboardingStatus    NVARCHAR(50)            NOT NULL    DEFAULT 'onboarding',  -- active | onboarding | inactive
    ownerTeam           NVARCHAR(200)           NULL,       -- team responsible for this CU
    notes               NVARCHAR(MAX)           NULL,       -- free-text notes
    createdAt           DATETIME2               NOT NULL    DEFAULT GETUTCDATE(),
    updatedAt           DATETIME2               NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_CuConfiguration PRIMARY KEY (id),
    CONSTRAINT UQ_CuConfiguration_cuId UNIQUE (cuId),
    CONSTRAINT CK_CuConfiguration_status CHECK (onboardingStatus IN ('active', 'onboarding', 'inactive')),
    CONSTRAINT CK_CuConfiguration_env   CHECK (environment       IN ('production', 'staging'))
);

CREATE INDEX IX_CuConfiguration_onboardingStatus ON observability.CuConfiguration (onboardingStatus);
CREATE INDEX IX_CuConfiguration_environment      ON observability.CuConfiguration (environment);
CREATE INDEX IX_CuConfiguration_ownerTeam        ON observability.CuConfiguration (ownerTeam);
GO


-- ============================================================
-- VERIFICATION — confirm all tables created under schema
-- ============================================================
SELECT
    t.TABLE_SCHEMA,
    t.TABLE_NAME,
    COUNT(c.COLUMN_NAME) AS ColumnCount
FROM INFORMATION_SCHEMA.TABLES t
JOIN INFORMATION_SCHEMA.COLUMNS c
    ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
WHERE t.TABLE_SCHEMA = 'observability'
GROUP BY t.TABLE_SCHEMA, t.TABLE_NAME
ORDER BY t.TABLE_NAME;
GO