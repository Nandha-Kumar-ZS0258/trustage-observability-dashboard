# TruStage Observability Dashboard — Architecture

**Version:** 1.0
**Date:** March 5, 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Diagram](#3-architecture-diagram)
4. [Data Flow](#4-data-flow)
5. [Pages & Visuals — What Each Gives You](#5-pages--visuals--what-each-gives-you)
6. [Data Schema & Data Dictionary](#6-data-schema--data-dictionary)
7. [Project Structure](#7-project-structure)
8. [API Reference](#8-api-reference)

> **Current schema:** 8 tables — 7 event-driven observability tables + 1 static configuration table (`CuConfiguration`)

---

## 1. System Overview

The TruStage Observability Dashboard is a read-only, single-pane-of-glass monitoring tool for the TruStage data ingestion platform. It surfaces the full lifecycle of every file delivered by Credit Unions (CUs) — from the moment an Azure Blob event fires to the last row written to the database.

All data originates exclusively from the `observability` schema in TruStage SQL Server. There is no separate data warehouse or ETL — the dashboard queries the same schema the ingestion pipeline writes to.

**Three audiences served:**

| Audience | Primary Need |
|---|---|
| Operations team | Real-time health — know in seconds if something is broken |
| Engineering team | Root-cause diagnosis — trace any failure event by event |
| Business / Management | SLA accountability — confirm CUs are delivering on time |

---

## 2. Tech Stack

### 2.1 Frontend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| UI Framework | React | 18.x | Component-based UI rendering |
| Language | TypeScript | 5.x | Type safety across all components and API contracts |
| Build Tool | Vite | 5.x | Fast dev server with HMR; production bundling |
| Routing | React Router DOM | v6 | Client-side page navigation between all 6 dashboard pages |
| Server State | TanStack Query (React Query) | v5 | API data fetching, caching, background refresh, loading/error states |
| HTTP Client | Axios | latest | All REST API calls to the ASP.NET Core backend |
| Charts | Recharts | latest | Line charts, bar charts, area charts, pie/donut charts |
| UI Components | shadcn/ui | latest | Pre-built accessible components: Table, Dialog, Badge, Drawer, Tabs, Tooltip, Sheet |
| Styling | Tailwind CSS | v3 | Utility-first CSS — all layout and spacing |
| Icons | lucide-react | latest | Consistent icon set throughout the UI |
| Real-Time | @microsoft/signalr | latest | WebSocket client connecting to ASP.NET Core SignalR hub |
| Forms & Filters | react-hook-form + zod | latest | Filter form handling and schema validation on Run Explorer |
| Authentication | @azure/msal-react + @azure/msal-browser | latest | Azure AD SSO token management |
| Date Utilities | date-fns | latest | Timestamp formatting throughout the UI |
| Class Utilities | clsx + tailwind-merge | latest | Conditional CSS class composition |

### 2.2 Backend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | ASP.NET Core | .NET 8 | Web API host |
| API Style | Minimal APIs | .NET 8 | Lightweight REST endpoint registration |
| Data Access | Dapper | latest | Micro-ORM — raw SQL queries against the observability schema |
| DB Driver | Microsoft.Data.SqlClient | latest | SQL Server TCP connection |
| Real-Time | Microsoft.AspNetCore.SignalR | .NET 8 | WebSocket hub broadcasting new ingestion events to connected clients |
| Authentication | Microsoft.Identity.Web | latest | Azure AD token validation on all API endpoints |

### 2.3 Database

| Layer | Technology | Notes |
|---|---|---|
| Database | SQL Server (TruStage existing instance) | No new database — uses the existing TruStage SQL Server |
| Schema | `observability` | Isolated schema — 8 tables (7 event-driven + 1 static CU config) |

### 2.4 Hosting

| Component | Target Host | Notes |
|---|---|---|
| React Frontend | Azure Static Web Apps or IIS | Internal access only |
| ASP.NET Core API | Azure App Service or IIS | Same domain preferred (avoids CORS for SignalR) |
| SQL Server | TruStage existing SQL Server | Read-only access from the API to the `observability` schema |

### 2.5 Dev & Build Tooling

| Tool | Purpose |
|---|---|
| Vite | Dev server with HMR, production build |
| ESLint + Prettier | Code quality and formatting |
| Vitest + React Testing Library | Unit and component tests |
| dotnet watch | Hot reload for ASP.NET Core API during development |

---

## 3. Architecture Diagram

```
+----------------------------------------------------------+
|                        BROWSER                           |
|                                                          |
|   React 18 + TypeScript + Vite                           |
|   TanStack Query  |  React Router  |  Recharts           |
|   Tailwind CSS    |  shadcn/ui     |  Lucide Icons        |
|   @azure/msal-react  (Azure AD SSO)                      |
+---------------------------+------------------------------+
                            |
                   HTTPS REST + SignalR WebSocket
                            |
+---------------------------v------------------------------+
|              ASP.NET Core Web API  (.NET 8)              |
|                                                          |
|   Minimal APIs        Dapper         SignalR Hub         |
|   Microsoft.Identity.Web (Azure AD token validation)     |
+---------------------------+------------------------------+
                            |
                   SQL over TCP (port 1433)
                            |
+---------------------------v------------------------------+
|    TruStage SQL Server  —  observability schema          |
|                                                          |
|   IngestionEvents   BlobContext    PipelineMetrics        |
|   ValidationMetrics HostContext   BusinessContext         |
|   ErrorContext      CuConfiguration                      |
+----------------------------------------------------------+
```

---

## 4. Data Flow

```
observability schema (SQL Server)
         |
         |  Dapper parameterized query (raw SQL, no ORM overhead)
         v
ObservabilityRepository.cs
         |
         |  Returns typed C# DTO model
         v
ASP.NET Core Minimal API Endpoint
         |
         |  Serialized as JSON over HTTPS
         v
Axios HTTP client (React frontend)
         |
         |  Cached and managed by TanStack Query
         v
React Component
         |
         |  Renders chart / table / card / badge
         v
User sees data in browser
```

### Real-Time Path (Live Feed)

```
Ingestion pipeline writes new event to observability.IngestionEvents
         |
         |  Pipeline calls SignalR hub after INSERT
         v
TelemetryHub.cs  (ASP.NET Core SignalR)
         |
         |  Broadcasts "NewEvent" over WebSocket to all connected clients
         v
useLiveFeed.ts hook in React
         |
         |  Receives event -> invalidates TanStack Query cache keys
         v
TanStack Query re-fetches from SQL Server
         |
         v
Overview Live Feed and KPI Strip update automatically
```

---

## 5. Pages & Visuals — What Each Gives You

### Page 1 — Overview (The Morning Brief)

> The entry point. Tells the full health story in under 10 seconds without clicking anything.

#### KPI Strip (4 headline numbers)

| KPI | What It Tells You | Data Source |
|---|---|---|
| Runs Today | Total pipeline runs completed today — volume indicator | `IngestionEvents` WHERE eventType = 'RunCompleted' AND date = today |
| Success Rate | % of runs with zero failed rows — the primary health signal | `IngestionEvents.metrics.rowsFailed` = 0 / total runs today |
| SLA Breaches Today | Count of runs that exceeded the SLA threshold — accountability metric | `BusinessContext.slaBreach` = true, joined to today's events |
| Active CUs Today | Distinct Credit Unions that have completed at least one run today | DISTINCT `cuId` with RunCompleted events today |

Color thresholds: Success Rate >= 98% = green, 90-97% = amber, < 90% = red. SLA Breaches 0 = green, 1-2 = amber, 3+ = red.

#### Live Pipeline Feed

A real-time scrolling feed of the last 20 ingestion events across all CUs, auto-refreshing every 30 seconds via TanStack Query and updating instantly via SignalR push.

Each row shows: event type badge (color-coded), CU name, file name, timestamp, duration, and status pill.

**What it gives you:** Immediate awareness of what the pipeline is doing right now — no need to query logs or the database manually.

#### CU Health Grid

One card per Credit Union showing: CU name, last run time, last run status (green/red/yellow), files received today, rows processed today, SLA status (Met / Breached).

Clicking a card navigates to the CU Detail page.

**What it gives you:** At-a-glance health status for every Credit Union. Spot at a glance which CU has a problem or hasn't delivered yet today.

#### Today's Ingestion Timeline

Horizontal timeline chart (x-axis = time of day, y-axis = CU name) showing when each CU's pipeline runs happened today, color-coded by status.

**What it gives you:** Immediately spot a CU that normally runs at 9am but hasn't fired by 11am — a timing anomaly invisible in any other view.

#### Rows Processed — Hourly Bar Chart

Bar chart of total rows written to target per hour today across all CUs.

**What it gives you:** Volume trend for the day. A missing bar at an expected hour flags a processing gap.

---

### Page 2 — Run Explorer (The Detective View)

> An engineer uses this page when something went wrong. Find the exact run, then trace it event by event.

#### Run List Table

Filterable, sortable table of all pipeline runs. Filters available: CU name, date range, status, file type, SLA breach toggle.

Columns: Correlation ID, CU Name, File Name, File Type, Started At, Duration (ms), Rows Processed, Rows Failed, Validation Pass/Fail, SLA Status.

**What it gives you:** Full searchable history of every run. Narrow to a specific CU, time window, or failed-only runs in seconds.

#### Run Detail — Event Timeline (Section A)

A vertical step-by-step timeline of every event in a single correlationId — BlobReceived, RunStarted, IngestionStarted, ValidationCompleted, IngestionCompleted, RunCompleted — with exact timestamps.

**What it gives you:** The exact sequence and timing of every event in a run. Identify where a run stalled or failed.

#### Run Detail — Stage Duration Breakdown (Section B)

Horizontal stacked bar chart showing milliseconds spent in each pipeline stage: Download, Process, Persist.

**What it gives you:** Instantly see which stage consumed the most time. Typical finding: Persist dominates (~97%) confirming the bottleneck is the database write, not parsing or processing.

#### Run Detail — Validation Report (Section C)

Schema match score gauge, error count, warning count, list of missing required columns, list of unknown columns detected.

**What it gives you:** Full schema validation result for a single run. Know exactly what column issue triggered a validation failure.

#### Run Detail — Host Snapshot (Section D)

Memory at start vs end, CPU usage %, thread ID, host name, worker ID.

**What it gives you:** Resource consumption context for the run. Correlate high memory/CPU with slow runs.

#### Run Detail — Business Summary (Section E)

File type, actual vs expected record count, record count variance, SLA threshold vs actual duration, first-run-of-day flag.

**What it gives you:** Business-level context: did the CU deliver the expected number of records? Was this the first file today?

#### Run Detail — Error Details (Section F, conditional)

Error code, error message, failed stage, retry attempt number, retry reason, is-recoverable flag, stack trace (collapsed).

**What it gives you:** The full error context for a failed run without needing to search logs. Know whether the failure is recoverable or requires manual intervention.

---

### Page 3 — CU Detail (The Credit Union Story)

> One page per Credit Union. Accessible from the Overview CU Health Grid. Used by the ops manager to assess a CU's reliability over time.

#### CU Summary Header

Total runs all-time, overall success rate (%), average processing duration (ms), total rows ever processed, SLA breach count all-time, first file received date, most recent file received date.

**What it gives you:** A single-number health summary of the CU's entire history.

#### Run History Chart

Line chart — x-axis = date, y-axis = processing duration (ms) — over last 30/60/90 days. Overlays SLA threshold as a red dotted line.

**What it gives you:** Duration trend. See if a CU's processing time is gradually increasing (data volume growth) or spiked after a specific date.

#### Daily File Volume Chart

Bar chart of files received and total rows per day over the last 30 days.

**What it gives you:** Delivery pattern analysis. Spot days where a CU didn't deliver or delivered late.

#### Validation Health Over Time

Line chart of `schemaMatchScore` over time.

**What it gives you:** Schema drift detection. A dip in the score signals the CU changed their file format without notice.

#### Recent Runs Table

Last 20 runs for this CU with same columns as Run Explorer. Click-through to Run Detail.

#### Error History

All errors ever recorded for this CU from ErrorContext, grouped by error code. Bar chart of frequency + detail table.

**What it gives you:** Identify recurring error patterns for a specific CU — useful for proactive support conversations.

---

### Page 4 — Performance (The Speed Story)

> Engineering team view. Answer the question: where is time being lost across the pipeline?

#### Stage Duration Heatmap

Grid — rows = CU names, columns = pipeline stages (download / process / persist). Cell color = average duration. Darker color = slower.

**What it gives you:** Instantly identify which CU + stage combination is the bottleneck. Compare all CUs side by side without writing any SQL.

#### Throughput Trend

Line chart of `throughputRowsPerSec` over time across all CUs.

**What it gives you:** Performance degradation over time. A downward trend over weeks signals a systemic issue (growing data volume, DB index bloat, network degradation).

#### Slowest Runs

Top 10 slowest runs by `totalProcessingDurationMs` with click-through to Run Detail.

**What it gives you:** The outliers. Focus engineering attention on the runs that hurt the most.

#### Persist vs Process Split (Donut Chart)

Average split of time: download vs process vs persist across all runs.

**What it gives you:** Confirm where the pipeline spends most of its time. Expected: persist dominates (~97%), confirming the DB write is the dominant cost.

#### Memory Usage Trend

Line chart of `memoryUsedMb` at IngestionCompleted over time per host.

**What it gives you:** Memory leak early warning. A rising baseline over days/weeks that never resets signals a leak in the pipeline process.

---

### Page 5 — Schema Health (Validation & Schema Integrity)

> Catches file format changes from CUs before bad data enters the database.

#### Schema Health Scorecard

Table with one row per CU showing: latest `schemaMatchScore`, last validation timestamp, trend arrow (improving / degrading / stable).

**What it gives you:** Single-table overview of every CU's current schema compliance. Spot the CU that just changed their format.

#### Validation Failure Log

All runs where `validationPassed = false`, showing CU name, file name, error count, missing columns, unknown columns. Filterable by date and CU.

**What it gives you:** Full audit trail of every validation failure. Useful for SLA discussions and CU remediation tracking.

#### Schema Drift Alert Panel

Red banner per CU whose `schemaMatchScore` has dropped more than 5 points compared to their 30-day average.

**What it gives you:** Proactive alert — catch schema drift before it causes data quality issues downstream.

#### Column Anomaly Tracker

Aggregated list of all `unknownColumnsDetected` and `missingRequiredColumns` values seen in the last 30 days.

**What it gives you:** Recurring column issues across all CUs. If the same unknown column appears across 5 CUs, that might indicate a mapping version mismatch rather than a CU-side change.

---

### Page 7 — CU Setup & Configuration (The Onboarding Registry)

> Used by the ops and onboarding team to track which CUs are configured, what their setup looks like, and whether what was configured matches what is actually being observed.

#### KPI Strip (4 headline numbers)

| KPI | What It Tells You | Data Source |
|---|---|---|
| Total CUs | Total Credit Unions registered in the system | COUNT(*) from `CuConfiguration` |
| Active | CUs live in production with regular deliveries | COUNT WHERE `onboardingStatus = 'active'` |
| In Onboarding | CUs currently being set up — not yet live | COUNT WHERE `onboardingStatus = 'onboarding'` |
| Inactive | Churned or paused CUs | COUNT WHERE `onboardingStatus = 'inactive'` |

#### CU Directory Table

The master list of all registered CUs. Filterable by status, environment, owner team, adapter. Sortable by onboarding date.

| Column | Source | Notes |
|---|---|---|
| CU Name | `CuConfiguration.displayName` | Human-readable name |
| CU ID | `CuConfiguration.cuId` | Internal identifier — links to all event tables |
| Status | `CuConfiguration.onboardingStatus` | Badge: green (active) / amber (onboarding) / grey (inactive) |
| Environment | `CuConfiguration.environment` | Badge: Prod / Staging |
| Owner Team | `CuConfiguration.ownerTeam` | |
| Adapter | `CuConfiguration.adapterId` | Configured adapter |
| Container | `CuConfiguration.containerName` | Expected Azure Blob container |
| Mapping Version | `CuConfiguration.mappingVersion` | Configured mapping config |
| SLA Threshold | `CuConfiguration.slaThresholdMs` | Formatted as `30s` |
| Onboarding Date | `CuConfiguration.onboardingDate` | |
| First Run | MIN(`IngestionEvents.timestamp`) per cuId | Derived — null = never delivered |
| Config Drift | Computed flag | Red if observed values differ from configured values |

Clicking any row opens a detail drawer: full configuration fields on the left, live observed stats from the event tables on the right.

**What it gives you:** A single source of truth for every CU's configuration — without querying the database or reading setup docs.

#### Onboarding Timeline

Bar/dot chart — x-axis = calendar month, y-axis = number of CUs onboarded in that month.

**Data:** `CuConfiguration.onboardingDate` grouped by month.

**What it gives you:** CU network growth over time. Spot batch onboarding periods, identify quiet stretches, and project future support load.

#### Status Distribution (Donut Chart)

A donut chart with three slices: Active / Onboarding / Inactive.

**What it gives you:** At a glance — what proportion of the CU network is fully live vs still in setup.

#### Adapter & Mapping Version Spread (Two Bar Charts)

**Adapter Distribution** — x-axis = adapterId, y-axis = CU count.

**What it gives you:** Concentration risk. If 80% of CUs rely on one adapter, a bug there affects most of the network.

**Mapping Version Spread** — x-axis = mappingVersion, y-axis = CU count.

**What it gives you:** How many CUs are on an older mapping config vs the current version. Stale versions cause silent schema mismatches.

#### Config vs Reality Drift Table

The most operationally valuable visual on the page. Cross-references configured values in `CuConfiguration` against values observed in the event tables.

| CU Name | Field | Configured | Observed (latest) | Status |
|---|---|---|---|---|
| Keystone CU | adapterId | `adapter-v2` | `adapter-v2` | OK |
| Summit CU | mappingVersion | `v3.1` | `v3.0` | DRIFT |
| Riverdale CU | containerName | `cu-riverdale-prod` | `cu-riverdale-staging` | DRIFT |
| Pioneer CU | fileType | `full_export` | `delta` | DRIFT |

| Field | Configured source | Observed source |
|---|---|---|
| `adapterId` | `CuConfiguration.adapterId` | Latest `IngestionEvents.adapterId` per cuId |
| `mappingVersion` | `CuConfiguration.mappingVersion` | Latest `PipelineMetrics.mappingVersion` per cuId |
| `containerName` | `CuConfiguration.containerName` | Latest `BlobContext.containerName` per cuId |
| `fileTypes` | `CuConfiguration.fileTypes` | DISTINCT `BusinessContext.fileType` per cuId |
| `slaThresholdMs` | `CuConfiguration.slaThresholdMs` | Latest `BusinessContext.slaThresholdMs` per cuId |

**What it gives you:** Catch misconfiguration silently — a CU delivering to the wrong container or using the wrong adapter will show here before it causes a pipeline failure.

#### First Delivery Gap Chart

Horizontal bar chart — one bar per CU showing days between `onboardingDate` and `MIN(IngestionEvents.timestamp)`.

Special highlight: CUs with `onboardingStatus = 'onboarding'` AND no events yet — shown in amber as "configured but never delivered."

**What it gives you:** Identify CUs stalled in their integration work. A large gap or zero events after onboarding signals the CU needs a follow-up.

#### Owner Team Load Table

Table: Owner Team → CU count → Active count → In Onboarding count → Avg success rate (derived from `IngestionEvents`).

**What it gives you:** Support load distribution across teams. If one team owns 15 CUs and another owns 2, that is a resourcing imbalance.

---

### Page 6 — Alerts & SLA (The Accountability Page)

> Management view. Confirm SLA commitments are being met. Surface runs that need manual intervention.

#### SLA Summary

Total runs this month, SLA met count and %, SLA breached count and %, average actual duration vs SLA threshold (30,000ms).

**What it gives you:** The headline SLA compliance number for reporting to stakeholders.

#### SLA Breach Log

All runs where `slaBreach = true`, ordered by most recent. Columns: CU name, file name, actual duration, threshold, overage (actual - threshold in ms).

**What it gives you:** Full accountability log for every SLA miss. Know exactly which CU, which file, and by how much.

#### Error Summary

Errors grouped by `errorCode` — occurrence count, affected CUs, first seen / last seen dates.

**What it gives you:** Error frequency analysis. If one error code keeps appearing, prioritize a permanent fix.

#### Retry Analysis

Runs that required retries (`retryAttemptNumber > 0`). Bar chart of retry counts grouped by CU and stage.

**What it gives you:** Identify which CUs and pipeline stages generate the most transient failures. High retry counts indicate flaky infrastructure or intermittent connectivity.

#### Failed Runs Pending Action

Dedicated tray of runs with `status = failed` AND `isRecoverable = false` that require manual intervention.

**What it gives you:** An action queue. These runs will not self-heal — they need a human to investigate and remediate.

---

## 6. Data Schema & Data Dictionary

All tables live in the `observability` schema on the TruStage SQL Server database. Every table is linked back to the central event log via `eventId` (foreign key) and `correlationId` (for cross-table queries within a single pipeline run).

---

### Table 1: `observability.IngestionEvents`

**Role:** The central event log. Every event emitted by the ingestion pipeline lands here. All other tables are satellite tables that reference a row in this table.

**Powers:** All dashboard pages — event counts, timeline, run history, live feed.

| Column | Data Type | Nullable | Description |
|---|---|---|---|
| `id` | BIGINT IDENTITY | NOT NULL | Surrogate primary key — auto-incremented integer |
| `eventId` | UNIQUEIDENTIFIER | NOT NULL | Globally unique identifier for this specific event instance |
| `cuId` | NVARCHAR(100) | NOT NULL | Credit Union identifier — the source of the file being ingested (e.g., `CU_Keystone`) |
| `adapterId` | NVARCHAR(200) | NOT NULL | Identifier of the adapter/connector that processed this file |
| `eventType` | NVARCHAR(100) | NOT NULL | The type of event emitted. Allowed values: `RunStarted`, `RunCompleted`, `BlobReceived`, `IngestionStarted`, `ValidationCompleted`, `IngestionCompleted` |
| `stage` | NVARCHAR(100) | NOT NULL | Pipeline stage this event belongs to (e.g., `CuRun`) |
| `timestamp` | DATETIMEOFFSET | NOT NULL | UTC timestamp when the event occurred — primary sort and filter field across all queries |
| `correlationId` | UNIQUEIDENTIFIER | NOT NULL | Groups all events belonging to a single end-to-end pipeline run. Join across all satellite tables using this field |
| `sessionId` | UNIQUEIDENTIFIER | NULL | Optional session scope — groups runs within a session boundary |
| `traceId` | NVARCHAR(100) | NULL | Distributed tracing trace ID — for correlation with external APM tools |
| `spanId` | NVARCHAR(100) | NULL | OpenTelemetry span ID for this event |
| `parentSpanId` | NVARCHAR(100) | NULL | Parent span ID — links child spans to parent for distributed trace reconstruction |
| `metadata` | NVARCHAR(MAX) | NULL | Raw JSON bag of key-value metadata specific to the event type |
| `metrics` | NVARCHAR(MAX) | NULL | Raw JSON of top-level run metrics (populated on `RunCompleted` events) |
| `createdAt` | DATETIME2 | NOT NULL | UTC timestamp when this row was inserted into the table (defaults to `GETUTCDATE()`) |

**Indexes:** `correlationId`, `cuId`, `eventType`, `timestamp`

---

### Table 2: `observability.BlobContext`

**Role:** Captures the Azure Blob Storage context when a file trigger fires. Populated on events where `eventType = 'BlobReceived'`.

**Powers:** Live feed file names, Run Explorer file column, trigger latency analysis.

| Column | Data Type | Nullable | Description |
|---|---|---|---|
| `id` | BIGINT IDENTITY | NOT NULL | Surrogate primary key |
| `eventId` | UNIQUEIDENTIFIER | NOT NULL | Foreign key to `IngestionEvents.eventId` — links this blob context to its parent event |
| `correlationId` | UNIQUEIDENTIFIER | NOT NULL | Run correlation ID — used to join with other satellite tables for the same run |
| `blobName` | NVARCHAR(500) | NOT NULL | Name of the blob file (e.g., `keystone_full_export_20260302.json`) |
| `blobPath` | NVARCHAR(1000) | NOT NULL | Full path to the blob within the storage container |
| `blobSizeBytes` | BIGINT | NULL | Size of the file in bytes at the time it was received |
| `contentType` | NVARCHAR(100) | NULL | MIME content type of the blob (e.g., `application/json`) |
| `eventTime` | DATETIMEOFFSET | NULL | The time the Azure Blob Storage event was emitted (from the storage service) |
| `triggerReceivedTime` | DATETIMEOFFSET | NULL | The time the ingestion pipeline received and processed the trigger |
| `triggerLatencyMs` | INT | NULL | Calculated latency in milliseconds between `eventTime` and `triggerReceivedTime` — how long it took the pipeline to react to the blob event |
| `etag` | NVARCHAR(200) | NULL | Azure Blob Storage ETag — unique identifier for the blob version |
| `containerName` | NVARCHAR(200) | NOT NULL | Name of the Azure Blob Storage container where the file was stored |

**Indexes:** `correlationId`, `blobName`

---

### Table 3: `observability.PipelineMetrics`

**Role:** Captures processing performance metrics for a completed ingestion. Populated on events where `eventType = 'IngestionCompleted'`.

**Powers:** Stage duration heatmap, throughput trend, slowest runs list, run detail stage breakdown chart, row count columns in Run Explorer.

| Column | Data Type | Nullable | Description |
|---|---|---|---|
| `id` | BIGINT IDENTITY | NOT NULL | Surrogate primary key |
| `eventId` | UNIQUEIDENTIFIER | NOT NULL | Foreign key to `IngestionEvents.eventId` |
| `correlationId` | UNIQUEIDENTIFIER | NOT NULL | Run correlation ID |
| `ingestionStartTime` | DATETIMEOFFSET | NULL | UTC timestamp when ingestion processing began |
| `ingestionEndTime` | DATETIMEOFFSET | NULL | UTC timestamp when ingestion processing completed |
| `totalProcessingDurationMs` | INT | NULL | Total wall-clock time for the entire ingestion run in milliseconds — primary performance metric |
| `stageDuration_download` | INT | NULL | Time spent downloading/reading the blob file in milliseconds |
| `stageDuration_process` | INT | NULL | Time spent parsing, mapping, and transforming records in milliseconds |
| `stageDuration_persist` | INT | NULL | Time spent writing processed rows to the target database in milliseconds — typically the dominant stage |
| `rowsRead` | INT | NULL | Total rows read from the source file |
| `rowsProcessed` | INT | NULL | Rows that were successfully transformed and ready to persist |
| `rowsSkipped` | INT | NULL | Rows skipped due to business rules (e.g., duplicates, filtered records) |
| `rowsFailed` | INT | NULL | Rows that failed during processing (parse errors, constraint violations) |
| `rowsWrittenToTarget` | INT | NULL | Rows successfully committed to the target database table |
| `throughputRowsPerSec` | DECIMAL(10,2) | NULL | Calculated throughput: `rowsWrittenToTarget / (totalProcessingDurationMs / 1000)` |
| `mappingVersion` | NVARCHAR(100) | NULL | Version identifier of the column mapping configuration used for this run — useful for tracking schema mapping changes |

**Indexes:** `correlationId`

---

### Table 4: `observability.ValidationMetrics`

**Role:** Captures the results of schema validation performed against the incoming file. Populated on events where `eventType = 'ValidationCompleted'`.

**Powers:** Schema Health scorecard, validation failure log, schema drift alert panel, column anomaly tracker, Run Detail validation report section.

| Column | Data Type | Nullable | Description |
|---|---|---|---|
| `id` | BIGINT IDENTITY | NOT NULL | Surrogate primary key |
| `eventId` | UNIQUEIDENTIFIER | NOT NULL | Foreign key to `IngestionEvents.eventId` |
| `correlationId` | UNIQUEIDENTIFIER | NOT NULL | Run correlation ID |
| `validationPassed` | BIT | NOT NULL | `1` = the file passed all validation checks and is safe to ingest. `0` = validation failed and the file may be rejected or flagged |
| `validationErrorsCount` | INT | NULL | Total number of validation errors found in the file |
| `validationWarningsCount` | INT | NULL | Total number of validation warnings (non-blocking issues) found |
| `schemaMatchScore` | DECIMAL(5,2) | NULL | A 0–100 score reflecting how closely the file's actual schema matches the expected schema. 100 = perfect match. Drops when columns are missing, renamed, or typed incorrectly |
| `missingRequiredColumns` | NVARCHAR(MAX) | NULL | JSON array of column names that were expected but not present in the file (e.g., `["member_id","policy_number"]`) |
| `unknownColumnsDetected` | NVARCHAR(MAX) | NULL | JSON array of column names found in the file that are not in the expected schema — signals CU-side schema additions |
| `dataTypeMismatchCount` | INT | NULL | Count of columns where the detected data type does not match the expected type (e.g., a string where an integer was expected) |
| `nullViolations` | INT | NULL | Count of required (NOT NULL) columns that contained null values in the file |

**Indexes:** `correlationId`

---

### Table 5: `observability.HostContext`

**Role:** Captures the runtime host environment at the time of processing. Populated on events where `eventType = 'IngestionStarted'` or `'IngestionCompleted'`.

**Powers:** Memory usage trend chart (Performance page), Run Detail host snapshot section.

| Column | Data Type | Nullable | Description |
|---|---|---|---|
| `id` | BIGINT IDENTITY | NOT NULL | Surrogate primary key |
| `eventId` | UNIQUEIDENTIFIER | NOT NULL | Foreign key to `IngestionEvents.eventId` |
| `correlationId` | UNIQUEIDENTIFIER | NOT NULL | Run correlation ID |
| `hostName` | NVARCHAR(200) | NULL | Name of the machine/server that executed the ingestion pipeline (e.g., `ZSCHN01LP0298`) |
| `processId` | INT | NULL | OS process ID of the ingestion worker at the time of the event |
| `cpuUsagePercent` | DECIMAL(5,2) | NULL | CPU utilization percentage of the host at the time of the event |
| `memoryUsedMb` | DECIMAL(10,2) | NULL | Memory consumed by the ingestion process in megabytes at the time of the event |
| `threadId` | INT | NULL | OS thread ID handling this specific ingestion run |
| `workerId` | NVARCHAR(100) | NULL | Logical worker identifier within a multi-worker setup |
| `environment` | NVARCHAR(50) | NULL | Runtime environment tag (e.g., `production`, `staging`, `development`) |

**Indexes:** `correlationId`, `hostName`

---

### Table 6: `observability.BusinessContext`

**Role:** Captures business-level metadata about the ingestion run. Populated on events where `eventType = 'IngestionCompleted'`.

**Powers:** SLA Summary, SLA Breach Log, Run Detail Business Summary section, Overview KPI strip SLA breach count, CU Health Grid SLA status.

| Column | Data Type | Nullable | Description |
|---|---|---|---|
| `id` | BIGINT IDENTITY | NOT NULL | Surrogate primary key |
| `eventId` | UNIQUEIDENTIFIER | NOT NULL | Foreign key to `IngestionEvents.eventId` |
| `correlationId` | UNIQUEIDENTIFIER | NOT NULL | Run correlation ID |
| `fileType` | NVARCHAR(100) | NULL | Logical type of file delivered by the CU (e.g., `full_export`, `delta`, `membership`) — used for filtering in Run Explorer |
| `expectedRecordCount` | INT | NULL | The number of records the CU indicated should be in the file (if provided in a manifest or header) |
| `actualRecordCount` | INT | NULL | The actual number of records found and processed in the file |
| `recordCountVariance` | INT | NULL | Calculated as `actualRecordCount - expectedRecordCount`. Negative = fewer records than expected |
| `isFirstRunOfDay` | BIT | NULL | `1` = this is the first file received from this CU today. `0` = subsequent delivery |
| `filesReceivedTodayForCu` | INT | NULL | Running count of how many files have been received from this CU today at the time of this run |
| `slaBreach` | BIT | NULL | `1` = this run exceeded the SLA processing time threshold. `0` = within SLA. The primary SLA compliance field |
| `slaThresholdMs` | INT | NULL | The SLA time limit in milliseconds that applies to this run (typically 30,000ms = 30 seconds) |

**Indexes:** `correlationId`, `slaBreach`

---

### Table 7: `observability.ErrorContext`

**Role:** Captures error and retry context when a pipeline run fails or requires retries. Populated on failure events. Currently the `errorContext` payload may be null on successful runs — this table is ready for use when errors occur.

**Powers:** Error Summary (Alerts page), Retry Analysis, Failed Runs Pending Action tray, Run Detail Error Details section.

| Column | Data Type | Nullable | Description |
|---|---|---|---|
| `id` | BIGINT IDENTITY | NOT NULL | Surrogate primary key |
| `eventId` | UNIQUEIDENTIFIER | NOT NULL | Foreign key to `IngestionEvents.eventId` |
| `correlationId` | UNIQUEIDENTIFIER | NOT NULL | Run correlation ID |
| `status` | NVARCHAR(50) | NULL | Final status of the failed run. Values: `failed`, `partial`, `retrying` |
| `errorCode` | NVARCHAR(100) | NULL | Structured error code for programmatic grouping (e.g., `PARSE_ERROR`, `DB_TIMEOUT`, `SCHEMA_MISMATCH`) |
| `errorMessage` | NVARCHAR(MAX) | NULL | Human-readable error message describing the failure |
| `errorStackTrace` | NVARCHAR(MAX) | NULL | Full stack trace from the exception — collapsed by default in the UI |
| `failedStage` | NVARCHAR(100) | NULL | The pipeline stage where the failure occurred. Values: `parse`, `map`, `transform`, `validate`, `load` |
| `retryAttemptNumber` | INT | NULL | The retry attempt number at the time of this event. `0` = first attempt (no retries). `1` = first retry, etc. |
| `retryReason` | NVARCHAR(500) | NULL | Description of why a retry was triggered (e.g., `TransientDbConnectionError`) |
| `isRecoverable` | BIT | NULL | `1` = the error is considered transient and the pipeline may retry automatically. `0` = the failure is permanent and requires manual intervention |

**Indexes:** `correlationId`, `errorCode`

---

### Table 8: `observability.CuConfiguration`

**Role:** Static configuration registry — one row per Credit Union. Populated manually when a CU is onboarded or updated. This is the only table not written to by the ingestion pipeline. It is the source of truth for what each CU was *configured* to do, as opposed to what was *observed* in the event tables.

**Powers:** CU Setup page — directory table, onboarding timeline, config vs reality drift table, adapter/mapping version spread, first delivery gap chart, owner team load.

| Column | Data Type | Nullable | Description |
|---|---|---|---|
| `id` | BIGINT IDENTITY | NOT NULL | Surrogate primary key |
| `cuId` | NVARCHAR(100) | NOT NULL | Credit Union identifier — must match `IngestionEvents.cuId` exactly. Unique constraint enforced |
| `displayName` | NVARCHAR(200) | NOT NULL | Human-readable name of the Credit Union (e.g., `Keystone Credit Union`) |
| `adapterId` | NVARCHAR(200) | NOT NULL | The adapter/connector that was configured for this CU. Cross-referenced against `IngestionEvents.adapterId` to detect drift |
| `containerName` | NVARCHAR(200) | NOT NULL | The Azure Blob Storage container the CU is expected to deliver files to. Cross-referenced against `BlobContext.containerName` |
| `fileTypes` | NVARCHAR(MAX) | NULL | JSON array of expected file types this CU delivers (e.g., `["full_export","delta"]`). Cross-referenced against `BusinessContext.fileType` |
| `slaThresholdMs` | INT | NOT NULL | The agreed SLA processing time limit in milliseconds (default: 30,000 = 30 seconds). Cross-referenced against `BusinessContext.slaThresholdMs` |
| `mappingVersion` | NVARCHAR(100) | NULL | The column mapping config version assigned to this CU. Cross-referenced against `PipelineMetrics.mappingVersion` |
| `environment` | NVARCHAR(50) | NOT NULL | Deployment environment for this CU. Values: `production`, `staging`. CHECK constraint enforced |
| `onboardingDate` | DATE | NOT NULL | The formal date this CU was onboarded into the platform |
| `onboardingStatus` | NVARCHAR(50) | NOT NULL | Lifecycle state of the CU. Values: `active` (live, delivering), `onboarding` (setup in progress), `inactive` (paused or churned). CHECK constraint enforced |
| `ownerTeam` | NVARCHAR(200) | NULL | Team responsible for supporting this CU |
| `notes` | NVARCHAR(MAX) | NULL | Free-text field for onboarding notes, known issues, or contact information |
| `createdAt` | DATETIME2 | NOT NULL | UTC timestamp when this configuration row was first created |
| `updatedAt` | DATETIME2 | NOT NULL | UTC timestamp when this configuration row was last modified |

**Constraints:** `UNIQUE (cuId)`, `CHECK (onboardingStatus IN ('active','onboarding','inactive'))`, `CHECK (environment IN ('production','staging'))`

**Indexes:** `onboardingStatus`, `environment`, `ownerTeam`

**Join pattern:** Unlike the 7 event tables, `CuConfiguration` does NOT join via `eventId` or `correlationId`. It joins to event tables via `cuId`:
```sql
SELECT cc.*, MIN(ie.timestamp) AS firstRunAt
FROM observability.CuConfiguration cc
LEFT JOIN observability.IngestionEvents ie
    ON ie.cuId = cc.cuId AND ie.eventType = 'RunCompleted'
GROUP BY cc.cuId, cc.displayName, ...
```

---

### Entity Relationship Summary

```
observability.CuConfiguration  (static config — 1 row per CU, joined via cuId)
         |
         | cuId
         v
observability.IngestionEvents  (central event hub — 1 row per event)
         |
         |-- 1:1  observability.BlobContext          (eventType = BlobReceived)
         |-- 1:1  observability.PipelineMetrics      (eventType = IngestionCompleted)
         |-- 1:1  observability.ValidationMetrics    (eventType = ValidationCompleted)
         |-- 1:1  observability.HostContext           (eventType = IngestionStarted | IngestionCompleted)
         |-- 1:1  observability.BusinessContext      (eventType = IngestionCompleted)
         |-- 1:1  observability.ErrorContext         (failure events)
```

Cross-table queries within a pipeline run use `correlationId` as the join key.
All event satellite table foreign keys reference `IngestionEvents.eventId`.
`CuConfiguration` has no FK into event tables — it is joined by the application layer via `cuId`.

---

## 7. Project Structure

```
trustage-observability-dashboard/
|
+-- frontend/                          <- React app (Vite)
|   +-- src/
|   |   +-- pages/
|   |   |   +-- Overview/
|   |   |   |   +-- Overview.tsx
|   |   |   |   +-- KpiStrip.tsx
|   |   |   |   +-- LiveFeed.tsx
|   |   |   |   +-- CuHealthGrid.tsx
|   |   |   |   +-- IngestionTimeline.tsx
|   |   |   +-- RunExplorer/
|   |   |   |   +-- RunExplorer.tsx
|   |   |   |   +-- RunTable.tsx
|   |   |   |   +-- RunFilters.tsx
|   |   |   |   +-- RunDetail/
|   |   |   |       +-- RunDetail.tsx
|   |   |   |       +-- EventTimeline.tsx
|   |   |   |       +-- StageDurationBar.tsx
|   |   |   |       +-- ValidationReport.tsx
|   |   |   |       +-- HostSnapshot.tsx
|   |   |   |       +-- BusinessSummary.tsx
|   |   |   +-- CuDetail/
|   |   |   +-- Performance/
|   |   |   +-- SchemaHealth/
|   |   |   +-- Alerts/
|   |   |   +-- CuSetup/
|   |   |   |   +-- CuSetup.tsx
|   |   |   |   +-- CuSetupKpiStrip.tsx
|   |   |   |   +-- CuDirectoryTable.tsx
|   |   |   |   +-- OnboardingTimeline.tsx
|   |   |   |   +-- ConfigDriftTable.tsx
|   |   |   |   +-- AdapterMappingCharts.tsx
|   |   |   |   +-- FirstDeliveryGapChart.tsx
|   |   |   |   +-- OwnerTeamTable.tsx
|   |   |   |   +-- CuConfigDrawer.tsx    <- detail drawer (config + live stats)
|   |   +-- api/
|   |   |   +-- observability.ts       <- all API calls via axios
|   |   +-- hooks/
|   |   |   +-- useOverviewKpis.ts     <- TanStack Query + 30s auto-refresh
|   |   |   +-- useRunList.ts
|   |   |   +-- useRunDetail.ts
|   |   |   +-- useLiveFeed.ts         <- SignalR connection hook
|   |   |   +-- useCuSetup.ts          <- CU directory, drift, onboarding timeline
|   |   +-- types/
|   |   |   +-- telemetry.ts           <- TypeScript interfaces matching DB schema
|   |   |   +-- cuConfig.ts            <- CuConfiguration interface
|   |   +-- components/
|   |   |   +-- StatusBadge.tsx
|   |   |   +-- SlaIndicator.tsx
|   |   |   +-- DurationBar.tsx
|   |   +-- App.tsx
|   +-- tailwind.config.ts
|   +-- vite.config.ts
|
+-- backend/                           <- ASP.NET Core Web API (.NET 8)
    +-- Endpoints/
    |   +-- OverviewEndpoints.cs       <- /kpis/today, /feed/live, /cu/health, /overview/timeline
    |   +-- RunEndpoints.cs            <- /runs, /runs/{correlationId}
    |   +-- CuEndpoints.cs             <- /cu/{cuId}
    |   +-- PerformanceEndpoints.cs    <- /performance/stages, /performance/throughput
    |   +-- ValidationEndpoints.cs     <- /validation/health
    |   +-- AlertEndpoints.cs          <- /alerts/sla, /alerts/errors
    |   +-- CuSetupEndpoints.cs        <- /cu-setup/*, /cu-setup/{cuId}/drift
    +-- Hubs/
    |   +-- TelemetryHub.cs            <- SignalR hub for live feed broadcast
    +-- Repositories/
    |   +-- ObservabilityRepository.cs <- all Dapper SQL queries
    |   +-- CuConfigurationRepository.cs <- queries against CuConfiguration table
    +-- Models/
    |   +-- TelemetryModels.cs         <- C# DTOs matching observability schema
    |   +-- CuConfigurationModels.cs   <- CuConfigurationDto, CuDriftDto
    +-- Program.cs
```

---

## 8. API Reference

All endpoints are prefixed with `/observability` and served by the ASP.NET Core backend.

| Method | Path | Powers | Primary Tables |
|---|---|---|---|
| GET | `/kpis/today` | Overview KPI Strip | `IngestionEvents`, `BusinessContext` |
| GET | `/feed/live` | Overview Live Pipeline Feed | `IngestionEvents`, `BlobContext`, `PipelineMetrics`, `BusinessContext` |
| GET | `/cu/health` | Overview CU Health Grid | `IngestionEvents`, `BusinessContext`, `PipelineMetrics` |
| GET | `/overview/timeline` | Overview Ingestion Timeline | `IngestionEvents` |
| GET | `/overview/hourly-rows` | Overview Hourly Bar Chart | `PipelineMetrics` |
| GET | `/runs` | Run Explorer Run List (with filters) | `IngestionEvents`, `BlobContext`, `PipelineMetrics`, `ValidationMetrics`, `BusinessContext` |
| GET | `/runs/{correlationId}` | Run Detail full event timeline + all sections | All 7 tables |
| GET | `/cu/{cuId}` | CU Detail summary, run history, validation trend | `IngestionEvents`, `PipelineMetrics`, `ValidationMetrics`, `BusinessContext`, `ErrorContext` |
| GET | `/performance/stages` | Stage Duration Heatmap | `PipelineMetrics`, `IngestionEvents` |
| GET | `/performance/throughput` | Throughput Trend | `PipelineMetrics`, `IngestionEvents` |
| GET | `/validation/health` | Schema Health Scorecard | `ValidationMetrics`, `IngestionEvents` |
| GET | `/alerts/sla` | SLA Summary + Breach Log | `BusinessContext`, `IngestionEvents`, `PipelineMetrics` |
| GET | `/alerts/errors` | Error Summary grouped by code | `ErrorContext`, `IngestionEvents` |
| GET | `/alerts/retries` | Retry Analysis | `ErrorContext`, `IngestionEvents` |
| GET | `/alerts/failed-runs` | Failed Runs Pending Action | `ErrorContext`, `IngestionEvents` |
| GET | `/cu-setup` | CU Directory table + KPI strip | `CuConfiguration`, `IngestionEvents` |
| GET | `/cu-setup/onboarding-timeline` | Onboarding Timeline chart | `CuConfiguration` |
| GET | `/cu-setup/adapter-spread` | Adapter Distribution bar chart | `CuConfiguration` |
| GET | `/cu-setup/mapping-spread` | Mapping Version Spread bar chart | `CuConfiguration`, `PipelineMetrics` |
| GET | `/cu-setup/owner-teams` | Owner Team Load table | `CuConfiguration`, `IngestionEvents` |
| GET | `/cu-setup/{cuId}/drift` | Config vs Reality Drift for one CU | `CuConfiguration`, `IngestionEvents`, `BlobContext`, `PipelineMetrics`, `BusinessContext` |
| GET | `/cu-setup/drift` | Config vs Reality Drift for all CUs | `CuConfiguration`, `IngestionEvents`, `BlobContext`, `PipelineMetrics`, `BusinessContext` |
| WS | `/hubs/telemetry` | SignalR hub — real-time live feed push | `IngestionEvents` |
