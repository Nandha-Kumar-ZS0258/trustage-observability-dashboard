-- Migration: 005_add_data_alignment_score.sql | Date: 2026-03-15 | Safe to re-run: YES
-- Adds data quality columns to kafka.BatchJourneys.
-- The ingestion pipeline must populate these during the Data Validation step.
-- DataAlignmentScore drives the % shown on every feed row and the CU detail chart.

IF COL_LENGTH('kafka.BatchJourneys', 'DataAlignmentScore') IS NULL
    ALTER TABLE kafka.BatchJourneys ADD DataAlignmentScore DECIMAL(5,2) NULL;

IF COL_LENGTH('kafka.BatchJourneys', 'FieldsMatched') IS NULL
    ALTER TABLE kafka.BatchJourneys ADD FieldsMatched INT NULL;

IF COL_LENGTH('kafka.BatchJourneys', 'FieldsMissing') IS NULL
    ALTER TABLE kafka.BatchJourneys ADD FieldsMissing INT NULL;

IF COL_LENGTH('kafka.BatchJourneys', 'FieldsUnrecognised') IS NULL
    ALTER TABLE kafka.BatchJourneys ADD FieldsUnrecognised INT NULL;
