# MONITORING_SPEC.md
## TruStage — CU Data Ingestion Monitoring Application
**Version:** 4.0 | **Status:** Authoritative — supersedes all previous specs and details.md  
**Last updated:** March 2026 | **Change in v4.0:** Data sources updated to reflect Kafka event-driven pipeline. All SQL queries now target `kafka.*`, `audit.*`, and `cfl.*` schemas. `observability.*` schema is legacy — do not query it for new features.

---

## ⚠️ CRITICAL INSTRUCTIONS FOR CLAUDE CODE

Read this file completely before touching any file in the repository.

1. **This spec supersedes `details.md` entirely.** `details.md` is archived as `details_v1_original.md`. Do not read it.
2. **Never use internal/engineering terms in any UI-facing code.** The Nomenclature table in Section 1 governs every string, label, placeholder, and comment in UI code.
3. **The wireframe file `WIREFRAME_REFERENCE.html` is the visual authority.** When a task says "implement to match the wireframe," open that file and inspect the exact HTML structure, class names, colour values, and column layouts.
4. **Make one change at a time.** Each task in `IMPLEMENTATION_PLAN.md` is one Claude Code session. Do not anticipate or implement the next task.
5. **The existing app is React 18 + TypeScript + Vite + Tailwind + shadcn/ui on the frontend, ASP.NET Core .NET 8 Minimal APIs + Dapper on the backend.** Do not introduce new frameworks.

---

## Section 1 — Nomenclature (UI Language Law)

This table is law. Every string that appears in the UI — labels, column headers, tooltips, status messages, button text, placeholder text, error messages — must use the left column. The right column terms must never appear in any `.tsx`, `.ts`, `.html`, or `.razor` file visible to the user.

### People & Entities

| ✅ USE THIS | ❌ NEVER USE |
|---|---|
| Credit Union / CU | Client, Customer, Tenant |
| CU Partner | — |
| TruStage Operations Team | — |
| Assigned Engineer | Dev, Developer |

### Lifecycle States (exact strings for UI pills, filters, headings)

| ✅ USE THIS | ❌ NEVER USE |
|---|---|
| `Onboarding` | In Progress, Setup, Dev, Development |
| `Ready for First Feed` | Setup Complete, Deployed, Configured |
| `BAU` | Active, Running, Live, Operational |

> BAU tooltip text: "Business As Usual — this CU partner is live and delivering feeds."

### Data & Pipeline

| ✅ USE THIS | ❌ NEVER USE |
|---|---|
| Data Feed | Run, Pipeline Run, Job, Execution, Ingestion |
| Feed Received | RunStarted, Triggered, BlobReceived |
| Feed Delivered | RunCompleted, Persisted, Completed |
| TruStage Standard | CFL, Canonical, Target Schema, Target Model |
| Written to TruStage Standard | Persisted, CFL Load, Canonical Write, Loaded |
| Standardisation Rules | Mapping, MappingApplied, Mapping Rules |
| Standardisation Rules Version | Mapping Version, MappingRulesJson |
| Member Records | Rows, Records (bare), Data rows |
| Member Records Processed | Rows Processed, RowsProcessed, rowsProcessed |
| Records Rejected | Rows Failed, RowsFailed, rowsFailed |
| Data Validation Check | Data Quality Check, DQ Check, Validation, DQ, ValidationCompleted |
| Data Alignment Score | Schema Match Score, Validation Score, schemaMatchScore |
| CU Format Change | Schema Drift, Schema Change, Drift |
| Feed Reference ID | Correlation ID, CorrelationId, correlationId |
| CU Connector | Adapter, CU Adapter, Adapter Instance |
| CU Connector ID | Adapter ID, AdapterId, adapterId |

### Pipeline Steps (exact strings for step timeline labels)

| ✅ Step Label (UI) | Internal Event Name (backend/DB only — never shown in UI) |
|---|---|
| `Receive CU File` | BlobReceived / BlobDiscoveredEvent |
| `Data Validation Check` | SchemaValidation / SchemaValidationPassedEvent |
| `Apply Standardisation Rules` | Transform / TransformCompletedEvent |
| `Standardise & Transform` | RulesValidation / BusinessRuleValidationPassedEvent |
| `Write to TruStage Standard` | Publishing / PublishCompletedEvent |
| `Feed Delivered` | FinalStatus = Completed / PublishCompletedEvent |

> Step timeline display pattern: Show step label in bold. Show internal event name underneath in small muted monospace. Example:  
> **Data Validation Check** `SchemaValidation`

### Application Tabs & Features

| ✅ USE THIS | ❌ NEVER USE |
|---|---|
| CU Programme View | Fleet Overview, Dashboard, Overview |
| Today's Feeds | Live Pipeline, Pipeline Monitor, Runs Today |
| Feed History | Run Explorer, Run History, Historical Runs |
| CU Detail | CU Page, CU Dashboard |
| Feed Exceptions | Errors, Error Log, Failures, Alerts |
| Feed Reference ID | Correlation ID |
| Data Validation Check | Data Quality Check, DQ Check, Schema Match |
| Data Validation | Data Quality, DQ Report, DQ Tab |
| Data Alignment Score | Schema Match Score |
| Step Timing | Stage Duration, Pipeline Steps |
| CU Format Change | Schema Drift |

---

## Section 2 — Application Overview

### What this application is
A single operational monitoring console for TruStage's CU data ingestion programme. It answers three questions at all times:
1. How many CU partners are onboarded and at what stage?
2. Is today's data arriving correctly, on schedule, and without exceptions?
3. When something goes wrong — exactly which CU, which step, and why?

### What it is NOT
- Not a BI tool or reporting dashboard
- Not a pipeline trigger (read-only in v1)
- Not a row-level data preview tool

### Primary audiences
| Audience | Primary Tabs |
|---|---|
| TruStage — Head of Data | CU Programme View |
| TruStage — Operations Team | Today's Feeds, Feed Exceptions |
| ZUCI — Engineering Team | Feed History, CU Detail |

---

## Section 3 — CU Lifecycle State Model

### State Definitions

