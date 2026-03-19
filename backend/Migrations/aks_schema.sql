-- AKS Visibility Schema
-- Run this once against the TruStage Azure SQL database.
-- Creates the aks.* tables used by AksSyncService to store data
-- pulled from Log Analytics (KubePodInventory, KubeEvents, Heartbeat).

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'aks')
    EXEC('CREATE SCHEMA aks');
GO

-- ── Watermark tracker ─────────────────────────────────────────────────────────
-- One row per sync key (KubeEvents, KubePodInventory, Heartbeat).
-- AksSyncService reads these on each tick to know where it last left off.

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'aks' AND t.name = 'SyncState')
CREATE TABLE aks.SyncState (
    SyncKey       NVARCHAR(100)  NOT NULL,
    LastSyncedAt  DATETIMEOFFSET NOT NULL,
    LastWatermark NVARCHAR(200)  NULL,
    CONSTRAINT PK_aks_SyncState PRIMARY KEY (SyncKey)
);
GO

-- ── Node health ───────────────────────────────────────────────────────────────
-- One row per AKS node. Upserted every sync cycle from Heartbeat table.
-- IsOnline is set to 0 for nodes not seen in the last 10 minutes.

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'aks' AND t.name = 'NodeHealth')
CREATE TABLE aks.NodeHealth (
    NodeName      NVARCHAR(200)  NOT NULL,
    OsType        NVARCHAR(50)   NULL,
    AgentVersion  NVARCHAR(50)   NULL,
    LastHeartbeat DATETIMEOFFSET NOT NULL,
    IsOnline      BIT            NOT NULL CONSTRAINT DF_aks_NodeHealth_IsOnline DEFAULT 1,
    LastSyncedAt  DATETIMEOFFSET NOT NULL,
    CONSTRAINT PK_aks_NodeHealth PRIMARY KEY (NodeName)
);
GO

-- ── Adaptor pod health ────────────────────────────────────────────────────────
-- One row per adaptor deployment. AdaptorId is the K8s ControllerName today
-- (e.g. "trustage-adaptor"), or the value of the "adaptorId" pod label when
-- multiple adaptors are deployed in future. Upserted every sync cycle from
-- KubePodInventory.

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'aks' AND t.name = 'AdaptorPodHealth')
CREATE TABLE aks.AdaptorPodHealth (
    AdaptorId             NVARCHAR(100)  NOT NULL,
    PodName               NVARCHAR(200)  NOT NULL,
    DeploymentName        NVARCHAR(200)  NULL,
    Namespace             NVARCHAR(100)  NOT NULL,
    PodStatus             NVARCHAR(50)   NOT NULL,   -- Running / Pending / Failed / Succeeded
    ContainerStatus       NVARCHAR(50)   NULL,       -- running / waiting / terminated
    ContainerStatusReason NVARCHAR(200)  NULL,       -- e.g. CrashLoopBackOff
    IsReady               BIT            NOT NULL CONSTRAINT DF_aks_AdaptorPodHealth_IsReady DEFAULT 0,
    RestartCount          INT            NOT NULL CONSTRAINT DF_aks_AdaptorPodHealth_RestartCount DEFAULT 0,
    NodeName              NVARCHAR(200)  NULL,
    PodIp                 NVARCHAR(50)   NULL,
    PodStartTime          DATETIMEOFFSET NULL,
    Labels                NVARCHAR(MAX)  NULL,       -- JSON blob of pod labels
    LastSyncedAt          DATETIMEOFFSET NOT NULL,
    CONSTRAINT PK_aks_AdaptorPodHealth PRIMARY KEY (AdaptorId)
);
GO

