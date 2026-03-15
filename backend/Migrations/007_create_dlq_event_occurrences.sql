-- Migration: 007_create_dlq_event_occurrences.sql | Date: 2026-03-15 | Safe to re-run: YES
-- Tracks individual occurrence timestamps for recurring DLQ exceptions.
-- kafka.DlqEvents.RecurrenceCount (Migration 003) holds the total count;
-- this table holds each occurrence date so the UI can show:
--   "Mar 11 (today) · Mar 9 · Mar 7 — same field, same volume each time"
-- The ingestion pipeline should INSERT here each time an exception recurs.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'kafka' AND TABLE_NAME = 'DlqEventOccurrences'
)
BEGIN
    CREATE TABLE kafka.DlqEventOccurrences (
        Id              BIGINT    NOT NULL IDENTITY(1,1) PRIMARY KEY,
        DlqEventId      BIGINT    NOT NULL,
        OccurredAt      DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        AffectedRecords INT       NULL
        -- FK to kafka.DlqEvents.Id intentionally omitted
        -- to avoid cross-schema dependency issues on constrained environments
    );
    CREATE INDEX IX_DlqEventOccurrences_DlqEventId
        ON kafka.DlqEventOccurrences (DlqEventId);
END