| State | Definition | How Determined |
|---|---|---|
| `Onboarding` | CU connector is in development. No production feed has been delivered. | `cfl.CU_Registry.OnboardingStatus = 'Onboarding'` — set manually by ZUCI engineer at registration. No rows in `kafka.BatchJourneys` for this `CuId`. |
| `Ready for First Feed` | Connector deployed to production but zero successful deliveries recorded. | `cfl.CU_Registry.OnboardingStatus = 'Active'` AND no rows in `kafka.BatchJourneys` WHERE `CuId = this CU` AND `FinalStatus = 'Completed'`. |
| `BAU` | At least one feed has been successfully delivered to TruStage Standard. CU is live. | At least one row in `kafka.BatchJourneys` WHERE `CuId = this CU` AND `FinalStatus = 'Completed'`. `cfl.CU_Registry.OnboardingStatus = 'Active'`. |

### State Transition Rules
- Transitions are **automatic**, derived from event data
- Only exception: initial `Onboarding` state is created manually by ZUCI engineer
- `BAU` is **sticky** — subsequent feed failures do NOT revert state to a prior state
- State is never manually changed by a user through the UI

### Staleness Thresholds
| State | Threshold | Visual Treatment |
|---|---|---|
| `Onboarding` | No automatic threshold | No flag |
| `Ready for First Feed` | > 7 days | Amber "Waiting — X days" badge on CU row |
| `BAU` | > 3 days without a `FeedDelivered` event (or beyond `CU_Schedule.NextFeedExpectedAt` if set) | Amber health indicator |

### Health Indicator Logic
| Colour | Condition |
|---|---|
| 🟢 Green | Last feed delivered AND within expected delivery window |
| 🟡 Amber | Last feed delivered BUT overdue — no new feed within expected window |
| 🔴 Red | Last feed failed OR unresolved exception exists for this CU |
| ⚫ Grey | No feed ever delivered (Onboarding or Ready for First Feed) |

---

## Section 4 — Data Sources

> **⚠️ IMPORTANT — READ BEFORE WRITING ANY SQL**
> The pipeline is event-driven via Kafka. Data lands in four schemas: `kafka.*`, `audit.*`, `cfl.*`, and `dbo.*`.
> The old `observability.*` schema is **legacy** — it belongs to the pre-Kafka pipeline. Do not query it for any new feature.
> The `adapter.CU_Configuration` table referenced in earlier spec versions **does not exist** — use `cfl.CU_Registry` instead.

---

### 4.1 CU Registry — `cfl.CU_Registry` (EXISTING — do not create)

**One row per credit union. This is the master CU record.** Populated by manual onboarding operations, not by the pipeline.

| Column | Type | Used For |
|---|---|---|
| `CU_ID` | nvarchar(50) PK | Primary CU identifier — matches `CuId` in all kafka/audit tables |
| `CU_Name` | nvarchar(200) | Display name in all UI |
| `CoreBankingSystem` | nvarchar(100) | Core banking platform label (Keystone, Symitar, Fiserv, DNA, etc.) |
| `SourceFileFormat` | nvarchar(20) | JSON / CSV / Excel |
| `OnboardingStatus` | nvarchar(20) | `Onboarding`, `Active`, `Inactive` — **basis for lifecycle state derivation** |
| `ActiveMappingVersion` | int | Current Standardisation Rules version number |
| `Notes` | nvarchar | Free-text notes |
| `CreatedAt` | datetime | Registration date |
| `UpdatedAt` | datetime | Last modification |

**Lifecycle state is derived from `OnboardingStatus` + presence of completed feeds in `kafka.BatchJourneys`** — see Section 3.

**New columns needed (additive migration only):**
- `AssignedEngineer` NVARCHAR(100) NULL — ZUCI engineer responsible for this CU
- `StateEnteredAt` DATETIME2 NULL — when the CU last changed lifecycle state

---

### 4.2 Delivery Schedule — `adapter.CU_Schedule` (NEW — must be created)

This table does not exist yet. It is the only genuinely new table required.

| Column | Type | Purpose |
|---|---|---|
| `CuId` | nvarchar(50) PK | FK to `cfl.CU_Registry.CU_ID` |
| `FrequencyDays` | int | How often the CU sends a feed (default 1 = daily) |
| `NextFeedExpectedAt` | datetime2 NULL | Next expected delivery timestamp |
| `DeliveryWindowMinutes` | int | Tolerance window around expected time (default 120) |

---

### 4.3 Feed Lifecycle — `kafka.BatchJourneys` (EXISTING)

**One row per file processed. This is the primary feed data source for the monitoring app.**
Each row is created when a file is first ingested and updated by each of the 5 pipeline stages.

| Column | UI Display Name | Notes |
|---|---|---|
| `CorrelationId` | Feed Reference ID | Stable GUID from Event Grid webhook. Unique per file. |
| `BatchId` | — (internal) | Assigned by Transform stage. Links to `audit.*` tables. |
| `CuId` | — | Matches `cfl.CU_Registry.CU_ID` |
| `BlobName` | File Name | Full blob path e.g. `CreditUnionJson/keystone_full_export.json` |
| `FinalStatus` | Status | `InProgress` → `Completed` / `Failed` |
| `IngestedAt` | Feed Received | Timestamp Stage 1 completed |
| `TransformedAt` | — (internal step) | Timestamp Stage 2 completed |
| `SchemaValidatedAt` | — (internal step) | Timestamp Stage 3 completed |
| `RulesValidatedAt` | — (internal step) | Timestamp Stage 4 completed |
| `PublishedAt` | Feed Delivered | Timestamp Stage 5 completed — this is the delivery timestamp |
| `RecordsIn` | — | Total records read from source (set by Transform) |
| `RecordsDropped` | Records Rejected | Records blocked by validation gates |
| `RecordsOut` | Member Records Processed | Records successfully written to TruStage Standard |
| `TotalDurationMs` | Feed Duration | Wall-clock ms from `IngestedAt` → `PublishedAt` |

**Derived Status logic for UI (from `FinalStatus` + `RecordsDropped`):**
- `FinalStatus = 'Completed'` AND `RecordsDropped = 0` → **Delivered** (green)
- `FinalStatus = 'Completed'` AND `RecordsDropped > 0` → **Partial** (amber)
- `FinalStatus = 'Failed'` → **Failed** (red)
- `FinalStatus = 'InProgress'` → **In Progress** (blue)

---

### 4.4 Step Timing — `kafka.PipelineStageTimings` (EXISTING)

**One row per stage per feed.** 5 rows inserted per successfully processed file.

