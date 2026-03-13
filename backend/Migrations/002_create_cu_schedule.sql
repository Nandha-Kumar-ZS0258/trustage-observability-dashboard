-- Migration: 002_create_cu_schedule.sql | Date: 2026-03-12 | Safe to re-run: YES
-- Creates the adapter schema (if not exists) and the adapter.CU_Schedule table.
-- Does NOT create adapter.CU_Configuration — use cfl.CU_Registry instead.
-- Does NOT touch observability.* tables (legacy).

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'adapter')
    EXEC('CREATE SCHEMA adapter');

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'adapter' AND TABLE_NAME = 'CU_Schedule'
)
BEGIN
    CREATE TABLE adapter.CU_Schedule (
        CuId                  NVARCHAR(50)  NOT NULL PRIMARY KEY,
        FrequencyDays         INT           NOT NULL DEFAULT 1,
        NextFeedExpectedAt    DATETIME2     NULL,
        DeliveryWindowMinutes INT           NOT NULL DEFAULT 120,
        CreatedAt             DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt             DATETIME2     NOT NULL DEFAULT GETUTCDATE()
    );
    -- Note: FK to cfl.CU_Registry.CU_ID intentionally omitted
    -- to avoid cross-schema dependency issues on constrained environments
END
