-- Migration: 006_create_field_validation_report.sql | Date: 2026-03-15 | Safe to re-run: YES
-- Creates the audit schema (if not exists) and a per-field validation results table.
-- One row per field per feed run — enables the wireframe detail:
--   "45 of 47 fields matched · 0 missing · 2 unrecognised (ExtendedCreditScore, LegacyBranchCode)"

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'audit')
    EXEC('CREATE SCHEMA audit');

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'audit' AND TABLE_NAME = 'FieldValidationReport'
)
BEGIN
    CREATE TABLE audit.FieldValidationReport (
        Id               BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
        CorrelationId    NVARCHAR(50)  NOT NULL,
        CuId             NVARCHAR(50)  NOT NULL,
        FieldName        NVARCHAR(200) NOT NULL,
        -- 'matched' | 'missing' | 'unrecognised' | 'type_mismatch'
        ValidationStatus NVARCHAR(30)  NOT NULL,
        CreatedAt        DATETIME2     NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_FieldValidationReport_CorrelationId
        ON audit.FieldValidationReport (CorrelationId);
    CREATE INDEX IX_FieldValidationReport_CuId
        ON audit.FieldValidationReport (CuId);
END