| Column | UI Display Name | Notes |
|---|---|---|
| `CorrelationId` | Feed Reference ID | FK to `kafka.BatchJourneys.CorrelationId` |
| `CuId` | — | CU identifier |
| `StageName` | Step Label (mapped) | `Ingestion`, `Transform`, `SchemaValidation`, `RulesValidation`, `Publishing` |
| `StartedAt` | — | Stage start timestamp |
| `CompletedAt` | — | Stage completion timestamp |
| `DurationMs` | Duration | Stage duration in milliseconds |

**StageName → UI Step Label mapping (apply at API serialization layer):**

| `StageName` (DB) | Step Label (UI) |
|---|---|
| `Ingestion` | Receive CU File |
| `SchemaValidation` | Data Validation Check |
| `Transform` | Apply Standardisation Rules |
| `RulesValidation` | Standardise & Transform |
| `Publishing` | Write to TruStage Standard |

---

### 4.5 Validation Report — `audit.PipelineValidationReports` (EXISTING)

**One row per ingestion batch — the complete validation gate report.**
Linked to `kafka.BatchJourneys` via: `BatchJourneys.BatchId = PipelineValidationReports.IngestionBatchId`

| Column | UI Display Name | Notes |
|---|---|---|
| `IngestionBatchId` | — (internal) | Matches `kafka.BatchJourneys.BatchId` |
| `CU_ID` | — | CU identifier |
| `OverallStatus` | Validation Status | `Passed`, `PartiallyPassed`, `Failed` |
| `AllGatesPassed` | — | `1` = all 3 gates passed |
| `TotalErrors` | — | Total errors across all gates |
| `TotalWarnings` | — | Total warnings across all gates |
| `Gate1Passed` | Schema Check | Source → Transformed: count reconciliation, required fields |
| `Gate1ErrorCount` | — | Error count from Gate 1 |
| `Gate2Passed` | Business Rules Check | Source → ReadyForProd: business rules, referential integrity |
| `Gate2ErrorCount` | — | Error count from Gate 2 |
| `Gate3Passed` | DB Reconciliation | Source → Prod: DB count reconciliation after save |
| `Gate3ErrorCount` | — | Error count from Gate 3 |
| `SourceMemberCount` | — | Members in raw source file |
| `ProdMemberCount` | — | Members confirmed in `cfl.CU_Members` |
| `SourceAccountCount` | — | Accounts in raw source file |
| `ProdAccountCount` | — | Accounts confirmed in `cfl.CU_Accounts` |
| `SourceLoanCount` | — | Loans in raw source file |
| `ProdLoanCount` | — | Loans confirmed in `cfl.CU_Loans` |
| `DqBlocked` | Records Rejected | Records excluded by validation gates |
| `DqWarnings` | — | Records that passed but triggered warnings |
| `GateDetailsJson` | — | Full JSON of all gate results — used for field-level error display |

**Data Alignment Score** is derived from gate results:
- All gates passed, no warnings → 100%
- Derive as: `(ProdMemberCount / SourceMemberCount) * 100` — capped at 100%
- Display: green ≥ 95%, amber 80–94%, red < 80%

---

### 4.6 Batch Audit — `audit.IngestionBatches` (EXISTING)

**One row per processed file — created by the Publishing stage.**

| Column | UI Display Name | Notes |
|---|---|---|
| `IngestionBatchId` | — (internal) | Matches `kafka.BatchJourneys.BatchId` |
| `CU_ID` | — | CU identifier |
| `RunType` | — | `Full` or `Delta` |
| `MappingVersion` | Standardisation Rules Version | Active mapping version used for this feed |
| `SourceFilePath` | File Path | Full blob path |
| `Status` | — | `Queued` → `Running` → `Completed` / `Failed` |
| `RowsRead` | — | Total rows read from source |
| `RowsLoaded` | Member Records Processed | Rows written to `cfl.*` tables |
| `RowsFailed` | Records Rejected | Rows dropped |
| `StartedAt` | Feed Started | Processing start time |
| `CompletedAt` | Feed Delivered | Processing end time |

---

### 4.7 Pipeline Failures — `kafka.DlqEvents` (EXISTING)

**One row per message that failed all retries and was routed to a Dead Letter Queue.**
These are hard failures — the pipeline stopped on this file. ZUCI investigation required.

| Column | UI Display Name | Notes |
|---|---|---|
| `Id` | — | Auto-increment PK |
| `TopicName` | — (internal) | DLQ topic e.g. `creditunionjson_transform_dlq` |
| `StageName` | Failed Step | Pipeline stage that failed: maps to step labels in Section 4.4 |
| `CuId` | CU Partner | CU identifier |
| `CorrelationId` | Feed Reference ID | Links to `kafka.BatchJourneys` |
| `Payload` | — (raw) | JSON payload at time of failure — show summary only in UI |
| `OccurredAt` | First Occurred | Failure timestamp |

**These are the "Delivery Failures" (hard failures) shown in Feed Exceptions Tab 5.**

---

### 4.8 Field-Level Errors — `dbo.AdapterRunErrors` (EXISTING — legacy)

Row-level field errors from adapter processing. Used in Feed Exceptions expanded detail.

| Column | UI Display Name | Notes |
|---|---|---|
| `RowIndex` | Row | Row number in source file |
| `FieldName` | Field | Field that caused the error |
| `Message` | Reason | Error description |
| `Severity` | — | `Error`, `Warning`, `Info` |
| `RawValue` | Source Value | The raw value that failed |

---

### 4.9 Key Join: Feed Reference ID → Validation Report

To get from a Feed Reference ID (shown in UI) to its validation report:

```sql
SELECT pvr.*
FROM kafka.BatchJourneys bj
JOIN audit.PipelineValidationReports pvr 
    ON pvr.IngestionBatchId = bj.BatchId
WHERE bj.CorrelationId = @FeedReferenceId
```

To get step timings for a feed:

```sql
SELECT *
FROM kafka.PipelineStageTimings
WHERE CorrelationId = @FeedReferenceId
ORDER BY StartedAt ASC
```

---

### 4.10 Column Name Mapping (DB → UI)

When displaying data, apply these display names at the API serialization layer only.
Never rename DB columns or TypeScript interface properties.

