-- Migration: 004_create_cu_notes.sql | Date: 2026-03-15 | Safe to re-run: YES
-- Creates the ops schema (app-owned operational data, not ingestion pipeline data)
-- and a notes history table for CU partners, used by the lifecycle panel.
-- Each Save action in the lifecycle drill-down panel inserts a row here.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'ops')
    EXEC('CREATE SCHEMA ops');

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'ops' AND TABLE_NAME = 'CU_Notes'
)
BEGIN
    CREATE TABLE ops.CU_Notes (
        Id          BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        CuId        NVARCHAR(50)  NOT NULL,
        NoteText    NVARCHAR(MAX) NOT NULL,
        AuthorId    NVARCHAR(100) NULL,
        CreatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_CU_Notes_CuId ON ops.CU_Notes (CuId);
END
