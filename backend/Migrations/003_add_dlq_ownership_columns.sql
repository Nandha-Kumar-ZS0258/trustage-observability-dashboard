-- Migration: 003_add_dlq_ownership_columns.sql | Date: 2026-03-12 | Safe to re-run: YES
-- Adds exception ownership and resolution tracking columns to kafka.DlqEvents.
-- Does NOT drop or modify any existing columns.

IF COL_LENGTH('kafka.DlqEvents', 'ResolvedFlag') IS NULL
    ALTER TABLE kafka.DlqEvents ADD ResolvedFlag BIT NOT NULL DEFAULT 0;

IF COL_LENGTH('kafka.DlqEvents', 'ResolvedAt') IS NULL
    ALTER TABLE kafka.DlqEvents ADD ResolvedAt DATETIME2 NULL;

IF COL_LENGTH('kafka.DlqEvents', 'ResolvedById') IS NULL
    ALTER TABLE kafka.DlqEvents ADD ResolvedById NVARCHAR(100) NULL;

IF COL_LENGTH('kafka.DlqEvents', 'OwnerId') IS NULL
    ALTER TABLE kafka.DlqEvents ADD OwnerId NVARCHAR(100) NULL;

IF COL_LENGTH('kafka.DlqEvents', 'OwnerNote') IS NULL
    ALTER TABLE kafka.DlqEvents ADD OwnerNote NVARCHAR(MAX) NULL;

IF COL_LENGTH('kafka.DlqEvents', 'OwnerNoteAt') IS NULL
    ALTER TABLE kafka.DlqEvents ADD OwnerNoteAt DATETIME2 NULL;

IF COL_LENGTH('kafka.DlqEvents', 'RecurrenceCount') IS NULL
    ALTER TABLE kafka.DlqEvents ADD RecurrenceCount INT NOT NULL DEFAULT 1;