| DB Column / Source | Display Label |
|---|---|
| `kafka.BatchJourneys.CorrelationId` | Feed Reference ID |
| `kafka.BatchJourneys.RecordsOut` | Member Records Processed |
| `kafka.BatchJourneys.RecordsDropped` | Records Rejected |
| `kafka.BatchJourneys.TotalDurationMs` | Feed Duration |
| `kafka.BatchJourneys.IngestedAt` | Feed Received |
| `kafka.BatchJourneys.PublishedAt` | Feed Delivered |
| `kafka.PipelineStageTimings.DurationMs` | Step Duration |
| `kafka.PipelineStageTimings.StageName` | Step Label (mapped per Section 4.4) |
| `audit.IngestionBatches.MappingVersion` | Standardisation Rules Version |
| `audit.IngestionBatches.RowsLoaded` | Member Records Processed |
| `audit.PipelineValidationReports.DqBlocked` | Records Rejected |
| `cfl.CU_Registry.CU_Name` | CU Partner Name |
| `cfl.CU_Registry.CoreBankingSystem` | Core Banking Platform |
| `kafka.DlqEvents.StageName` | Failed Step (mapped per Section 4.4) |
| `kafka.DlqEvents.OccurredAt` | First Occurred |

---

## Section 5 — Navigation & Tab Structure

### Route Map (React Router)

```
/                        → CU Programme View    (Tab 1 — default)
/feeds                   → Today's Feeds        (Tab 2)
/history                 → Feed History         (Tab 3)
/history/:feedRefId      → Feed History — Feed Detail panel open
/cu/:cuId                → CU Detail            (Tab 4)
/exceptions              → Feed Exceptions      (Tab 5)
```

### Sidebar Navigation

Five items. Always visible. Feed Exceptions item shows a red badge with count of unresolved exceptions when count > 0.

```
🏢  CU Programme View
📥  Today's Feeds
🔍  Feed History
🏦  CU Detail
⚠️  Feed Exceptions    [3]   ← red badge when unresolved > 0
```

### Drill-Down Pattern

```
CU Programme View
    └── CU Detail  (click CU name anywhere in the app)
          └── Feed History / Feed Detail  (click any feed row)
                    └── Feed Exception Detail  (link from Feed Detail panel)
```

Breadcrumb trail required at every level. Back navigation never dead-ends.

---

## Section 6 — Tab Specifications

### Tab 1 — CU Programme View

**Purpose:** Programme-level health. How many CUs at each lifecycle stage? What is broken right now?

#### 6.1 Exception Banner
Shown at top when unresolved exceptions > 0. Red background. Format:
> 🔴 [N] active feed exceptions across [N] CU partners — last exception [X] minutes ago  [View Exceptions →]

Session-dismissible. Reappears when new exception arrives. Never permanently hidden.

#### 6.2 Lifecycle State Strip — Three stat cards (full width)

| Card | Value | Sub-label | Colour | On Click |
|---|---|---|---|---|
| Onboarding | Count | Avg days in this state | Blue | Opens slide-over panel: per-CU list |
| Ready for First Feed | Count | CUs waiting >7 days shown amber | Amber | Opens slide-over panel: per-CU list |
| BAU | Count | Overdue CUs count shown amber | Green | Opens slide-over panel: per-CU list |

Auto-generated summary sentence below cards. Format:
> "As of today, [N] of [total] CU partners are in BAU — delivering data feeds to TruStage Standard. [N] are deployed and awaiting their first feed. [N] connectors are currently in development."

#### 6.3 Lifecycle State Slide-Over Panels

Each panel shows a table of CUs in that state with:
- CU Name, Core Banking Platform, Days in State, Assigned Engineer
- Owner dropdown (assign to any team member)
- Note field — free text, timestamped, full history on "View all notes"
- Amber highlight for CUs past staleness threshold

#### 6.4 CU Partner Fleet Table

Sortable, filterable. One row per CU. Clicking CU name → CU Detail.

| Column | Source | Notes |
|---|---|---|
| CU Partner Name | `cfl.CU_Registry.CU_Name` | Link → CU Detail |
| Core Banking Platform | `cfl.CU_Registry.CoreBankingSystem` | Symitar / Corelation / Fiserv / DNA |
| Lifecycle State | Derived from `OnboardingStatus` + `BatchJourneys` | Colour pill |
| Days in State | `DATEDIFF(day, cfl.CU_Registry.StateEnteredAt, GETUTCDATE())` | Amber flag if past threshold |
| Last Feed Delivered | Latest `kafka.BatchJourneys.PublishedAt` WHERE `FinalStatus = 'Completed'` | "Not yet" if none |
| Next Feed Expected | `adapter.CU_Schedule.NextFeedExpectedAt` | "Not scheduled" if null |
| Last Feed Duration | `kafka.BatchJourneys.TotalDurationMs` (latest) | In seconds |
| Member Records (last) | `kafka.BatchJourneys.RecordsOut` (latest) | Latest feed |
| Records Rejected (last) | `kafka.BatchJourneys.RecordsDropped` (latest) | Red if > 0 |
| Health | Derived (Section 3) | Green/Amber/Red/Grey pill |
| Owner | `cfl.CU_Registry.AssignedEngineer` | Initials badge |

Filters: Lifecycle State, Core Banking Platform, Health, free-text CU name search.

---

### Tab 2 — Today's Feeds

**Purpose:** Daily operations view. Are today's feeds arriving on time? Anything failing or overdue right now?

#### 6.5 Summary Strip — Four stat cards

| Card | Value | Thresholds |
|---|---|---|
| Feeds Received Today | COUNT of `kafka.BatchJourneys` WHERE `DATE(IngestedAt) = today` | — |
| Successful Delivery Rate | `FinalStatus = 'Completed'` / total feeds today | ≥98% green, 90-97% amber, <90% red |
| Active Feed Exceptions | COUNT of unresolved `kafka.DlqEvents` + unresolved `audit.PipelineValidationReports` | 0 green, 1-2 amber, 3+ red |
| BAU Partners Active Today | Distinct `CuId` with `FinalStatus = 'Completed'` today | — |

#### 6.6 Exception Banner
Same as Tab 1 banner.

#### 6.7 Delivery Schedule — Gantt Chart

