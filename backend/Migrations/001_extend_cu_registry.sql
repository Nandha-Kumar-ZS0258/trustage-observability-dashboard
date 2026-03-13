-- Migration: 001_extend_cu_registry.sql | Date: 2026-03-12 | Safe to re-run: YES
-- Adds two new columns to cfl.CU_Registry for the monitoring application.
-- Does NOT drop or modify any existing columns.

IF COL_LENGTH('cfl.CU_Registry', 'AssignedEngineer') IS NULL
    ALTER TABLE cfl.CU_Registry
        ADD AssignedEngineer NVARCHAR(100) NULL;

IF COL_LENGTH('cfl.CU_Registry', 'StateEnteredAt') IS NULL
    ALTER TABLE cfl.CU_Registry
        ADD StateEnteredAt DATETIME2 NULL DEFAULT GETUTCDATE();