-- ── Cluster events ────────────────────────────────────────────────────────────
-- Insert-only warning events from KubeEvents. Deduplication is done by the
-- sync service (ObjectName + Reason + LastSeen). Rows older than 7 days are
-- deleted each sync cycle.

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'aks' AND t.name = 'ClusterEvents')
CREATE TABLE aks.ClusterEvents (
    Id              BIGINT IDENTITY   NOT NULL,
    AdaptorId       NVARCHAR(100)     NULL,           -- FK to AdaptorPodHealth (NULL for node events)
    ObjectKind      NVARCHAR(50)      NOT NULL,       -- Pod / Node
    ObjectName      NVARCHAR(200)     NOT NULL,
    Namespace       NVARCHAR(100)     NULL,
    Reason          NVARCHAR(100)     NOT NULL,       -- Unhealthy / OOMKilling / FailedScheduling …
    Message         NVARCHAR(MAX)     NULL,
    EventCount      INT               NOT NULL CONSTRAINT DF_aks_ClusterEvents_EventCount DEFAULT 1,
    FirstSeen       DATETIMEOFFSET    NOT NULL,
    LastSeen        DATETIMEOFFSET    NOT NULL,
    KubeEventType   NVARCHAR(20)      NOT NULL,       -- Warning / Normal
    SourceComponent NVARCHAR(100)     NULL,
    IngestedAt      DATETIMEOFFSET    NOT NULL CONSTRAINT DF_aks_ClusterEvents_IngestedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_aks_ClusterEvents PRIMARY KEY (Id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_aks_ClusterEvents_LastSeen')
    CREATE INDEX IX_aks_ClusterEvents_LastSeen ON aks.ClusterEvents (LastSeen DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_aks_ClusterEvents_AdaptorId')
    CREATE INDEX IX_aks_ClusterEvents_AdaptorId ON aks.ClusterEvents (AdaptorId);
GO

-- ── Seed SyncState rows ───────────────────────────────────────────────────────
-- Bootstrap watermarks. LastWatermark is NULL so the first sync fetches
-- recent data (last 24 h). The service sets it after the first successful run.

IF NOT EXISTS (SELECT 1 FROM aks.SyncState WHERE SyncKey = 'KubePodInventory')
    INSERT INTO aks.SyncState (SyncKey, LastSyncedAt, LastWatermark)
    VALUES ('KubePodInventory', SYSUTCDATETIME(), NULL);

IF NOT EXISTS (SELECT 1 FROM aks.SyncState WHERE SyncKey = 'KubeEvents')
    INSERT INTO aks.SyncState (SyncKey, LastSyncedAt, LastWatermark)
    VALUES ('KubeEvents', SYSUTCDATETIME(), NULL);

IF NOT EXISTS (SELECT 1 FROM aks.SyncState WHERE SyncKey = 'Heartbeat')
    INSERT INTO aks.SyncState (SyncKey, LastSyncedAt, LastWatermark)
    VALUES ('Heartbeat', SYSUTCDATETIME(), NULL);
GO

-- ── Adaptor health snapshots ──────────────────────────────────────────────────
-- One row per adaptor per sync cycle (every 2 min). Used to compute uptime %,
-- restart trend chart, and probe failure timeline. Rows older than 7 days purged.

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'aks' AND t.name = 'AdaptorHealthSnapshot')
CREATE TABLE aks.AdaptorHealthSnapshot (
    Id           BIGINT IDENTITY    NOT NULL,
    AdaptorId    NVARCHAR(100)      NOT NULL,
    IsReady      BIT                NOT NULL,
    RestartCount INT                NOT NULL,
    PodStatus    NVARCHAR(50)       NOT NULL,
    SnapshotTime DATETIMEOFFSET     NOT NULL CONSTRAINT DF_aks_AdaptorHealthSnapshot_SnapshotTime DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_aks_AdaptorHealthSnapshot PRIMARY KEY (Id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_aks_AdaptorHealthSnapshot_AdaptorId_SnapshotTime')
    CREATE INDEX IX_aks_AdaptorHealthSnapshot_AdaptorId_SnapshotTime
        ON aks.AdaptorHealthSnapshot (AdaptorId, SnapshotTime DESC);
GO

-- ── Adaptor run logs ───────────────────────────────────────────────────────────
-- One row per pipeline stage per run. Parsed from ContainerLogV2 by AksSyncService.
-- BatchId = correlationId / feedReferenceId — links to existing pipeline run tables.
-- Rows older than 30 days purged each sync cycle.

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'aks' AND t.name = 'AdaptorRunLog')
CREATE TABLE aks.AdaptorRunLog (
    Id           BIGINT IDENTITY   NOT NULL,
    BatchId      NVARCHAR(100)     NOT NULL,   -- correlationId / feedReferenceId
    CuId         NVARCHAR(100)     NOT NULL,   -- e.g. CreditUnionJson
    FileName     NVARCHAR(500)     NULL,        -- from "archived blob ..." log line
    Stage        NVARCHAR(50)      NOT NULL,   -- Ingestion / SchemaValidation / RulesValidation / Publishing
    PodName      NVARCHAR(200)     NOT NULL,
    NodeName     NVARCHAR(200)     NULL,
    StageTime    DATETIMEOFFSET    NOT NULL,
    MemberCount  INT               NULL,
    ErrorCount   INT               NULL,
    WarningCount INT               NULL,
    GateResult   NVARCHAR(200)     NULL,        -- e.g. "Gate1=PASS Gate2=FAIL"
    Outcome      NVARCHAR(20)      NULL,        -- Passed / Failed
    IngestedAt   DATETIMEOFFSET    NOT NULL CONSTRAINT DF_aks_AdaptorRunLog_IngestedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_aks_AdaptorRunLog PRIMARY KEY (Id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_aks_AdaptorRunLog_BatchId')
    CREATE INDEX IX_aks_AdaptorRunLog_BatchId ON aks.AdaptorRunLog (BatchId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_aks_AdaptorRunLog_StageTime')
    CREATE INDEX IX_aks_AdaptorRunLog_StageTime ON aks.AdaptorRunLog (StageTime DESC);
GO

-- Seed SyncState watermark for ContainerLogV2
IF NOT EXISTS (SELECT 1 FROM aks.SyncState WHERE SyncKey = 'ContainerLogV2')
    INSERT INTO aks.SyncState (SyncKey, LastSyncedAt, LastWatermark)
    VALUES ('ContainerLogV2', SYSUTCDATETIME(), NULL);
GO