- X-axis: time of day 00:00–23:59
- Y-axis: one row per BAU CU partner
- Grey bands: expected delivery windows from `adapter.CU_Schedule`
- Coloured bars: actual feeds from `kafka.BatchJourneys` WHERE `DATE(IngestedAt) = today` (green = Completed, red = Failed, amber = Partial)
- Overdue label: BAU CU whose `NextFeedExpectedAt` has passed with no `BatchJourneys` row today → amber "Overdue" label
- Hover tooltip: CU name, start time, duration, member records, status
- CUs without schedule: no grey band shown; feed bars still appear when delivered

#### 6.8 Live Feed Event Ticker

Last 30 events across all CUs. Auto-refresh every 30 seconds (existing SignalR infrastructure).
Row format: Step badge (colour) | CU name | file name | timestamp | duration | status pill
Exception events → highlighted red, floated to top.

#### 6.9 CU Partner Status Grid

Cards — one per BAU CU. Ready for First Feed CUs shown muted with "Awaiting first feed delivery" label.
Card shows: CU name | last delivery time | status | member records today | Data Alignment Score | exception indicator.
Click → CU Detail.

---

### Tab 3 — Feed History

**Purpose:** Find any feed, trace it step by step. Used when debugging a failure or investigating unexpected data.

#### 6.10 Feed List Table

Filters: CU partner, date range, status (Delivered/Failed/Partial), free-text.

| Column | Source |
|---|---|
| Feed Reference ID | `kafka.BatchJourneys.CorrelationId` |
| CU Partner Name | `cfl.CU_Registry.CU_Name` via `CuId` join |
| Feed Started | `kafka.BatchJourneys.IngestedAt` |
| Total Duration | `kafka.BatchJourneys.TotalDurationMs` (seconds) |
| Member Records Processed | `kafka.BatchJourneys.RecordsOut` |
| Records Rejected | `kafka.BatchJourneys.RecordsDropped` |
| Data Alignment Score | Derived from `audit.PipelineValidationReports` (see Section 4.5) |
| Status | Derived from `kafka.BatchJourneys.FinalStatus` + `RecordsDropped` (see Section 4.3) |

Click any row → Feed Detail slide-over panel.

#### 6.11 Feed Detail Panel — Four inner tabs

**Tab A — Step Timeline**

Vertical stepper. One item per stage from `kafka.PipelineStageTimings` for this `CorrelationId`, in `StartedAt` order.
Failed feeds: show a red terminal step with the DLQ failure detail from `kafka.DlqEvents`.

Display pattern per step:
```
[dot]  Step Label (bold)        [StageName — small muted mono]
       HH:MM:SS  ·  Xs
       [meta line — score, record count, version, etc.]
```

Step sequence (StageName → Step Label per Section 4.4):
1. Receive CU File `Ingestion` → shows file name from `BlobName`
2. Data Validation Check `SchemaValidation` → shows Gate 1 result from `audit.PipelineValidationReports`
3. Apply Standardisation Rules `Transform` → shows `audit.IngestionBatches.MappingVersion`
4. Standardise & Transform `RulesValidation` → shows `RecordsIn` from `kafka.BatchJourneys`
5. Write to TruStage Standard `Publishing` → shows `RecordsOut` from `kafka.BatchJourneys`
6. Feed Delivered *(derived from `FinalStatus = Completed`)* → shows `TotalDurationMs`

**Tab B — Step Timing**

Horizontal stacked bar. One segment per step. Colour-coded.
Steps: Receive CU File | Data Validation Check | Apply Standardisation Rules | Standardise & Transform | Write to TruStage Standard
Legend below bar with step name, duration in ms, and percentage of total.
Insight line if Write to TruStage Standard > 80% of total time.

Source: `kafka.PipelineStageTimings` WHERE `CorrelationId = @feedRefId`, ordered by `StartedAt`.

**Tab C — Data Validation Report**

Source: `audit.PipelineValidationReports` joined via `kafka.BatchJourneys.BatchId`.

Three-gate status display (see Section 4.5 for gate definitions):
```
Gate 1 — Schema Check        [✅ Passed / ❌ Failed]   Gate1ErrorCount errors
Gate 2 — Business Rules      [✅ Passed / ⚠ Partial]   Gate2ErrorCount errors · DqWarnings warnings
Gate 3 — DB Reconciliation   [✅ Passed / ❌ Failed]   Gate3ErrorCount errors
```

Data Alignment Score gauge (circular): derived as `(ProdMemberCount / SourceMemberCount) * 100`.
Green ≥ 95%, amber 80–94%, red < 80%.

Record counts table:
- Source Member Count vs Members Written to TruStage Standard
- Source Account Count vs Accounts Written to TruStage Standard
- Source Loan Count vs Loans Written to TruStage Standard
- Records Rejected (DqBlocked)
- Warnings (DqWarnings)

If `GateDetailsJson` contains field-level errors from `dbo.AdapterRunErrors`:
Show a collapsible field error table: Row | Field | Source Value | Reason

**Tab D — Feed Summary**

Key-value list sourced from `kafka.BatchJourneys` JOIN `audit.IngestionBatches`:
- CU Partner (`cfl.CU_Registry.CU_Name`)
- Feed Reference ID (`CorrelationId` — monospace)
- Standardisation Rules Version (`audit.IngestionBatches.MappingVersion`)
- Feed Received / Feed Delivered (`IngestedAt` / `PublishedAt`)
- Total Duration (`TotalDurationMs` in seconds)
- Expected by (`adapter.CU_Schedule.NextFeedExpectedAt`) — shows On time / Late
- Member Records Written (`RecordsOut`)
- Records Rejected (`RecordsDropped`)
- Run Type (`audit.IngestionBatches.RunType` — Full / Delta)
- Delivery Status pill (derived per Section 4.3)

---

### Tab 4 — CU Detail

**Purpose:** Deep profile of one CU partner. Accessible by clicking any CU name.

#### 6.12 CU Header

Full-width navy bar:
CU name (large) | Lifecycle State pill | Core Banking Platform | CU Connector ID | Onboarding date | Assigned Engineer | Environment

If unresolved exceptions exist for this CU: red exception banner appears above header.

#### 6.13 Programme Summary Stats — Four cards

Total Feeds Delivered (all time) | Successful Delivery Rate | Avg Delivery Duration | Total Member Records Written to TruStage Standard

#### 6.14 Charts (all scoped to selected CU)

| Chart | Type | Source | Period |
|---|---|---|---|
| Delivery Duration Trend | Line | `kafka.BatchJourneys.TotalDurationMs` per feed WHERE `CuId = ?` | 30 days |
| Data Alignment Score Over Time | Line | Derived from `audit.PipelineValidationReports` per batch | 30 days |
| Step Timing Trend | Stacked area | `kafka.PipelineStageTimings.DurationMs` per stage per feed | 30 days |
| Member Records Volume Trend | Bar | `kafka.BatchJourneys.RecordsOut` per feed WHERE `CuId = ?` | 30 days |

Today's Delivery Gantt — same as Tab 2 Gantt scoped to this CU only.

#### 6.15 Recent Feeds Table

Last 20 feeds. Columns: Date | Duration | Member Records | Records Rejected | Data Alignment Score | Status.
Click row → Feed Detail panel.

---

### Tab 5 — Feed Exceptions

**Purpose:** All exceptions across all CUs. Every exception logged, with owner, notes, and resolution tracking.

#### 6.16 Exception Summary Strip — Four cards

| Card | Value | Colour |
|---|---|---|
| Total Exceptions (all time) | COUNT from exception store | Grey |
| Active — Unresolved | `ResolvedFlag = false` | Red |
| Resolved Today | `ResolvedAt = today` | Green |
| Recurring Exceptions | Same `ExceptionCode` + same `CuId`, `RecurrenceCount > 1` | Amber |

#### 6.17 Exception List — Default Sort

Unresolved first, then most recent. Collapsed rows.

| Column | Source | Notes |
|---|---|---|
| First Occurred | `FirstOccurredAt` | Amber "Recurred N×" badge if `RecurrenceCount > 1` |
| CU Partner Name | via join | Link → CU Detail |
| Exception Type | `ExceptionCode` plain-language label | — |
| Failed Step | `FailedStep` | Uses step labels from Nomenclature |
| Status | `ResolvedFlag` | Active (red) / Resolved (green) pill |
| Owner | `OwnerId` | "Unassigned" in amber if null |

#### 6.18 Expanded Exception Row

Click row to expand inline. Shows:
- Full exception message (untruncated)
- Retry count and timestamp of last retry
- Stack trace (collapsed by default — one click to expand)
- Occurrence history timeline (all instances of same `ExceptionCode` + `CuId`)
- Owner assignment dropdown
- Note field (free text, timestamped, history viewable)
- "Mark as Resolved" button — records `ResolvedAt` and `ResolvedById`
- "View Feed Detail →" link — opens Feed Detail panel for the `FeedReferenceId`

#### 6.19 Recurring vs One-Off Treatment

Recurring exception: same `ExceptionCode` for same `CuId`, `RecurrenceCount > 1`.
Visual treatment: "Recurred N×" amber badge replaces date in the list row. Expanded view shows full occurrence timeline.
A first-time and a recurring exception MUST look visually different — they require different urgency levels.

---

## Section 7 — Database Changes Required

> All migrations must be additive and non-destructive. Never DROP a table or column.
> Run verification queries in Section 4 before executing any migration.

### 7.1 Migration 001 — Extend `cfl.CU_Registry` (additive columns only)

`cfl.CU_Registry` already exists. Add two new columns needed by the monitoring app:

```sql
-- Migration: 001_extend_cu_registry.sql | Safe to re-run: YES
IF COL_LENGTH('cfl.CU_Registry', 'AssignedEngineer') IS NULL
    ALTER TABLE cfl.CU_Registry 
        ADD AssignedEngineer NVARCHAR(100) NULL;

IF COL_LENGTH('cfl.CU_Registry', 'StateEnteredAt') IS NULL
    ALTER TABLE cfl.CU_Registry 
        ADD StateEnteredAt DATETIME2 NULL DEFAULT GETUTCDATE();
```

### 7.2 Migration 002 — Create `adapter.CU_Schedule` (new table)

This is the only entirely new table required. `adapter` schema must be created first.

```sql
-- Migration: 002_create_cu_schedule.sql | Safe to re-run: YES
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
```

### 7.3 Migration 003 — Add exception ownership to `kafka.DlqEvents` (additive columns)

Feed Exceptions need owner assignment and resolution tracking. Add these to `kafka.DlqEvents`:

```sql
-- Migration: 003_add_dlq_ownership_columns.sql | Safe to re-run: YES
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
```

### 7.4 Verification Queries (run before any migration)

```sql
-- Confirm cfl.CU_Registry exists and has data
SELECT COUNT(*) FROM cfl.CU_Registry;

-- Confirm kafka.BatchJourneys exists and has data  
SELECT TOP 5 CorrelationId, CuId, FinalStatus, TotalDurationMs 
FROM kafka.BatchJourneys ORDER BY IngestedAt DESC;

-- Confirm kafka.PipelineStageTimings exists
SELECT DISTINCT StageName FROM kafka.PipelineStageTimings;
-- Expected: Ingestion, Transform, SchemaValidation, RulesValidation, Publishing

-- Confirm audit.PipelineValidationReports exists
SELECT TOP 1 * FROM audit.PipelineValidationReports;

-- Confirm kafka.DlqEvents exists
SELECT COUNT(*) FROM kafka.DlqEvents;

-- Confirm adapter.CU_Schedule does NOT yet exist (before migration 002)
SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'adapter' AND TABLE_NAME = 'CU_Schedule';
-- Expected: 0
```

---

### 7.5 New API Endpoints Required

```
-- Programme View
GET  /api/programme/lifecycle-counts          → state strip counts + summary sentence
GET  /api/programme/cu-fleet                  → fleet table (with filters)
GET  /api/programme/lifecycle-panel/{state}   → slide-over panel CU list per state

-- Today's Feeds
GET  /api/feeds/today/summary                 → four KPI cards
GET  /api/feeds/today/gantt                   → Gantt data (bars + expected windows)
GET  /api/feeds/today/ticker                  → last 30 events
GET  /api/feeds/today/grid                    → CU status cards

-- Feed History
GET  /api/history/feeds                       → feed list with filters
GET  /api/history/feeds/{feedRefId}           → feed detail — all sections

-- CU Detail
GET  /api/cu/{cuId}/summary                   → header + stat cards
GET  /api/cu/{cuId}/charts                    → all chart data
GET  /api/cu/{cuId}/recent-feeds              → last 20 feeds table

-- Feed Exceptions
GET  /api/exceptions/summary                  → four KPI cards
GET  /api/exceptions                          → exception list with filters
GET  /api/exceptions/{id}                     → full exception detail
PATCH /api/exceptions/{id}/owner              → assign owner
PATCH /api/exceptions/{id}/note               → add note
PATCH /api/exceptions/{id}/resolve            → mark resolved

-- Exception badge (sidebar)
GET  /api/exceptions/unresolved-count         → { count: N } — polled every 60s
```

---

## Section 8 — Tech Stack (unchanged from original)

```
Frontend:  React 18 + TypeScript + Vite + TanStack Query + React Router v6
           Tailwind CSS + shadcn/ui + lucide-react + Recharts + date-fns
           @microsoft/signalr (live feed) + @azure/msal-react (auth)

Backend:   ASP.NET Core .NET 8 Minimal APIs + Dapper + Microsoft.Data.SqlClient
           Microsoft.AspNetCore.SignalR + Microsoft.Identity.Web

Database:  TruStage Azure SQL Server
           - kafka.*   : BatchJourneys, PipelineStageTimings, DlqEvents, TopicOffsets, ConsumerGroupLags
           - audit.*   : IngestionBatches, PipelineValidationReports
           - cfl.*     : CU_Registry, CU_Members, CU_Accounts, CU_Loans, CU_Transactions
           - adapter.* : CU_Schedule (new — created by migration)
           - dbo.*     : AdapterRunErrors (legacy — read-only reference for field errors)
           - observability.* : LEGACY — do not query for new features
```

### Project File Structure (target state — after full implementation)

```
trustage-observability-dashboard/
│
├── MONITORING_SPEC.md              ← this file (read first)
├── IMPLEMENTATION_PLAN.md          ← task list for Claude Code
├── WIREFRAME_REFERENCE.html        ← visual reference
├── details_v1_original.md          ← archived original spec (do not read)
│
├── frontend/src/
│   ├── pages/
│   │   ├── CuProgrammeView/        ← replaces Overview/
│   │   │   ├── CuProgrammeView.tsx
│   │   │   ├── LifecycleStateStrip.tsx
│   │   │   ├── LifecyclePanel.tsx  (slide-over)
│   │   │   ├── ExceptionBanner.tsx
│   │   │   └── CuFleetTable.tsx
│   │   ├── TodaysFeeds/            ← new
│   │   │   ├── TodaysFeeds.tsx
│   │   │   ├── FeedsSummaryStrip.tsx
│   │   │   ├── DeliveryGantt.tsx
│   │   │   ├── LiveFeedTicker.tsx  (migrated from Overview/LiveFeed.tsx)
│   │   │   └── CuStatusGrid.tsx   (migrated from Overview/CuHealthGrid.tsx)
│   │   ├── FeedHistory/            ← replaces RunExplorer/
│   │   │   ├── FeedHistory.tsx
│   │   │   ├── FeedListTable.tsx
│   │   │   ├── FeedFilters.tsx
│   │   │   └── FeedDetail/
│   │   │       ├── FeedDetail.tsx
│   │   │       ├── StepTimeline.tsx     (replaces EventTimeline.tsx)
│   │   │       ├── StepTimingBar.tsx    (replaces StageDurationBar.tsx)
│   │   │       ├── DataValidationReport.tsx (replaces ValidationReport.tsx)
│   │   │       ├── HostSnapshot.tsx     (unchanged)
│   │   │       └── FeedSummary.tsx      (replaces BusinessSummary.tsx)
│   │   ├── CuDetail/               ← extended from existing
│   │   ├── FeedExceptions/         ← new (replaces Alerts/)
│   │   │   ├── FeedExceptions.tsx
│   │   │   ├── ExceptionSummaryStrip.tsx
│   │   │   ├── ExceptionList.tsx
│   │   │   └── ExceptionRow.tsx    (expandable)
│   │   ├── Performance/            ← kept from original (no changes in v3)
│   │   └── SchemaHealth/           ← kept from original (no changes in v3)
│   ├── api/
│   │   ├── programme.ts            ← new
│   │   ├── feeds.ts                ← new
│   │   ├── history.ts              ← replaces observability.ts for run queries
│   │   ├── exceptions.ts           ← new
│   │   └── observability.ts        ← kept for Performance and SchemaHealth
│   ├── hooks/
│   │   ├── useProgramme.ts         ← new
│   │   ├── useTodaysFeeds.ts       ← new
│   │   ├── useFeedHistory.ts       ← new
│   │   ├── useFeedDetail.ts        ← replaces useRunDetail.ts
│   │   ├── useExceptions.ts        ← new
│   │   ├── useUnresolvedCount.ts   ← new (sidebar badge)
│   │   ├── useLiveFeed.ts          ← kept (SignalR — no changes)
│   │   └── useOverviewKpis.ts      ← kept for Performance/SchemaHealth pages
│   └── types/
│       ├── telemetry.ts            ← kept — DO NOT RENAME existing interfaces
│       ├── programme.ts            ← new
│       └── exceptions.ts           ← new
│
└── backend/
    ├── Endpoints/
    │   ├── ProgrammeEndpoints.cs   ← new
    │   ├── FeedsEndpoints.cs       ← new
    │   ├── HistoryEndpoints.cs     ← replaces RunEndpoints.cs
    │   ├── ExceptionEndpoints.cs   ← new
    │   ├── CuEndpoints.cs          ← extended
    │   ├── PerformanceEndpoints.cs ← unchanged
    │   └── ValidationEndpoints.cs  ← unchanged
    ├── Repositories/
    │   ├── ProgrammeRepository.cs  ← new
    │   ├── FeedsRepository.cs      ← new
    │   ├── ExceptionRepository.cs  ← new
    │   └── ObservabilityRepository.cs ← kept — DO NOT MODIFY existing methods
    ├── Models/
    │   ├── TelemetryModels.cs      ← kept — DO NOT RENAME existing types
    │   ├── ProgrammeModels.cs      ← new
    │   └── ExceptionModels.cs      ← new
    └── Migrations/
        ├── 001_extend_cu_registry.sql
        ├── 002_create_cu_schedule.sql
        └── 003_add_dlq_ownership_columns.sql
```

---

## Section 9 — Preserved from Original App (Do Not Break)

The following pages and their backing code are **not being changed in this refactor**. Do not touch them.

- `Performance` page and all its components, hooks, endpoints, and queries
- `SchemaHealth` page and all its components, hooks, endpoints, and queries
- `ObservabilityRepository.cs` — existing methods must not be modified (new methods may be added)
- `TelemetryModels.cs` — existing interfaces must not be renamed or removed
- `TelemetryHub.cs` — SignalR hub — no changes
- All existing `@tanstack/react-query` hooks that are not explicitly renamed in the file structure above

---

## Section 10 — TypeScript Types — New Interfaces

Add these to `types/programme.ts` and `types/exceptions.ts`. Do not modify `types/telemetry.ts`.

```typescript
// types/programme.ts

export type LifecycleState = 'Onboarding' | 'Ready for First Feed' | 'BAU';
export type HealthStatus = 'Healthy' | 'Overdue' | 'Failed' | 'Awaiting';
export type CoreBankingPlatform = 'Symitar' | 'Corelation' | 'Fiserv' | 'DNA' | string;
export type FeedStatus = 'Delivered' | 'Failed' | 'Partial' | 'InProgress';

// Maps to cfl.CU_Registry (+ derived fields)
export interface CuConfiguration {
  cuId: string;                          // CU_Registry.CU_ID
  cuName: string;                        // CU_Registry.CU_Name
  coreBankingPlatform: CoreBankingPlatform; // CU_Registry.CoreBankingSystem
  onboardingStatus: string;              // CU_Registry.OnboardingStatus
  activeMappingVersion: number | null;   // CU_Registry.ActiveMappingVersion
  assignedEngineer: string | null;       // CU_Registry.AssignedEngineer (new column)
  stateEnteredAt: string | null;         // CU_Registry.StateEnteredAt (new column)
  createdAt: string;                     // CU_Registry.CreatedAt
  // Derived on backend:
  lifecycleState: LifecycleState;
  daysInState: number;
}

export interface CuSchedule {
  cuId: string;
  nextFeedExpectedAt: string | null;
  frequencyDays: number;
  deliveryWindowMinutes: number;
}

export interface CuFleetRow extends CuConfiguration {
  lastFeedDeliveredAt: string | null;    // kafka.BatchJourneys.PublishedAt (latest)
  lastFeedCorrelationId: string | null;  // kafka.BatchJourneys.CorrelationId (latest)
  nextFeedExpectedAt: string | null;     // adapter.CU_Schedule.NextFeedExpectedAt
  lastFeedDurationMs: number | null;     // kafka.BatchJourneys.TotalDurationMs (latest)
  lastFeedMemberRecords: number | null;  // kafka.BatchJourneys.RecordsOut (latest)
  lastFeedRecordsRejected: number | null; // kafka.BatchJourneys.RecordsDropped (latest)
  healthStatus: HealthStatus;
}

export interface LifecycleCounts {
  onboarding: number;
  readyForFirstFeed: number;
  bau: number;
  total: number;
  overdueBau: number;
  overdueReady: number;
}

export interface GanttEntry {
  cuId: string;
  cuName: string;
  expectedWindowStart: string | null;   // adapter.CU_Schedule.NextFeedExpectedAt
  expectedWindowEnd: string | null;     // NextFeedExpectedAt + DeliveryWindowMinutes
  feeds: {
    feedReferenceId: string;            // kafka.BatchJourneys.CorrelationId
    startedAt: string;                  // kafka.BatchJourneys.IngestedAt
    deliveredAt: string | null;         // kafka.BatchJourneys.PublishedAt
    durationMs: number | null;          // kafka.BatchJourneys.TotalDurationMs
    status: FeedStatus;
    memberRecords: number | null;       // kafka.BatchJourneys.RecordsOut
  }[];
}

// Feed list row — from kafka.BatchJourneys JOIN cfl.CU_Registry
export interface FeedSummary {
  feedReferenceId: string;              // CorrelationId
  cuId: string;
  cuName: string;
  feedStarted: string;                  // IngestedAt
  feedDelivered: string | null;         // PublishedAt
  totalDurationMs: number | null;       // TotalDurationMs
  memberRecordsProcessed: number | null; // RecordsOut
  recordsRejected: number | null;       // RecordsDropped
  dataAlignmentScore: number | null;    // Derived from audit.PipelineValidationReports
  status: FeedStatus;
}
```

```typescript
// types/exceptions.ts

// Maps to kafka.DlqEvents (hard pipeline failures)
export interface FeedException {
  exceptionId: string;                  // kafka.DlqEvents.Id (as string)
  feedReferenceId: string;              // kafka.DlqEvents.CorrelationId
  cuId: string;                         // kafka.DlqEvents.CuId
  cuName: string;                       // joined from cfl.CU_Registry
  exceptionCode: string;                // derived from TopicName/StageName
  exceptionMessage: string;             // summarised from Payload JSON
  failedStep: string;                   // StageName mapped to step label (Section 4.4)
  retryCount: number;                   // always 3 for DLQ events (exhausted retries)
  rawPayload: string | null;            // kafka.DlqEvents.Payload — show collapsed
  resolvedFlag: boolean;                // kafka.DlqEvents.ResolvedFlag (new column)
  resolvedAt: string | null;
  resolvedById: string | null;
  ownerId: string | null;
  ownerNote: string | null;
  ownerNoteAt: string | null;
  firstOccurredAt: string;              // kafka.DlqEvents.OccurredAt
  recurrenceCount: number;              // kafka.DlqEvents.RecurrenceCount (new column)
}

export interface ExceptionSummary {
  totalAllTime: number;
  activeUnresolved: number;
  resolvedToday: number;
  recurringCount: number;
}

// Feed validation issue — from audit.PipelineValidationReports (soft failures)
export interface ValidationIssue {
  ingestionBatchId: string;
  feedReferenceId: string;              // joined from kafka.BatchJourneys.CorrelationId
  cuId: string;
  cuName: string;
  overallStatus: 'Passed' | 'PartiallyPassed' | 'Failed';
  gate1Passed: boolean;
  gate1ErrorCount: number;
  gate2Passed: boolean;
  gate2ErrorCount: number;
  gate3Passed: boolean;
  gate3ErrorCount: number;
  recordsRejected: number;              // DqBlocked
  warnings: number;                     // DqWarnings
  reportedAt: string;
}
```
