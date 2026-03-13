# Product Requirements Document
## TruStage Observability Dashboard
**Version:** 1.0  
**Date:** March 5, 2026  
**Author:** TruStage Engineering  
**Status:** Draft

---

## 1. Executive Summary

TruStage receives data files from multiple Credit Unions (CUs) daily. Each file goes through an ingestion pipeline — triggered by an Azure Blob event on the local system — and is parsed, validated, transformed, and persisted to the database. Today, when something goes wrong or slows down, the team has no single place to look. They dig through raw logs, query the database manually, or wait for someone to report a problem.

The **TruStage Observability Dashboard** changes that. It is a single-pane-of-glass view built on top of the `observability` schema in the TruStage SQL Server database. It tells the story of every file, every CU, and every run — from the moment a blob lands in Azure to the last row written to the database.

The dashboard is built for **three audiences**:
- **Operations team** — who need to know right now if something is broken
- **Engineering team** — who need to diagnose why something broke
- **Business / management** — who need confidence that CUs are delivering and SLAs are met

---

## 2. Problem Statement

| Pain Point | Today | With Dashboard |
|---|---|---|
| Pipeline failures | Discovered by end users reporting missing data | Caught in real-time on the dashboard |
| SLA tracking | Manual calculation from logs | Automatic SLA breach flag per run |
| CU health | Unknown until file is late | Per-CU health card updated after every run |
| Performance bottlenecks | Requires SQL queries to find | Stage-level duration chart per run |
| Schema drift | Discovered after bad data is loaded | Validation score drop triggers alert |
| Historical trends | Not available | 30/60/90 day charts on every metric |

---

## 3. Goals & Non-Goals

### Goals
- Provide a real-time overview of all CU ingestion activity
- Enable drill-down from a single run → full event timeline
- Surface SLA breaches, validation failures, and errors proactively
- Show performance trends over time per CU and per file type
- Require zero manual SQL querying for day-to-day operations

### Non-Goals
- This dashboard does NOT replace application logs (it complements them)
- It does NOT provide row-level data preview of ingested records
- It does NOT trigger pipeline reruns (read-only in v1)

---

## 4. Data Sources

All data is sourced exclusively from the `observability` schema in TruStage SQL Server:

| Table | Powers |
|---|---|
| `observability.IngestionEvents` | All pages — event counts, timeline, run history |
| `observability.BlobContext` | File details, trigger latency, blob size |
| `observability.PipelineMetrics` | Stage durations, row counts, throughput |
| `observability.ValidationMetrics` | Schema health, validation pass/fail |
| `observability.HostContext` | Memory usage, CPU, host info |
| `observability.BusinessContext` | SLA breach, file type, daily file counts |
| `observability.ErrorContext` | Error codes, failed stages, retry counts |

---

## 5. Pages & Features

---

### Page 1 — 🏠 Overview (The Morning Brief)

> *"Every morning, the ops team opens this page and knows in 10 seconds if everything is healthy."*

This is the entry point. It tells the story of **today's pipeline health** at a glance before the user needs to click anything.

#### 5.1.1 Header KPI Strip
Four headline numbers across the top:

| KPI | Source Query | Good | Warning | Critical |
|---|---|---|---|---|
| Runs Today | COUNT of RunCompleted events today | — | — | — |
| Success Rate | RunCompleted with rowsFailed = 0 / total | ≥ 98% | 90–97% | < 90% |
| SLA Breaches Today | COUNT of slaBreach = true in BusinessContext | 0 | 1–2 | 3+ |
| Active CUs Today | DISTINCT cuId with RunCompleted today | — | — | — |

#### 5.1.2 Live Pipeline Feed
A real-time scrolling event feed showing the last 20 events across all CUs, auto-refreshing every 30 seconds.

Each row shows:
- Event type badge (color-coded: BlobReceived = blue, IngestionCompleted = green, RunCompleted = grey, Error = red)
- CU name
- File name (from BlobContext)
- Timestamp
- Duration (from PipelineMetrics.totalProcessingDurationMs)
- Status pill (Success / Failed / Partial)

**Source tables:** `IngestionEvents` JOIN `BlobContext` JOIN `PipelineMetrics` JOIN `BusinessContext`

#### 5.1.3 CU Health Grid
A card grid — one card per Credit Union — showing their current health status.

Each card shows:
- CU name
- Last run time
- Last run status (green / red / yellow)
- Files received today
- Rows processed today
- SLA status (Met / Breached)

Clicking a card navigates to **Page 3 — CU Detail**.

**Source tables:** `IngestionEvents`, `BusinessContext`, `PipelineMetrics`

#### 5.1.4 Today's Ingestion Timeline
A horizontal timeline chart (x-axis = time of day, y-axis = CU) showing when each CU's file runs happened today, color-coded by status.

Useful for spotting: "CU_Gamma always runs at 9am but hasn't fired today."

**Source tables:** `IngestionEvents` WHERE eventType = 'RunCompleted' AND date = today

#### 5.1.5 Rows Processed — Hourly Bar Chart
A bar chart showing total rows written to target per hour today across all CUs.

**Source table:** `PipelineMetrics` grouped by hour of ingestionEndTime

---

### Page 2 — 🔍 Run Explorer (The Detective View)

> *"Something went wrong. The engineer opens this page, finds the exact run, and traces it event by event."*

This page lists every pipeline run with full filtering and drill-down.

#### 5.2.1 Run List Table
Filterable, sortable table of all runs.

| Column | Source |
|---|---|
| Correlation ID | IngestionEvents.correlationId |
| CU Name | IngestionEvents.cuId |
| File Name | BlobContext.blobName |
| File Type | BusinessContext.fileType |
| Started At | IngestionEvents.timestamp (RunStarted) |
| Duration | PipelineMetrics.totalProcessingDurationMs |
| Rows Processed | PipelineMetrics.rowsProcessed |
| Rows Failed | PipelineMetrics.rowsFailed |
| Validation | ValidationMetrics.validationPassed |
| SLA | BusinessContext.slaBreach |
| Status | Derived from IngestionEvents.eventType presence |

**Filters:** CU name, date range, status, file type, SLA breach toggle

#### 5.2.2 Run Detail Drawer / Page
Clicking any run opens a full detail view:

**Section A — Event Timeline**
A vertical stepper showing all events for that correlationId in order:
```
✅ BlobReceived        07:10:38  →  blob: keystone_full_export_20260302.json
✅ RunStarted          07:10:38
✅ IngestionStarted    07:10:38  →  host: ZSCHN01LP0298, memory: 3.6MB
✅ ValidationCompleted 07:10:39  →  schema: 100%, errors: 0
✅ IngestionCompleted  07:10:52  →  40 rows, 13.6s
✅ RunCompleted        07:10:52  →  duration: 13,636ms
```

**Section B — Stage Duration Breakdown**
Horizontal stacked bar showing time spent in each stage:
- Download: 256ms (2%)
- Process: 36ms (0.3%)
- Persist: 13,253ms (97.7%)

**Source table:** `PipelineMetrics.stageDuration_*`

**Section C — Validation Report**
Schema match score gauge, error/warning counts, missing columns list, unknown columns list.

**Section D — Host Snapshot**
Side-by-side: memory at start vs end, CPU, thread ID, host name.

**Section E — Business Summary**
File type, actual vs expected record count, SLA threshold vs actual duration, first run of day flag.

**Section F — Error Details** *(if errorContext exists)*
Error code, message, failed stage, retry attempts, stack trace (collapsed by default).

---

### Page 3 — 🏦 CU Detail (The Credit Union Story)

> *"The ops manager wants to know: is CU_Gamma reliable? Have they ever breached SLA? Are their files getting bigger?"*

One page per Credit Union, accessible from the Overview CU Health Grid.

#### 5.3.1 CU Summary Header
- CU name and adapter ID
- Total runs (all time)
- Overall success rate (%)
- Average processing duration (ms)
- Total rows ever processed
- SLA breach count (all time)
- First file received date / Most recent file received date

#### 5.3.2 Run History Chart
Line chart — x-axis = date, y-axis = processing duration (ms) — showing trend over last 30/60/90 days. Overlays SLA threshold as a red dotted line.

**Source table:** `PipelineMetrics` JOIN `IngestionEvents` WHERE cuId = selected CU

#### 5.3.3 Daily File Volume Chart
Bar chart showing number of files and total rows received per day over the last 30 days.

#### 5.3.4 Validation Health Over Time
Line chart of `schemaMatchScore` over time. A dip signals schema drift from the CU.

**Source table:** `ValidationMetrics` JOIN `IngestionEvents`

#### 5.3.5 Recent Runs Table
Last 20 runs for this CU with same columns as Run Explorer, click-through to Run Detail.

#### 5.3.6 Error History
All errors ever recorded for this CU from `ErrorContext`, grouped by `errorCode`. Bar chart of frequency + table below.

---

### Page 4 — ⚡ Performance (The Speed Story)

> *"The engineering team wants to know: where is time being lost? Is the persist stage always slow?"*

#### 5.4.1 Stage Duration Heatmap
Grid: rows = CU names, columns = pipeline stages (download / process / persist). Cell color = average duration. Instantly shows which CU + stage combination is slowest.

**Source table:** `PipelineMetrics` grouped by cuId

#### 5.4.2 Throughput Trend
Line chart of `throughputRowsPerSec` over time across all CUs. Spot degradation over time.

#### 5.4.3 Slowest Runs
Top 10 slowest runs by `totalProcessingDurationMs` with click-through to Run Detail.

#### 5.4.4 Persist vs Process Split
Pie/donut showing the average split of time: download vs process vs persist across all runs. (Expected result: persist dominates as seen in your logs — 97%)

#### 5.4.5 Memory Usage Trend
Line chart of `memoryUsedMb` at IngestionCompleted over time per host. Useful for spotting memory leaks.

**Source table:** `HostContext` WHERE eventType = 'IngestionCompleted'

---

### Page 5 — ✅ Validation & Schema Health

> *"A CU changed their file format without telling us. This page catches it before bad data gets in."*

#### 5.5.1 Schema Health Scorecard
Table: one row per CU, showing their latest `schemaMatchScore`, last validation timestamp, and a trend arrow (up/down/stable).

#### 5.5.2 Validation Failure Log
All runs where `validationPassed = false`, showing CU name, file name, error count, missing columns, unknown columns. Filterable by date and CU.

#### 5.5.3 Schema Drift Alert Panel
Highlight any CU whose `schemaMatchScore` has dropped by more than 5 points compared to their 30-day average. Red banner per affected CU.

#### 5.5.4 Column Anomaly Tracker
Aggregated list of all `unknownColumnsDetected` and `missingRequiredColumns` values seen across all runs in the last 30 days. Helps identify recurring column issues.

---

### Page 6 — 🚨 Alerts & SLA (The Accountability Page)

> *"Management wants to know: are we meeting our commitments to Credit Unions?"*

#### 5.6.1 SLA Summary
- Total runs this month
- SLA met count and %
- SLA breached count and %
- Average duration vs SLA threshold (30,000ms)

#### 5.6.2 SLA Breach Log
All runs where `slaBreach = true`, ordered by most recent. Columns: CU, file, duration, threshold, overage (duration - threshold).

#### 5.6.3 Error Summary
Grouped by `errorCode` — count of occurrences, affected CUs, first seen / last seen dates.

#### 5.6.4 Retry Analysis
Runs that required retries (`retryAttemptNumber > 0`). Bar chart of retry counts. Shows which CUs and stages cause the most retries.

#### 5.6.5 Failed Runs Pending Action
A dedicated tray of runs with `status = failed` and `isRecoverable = false` that need manual intervention. Stays visible until resolved.

---

## 6. Navigation Structure

```
TruStage Observability
│
├── 🏠  Overview          (default landing page)
├── 🔍  Run Explorer      (all runs, filters, drill-down)
├── 🏦  CU Detail         (per-CU page, reached from Overview card)
├── ⚡  Performance       (stage durations, throughput, memory)
├── ✅  Schema Health     (validation scores, drift detection)
└── 🚨  Alerts & SLA      (breaches, errors, retry analysis)
```

---

## 7. Key SQL Queries (Per Page)

### Overview — KPI Strip
```sql
-- Runs today + success rate
SELECT
    COUNT(*)                                                AS totalRuns,
    SUM(CASE WHEN JSON_VALUE(metrics,'$.rowsFailed') = '0'
             THEN 1 ELSE 0 END) * 100.0 / COUNT(*)         AS successRate
FROM observability.IngestionEvents
WHERE eventType = 'RunCompleted'
  AND CAST(timestamp AS DATE) = CAST(GETUTCDATE() AS DATE);
```

### Overview — SLA Breaches Today
```sql
SELECT COUNT(*) AS slaBreachesToday
FROM observability.BusinessContext bc
JOIN observability.IngestionEvents ie ON bc.eventId = ie.eventId
WHERE bc.slaBreach = 1
  AND CAST(ie.timestamp AS DATE) = CAST(GETUTCDATE() AS DATE);
```

### Run Explorer — Full Run List
```sql
SELECT
    ie.correlationId,
    ie.cuId,
    bc.blobName,
    biz.fileType,
    MIN(ie.timestamp)                   AS startedAt,
    pm.totalProcessingDurationMs,
    pm.rowsProcessed,
    pm.rowsFailed,
    vm.validationPassed,
    biz.slaBreach
FROM observability.IngestionEvents ie
LEFT JOIN observability.BlobContext bc       ON bc.correlationId = ie.correlationId
LEFT JOIN observability.PipelineMetrics pm   ON pm.correlationId = ie.correlationId
LEFT JOIN observability.ValidationMetrics vm ON vm.correlationId = ie.correlationId
LEFT JOIN observability.BusinessContext biz  ON biz.correlationId = ie.correlationId
WHERE ie.eventType = 'RunCompleted'
GROUP BY ie.correlationId, ie.cuId, bc.blobName, biz.fileType,
         pm.totalProcessingDurationMs, pm.rowsProcessed, pm.rowsFailed,
         vm.validationPassed, biz.slaBreach
ORDER BY MIN(ie.timestamp) DESC;
```

### Performance — Stage Duration Heatmap
```sql
SELECT
    ie.cuId,
    AVG(pm.stageDuration_download)  AS avg_download_ms,
    AVG(pm.stageDuration_process)   AS avg_process_ms,
    AVG(pm.stageDuration_persist)   AS avg_persist_ms
FROM observability.PipelineMetrics pm
JOIN observability.IngestionEvents ie ON pm.correlationId = ie.correlationId
GROUP BY ie.cuId;
```

---

## 8. Tech Stack

### 8.1 Full Stack Overview

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER                             │
│   React 18 + TypeScript + Vite                          │
│   TanStack Query · React Router · Recharts              │
│   Tailwind CSS · shadcn/ui · Lucide Icons               │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS / REST + SignalR
┌──────────────────────────▼──────────────────────────────┐
│                  ASP.NET Core Web API (.NET 8)           │
│   Minimal APIs · Dapper · SignalR Hub                   │
│   Azure AD Authentication (MSAL)                        │
└──────────────────────────┬──────────────────────────────┘
                           │ SQL over TCP
┌──────────────────────────▼──────────────────────────────┐
│        TruStage SQL Server — observability schema        │
└─────────────────────────────────────────────────────────┘
```

---

### 8.2 Frontend — React Layer

#### Core Framework
| Package | Version | Purpose |
|---|---|---|
| `react` | 18.x | UI framework |
| `typescript` | 5.x | Type safety across all components |
| `vite` | 5.x | Build tool — fast dev server and HMR |

#### Routing
| Package | Purpose |
|---|---|
| `react-router-dom` v6 | Page routing — Overview, Run Explorer, CU Detail, Performance, Schema Health, Alerts |

Route structure:
```
/                        → Overview
/runs                    → Run Explorer
/runs/:correlationId     → Run Detail
/cu/:cuId                → CU Detail
/performance             → Performance
/schema-health           → Schema & Validation Health
/alerts                  → Alerts & SLA
```

#### Server State & Data Fetching
| Package | Purpose |
|---|---|
| `@tanstack/react-query` v5 | API data fetching, caching, background refresh, loading/error states |
| `axios` | HTTP client for API calls |

TanStack Query handles the 30-second auto-refresh on the Overview page cleanly:
```typescript
// Auto-refreshes every 30 seconds — no manual polling needed
const { data: kpis } = useQuery({
  queryKey: ['overview-kpis'],
  queryFn: () => api.get('/observability/kpis/today'),
  refetchInterval: 30_000,
});
```

#### Charts & Visualisation
| Package | Purpose |
|---|---|
| `recharts` | Line charts, bar charts, area charts, pie/donut charts |
| `@tremor/react` | Pre-built dashboard KPI cards, progress bars, stat tiles |

Chart usage per page:
```
Overview        → AreaChart (rows/hour), BarChart (CU timeline)
Run Explorer    → No charts (table-focused)
Run Detail      → BarChart (stage durations stacked)
CU Detail       → LineChart (duration trend), BarChart (daily volume)
Performance     → Heatmap (custom), LineChart (throughput)
Schema Health   → LineChart (schema score over time), BarChart (error freq)
Alerts & SLA    → DonutChart (SLA met/breach), BarChart (error codes)
```

#### UI Components & Styling
| Package | Purpose |
|---|---|
| `tailwindcss` v3 | Utility-first CSS — all layout and spacing |
| `shadcn/ui` | Pre-built accessible components: Table, Dialog, Badge, Drawer, Tabs, Tooltip, Sheet |
| `lucide-react` | Icons — consistent icon set throughout |
| `clsx` + `tailwind-merge` | Conditional class utilities |
| `date-fns` | Date formatting for timestamps |
| `@radix-ui/react-*` | Headless primitives backing shadcn/ui |

#### Real-Time Feed (Overview Live Pipeline Feed)
| Package | Purpose |
|---|---|
| `@microsoft/signalr` | WebSocket connection to ASP.NET Core SignalR hub for live event feed |

```typescript
// Connects to SignalR hub — new events push instantly to Overview feed
const connection = new HubConnectionBuilder()
  .withUrl('/hubs/telemetry')
  .withAutomaticReconnect()
  .build();

connection.on('NewEvent', (event: IngestionEvent) => {
  queryClient.invalidateQueries({ queryKey: ['live-feed'] });
});
```

#### Forms & Filters
| Package | Purpose |
|---|---|
| `react-hook-form` | Filter forms on Run Explorer (date range, CU, status) |
| `zod` | Schema validation for filter inputs |

#### Authentication
| Package | Purpose |
|---|---|
| `@azure/msal-react` | Azure AD SSO — integrates with existing TruStage auth |
| `@azure/msal-browser` | Browser-side MSAL token management |

---

### 8.3 Backend — ASP.NET Core Web API

| Package | Purpose |
|---|---|
| `.NET 8 Minimal APIs` | Lightweight REST endpoints per dashboard page |
| `Dapper` | Micro-ORM for SQL queries against observability schema |
| `Microsoft.Data.SqlClient` | SQL Server connection |
| `Microsoft.AspNetCore.SignalR` | Real-time event push to Overview feed |
| `Microsoft.Identity.Web` | Azure AD token validation |

#### API Endpoint Map
```
GET  /observability/kpis/today               → Overview KPI strip
GET  /observability/feed/live                → Overview live event feed
GET  /observability/cu/health                → CU Health Grid cards
GET  /observability/runs                     → Run Explorer list (with filters)
GET  /observability/runs/{correlationId}     → Run Detail full event timeline
GET  /observability/cu/{cuId}                → CU Detail summary + charts
GET  /observability/performance/stages       → Stage duration heatmap data
GET  /observability/performance/throughput   → Throughput trend data
GET  /observability/validation/health        → Schema health scorecard
GET  /observability/alerts/sla               → SLA summary + breach log
GET  /observability/alerts/errors            → Error summary grouped by code

WS   /hubs/telemetry                         → SignalR hub for live feed
```

---

### 8.4 Project Structure

```
trustage-observability-dashboard/
│
├── frontend/                          ← React app (Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Overview/
│   │   │   │   ├── Overview.tsx
│   │   │   │   ├── KpiStrip.tsx
│   │   │   │   ├── LiveFeed.tsx
│   │   │   │   ├── CuHealthGrid.tsx
│   │   │   │   └── IngestionTimeline.tsx
│   │   │   ├── RunExplorer/
│   │   │   │   ├── RunExplorer.tsx
│   │   │   │   ├── RunTable.tsx
│   │   │   │   ├── RunFilters.tsx
│   │   │   │   └── RunDetail/
│   │   │   │       ├── RunDetail.tsx
│   │   │   │       ├── EventTimeline.tsx
│   │   │   │       ├── StageDurationBar.tsx
│   │   │   │       ├── ValidationReport.tsx
│   │   │   │       ├── HostSnapshot.tsx
│   │   │   │       └── BusinessSummary.tsx
│   │   │   ├── CuDetail/
│   │   │   ├── Performance/
│   │   │   ├── SchemaHealth/
│   │   │   └── Alerts/
│   │   ├── api/
│   │   │   └── observability.ts       ← all API calls via axios
│   │   ├── hooks/
│   │   │   ├── useOverviewKpis.ts
│   │   │   ├── useRunList.ts
│   │   │   ├── useRunDetail.ts
│   │   │   └── useLiveFeed.ts         ← SignalR hook
│   │   ├── types/
│   │   │   └── telemetry.ts           ← TypeScript interfaces matching JSON schema
│   │   ├── components/
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── SlaIndicator.tsx
│   │   │   └── DurationBar.tsx
│   │   └── App.tsx
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
└── backend/                           ← ASP.NET Core Web API
    ├── Endpoints/
    │   ├── OverviewEndpoints.cs
    │   ├── RunEndpoints.cs
    │   ├── CuEndpoints.cs
    │   ├── PerformanceEndpoints.cs
    │   ├── ValidationEndpoints.cs
    │   └── AlertEndpoints.cs
    ├── Hubs/
    │   └── TelemetryHub.cs            ← SignalR hub
    ├── Repositories/
    │   └── ObservabilityRepository.cs ← Dapper queries
    ├── Models/
    │   └── TelemetryModels.cs
    └── Program.cs
```

---

### 8.5 TypeScript Interfaces (matching your JSON exactly)

```typescript
// types/telemetry.ts

export interface IngestionEvent {
  eventId: string;
  cuId: string;
  adapterId: string;
  eventType: 'RunStarted' | 'RunCompleted' | 'BlobReceived' |
             'IngestionStarted' | 'ValidationCompleted' | 'IngestionCompleted';
  stage: string;
  timestamp: string;
  correlationId: string;
  sessionId: string | null;
  traceId: string | null;
  spanId: string | null;
  parentSpanId: string | null;
  metadata: Record<string, string>;
  metrics: RunMetrics | null;
}

export interface BlobContext {
  blobName: string;
  blobPath: string;
  blobSizeBytes: number;
  contentType: string;
  eventTime: string;
  triggerReceivedTime: string;
  triggerLatencyMs: number;
  etag: string;
  containerName: string;
}

export interface PipelineMetrics {
  ingestionStartTime: string;
  ingestionEndTime: string;
  totalProcessingDurationMs: number;
  stageDurations: { download: number; process: number; persist: number; };
  rowsRead: number;
  rowsProcessed: number;
  rowsSkipped: number;
  rowsFailed: number;
  rowsWrittenToTarget: number;
  throughputRowsPerSec: number;
  mappingVersion: string;
}

export interface ValidationMetrics {
  validationPassed: boolean;
  validationErrorsCount: number;
  validationWarningsCount: number;
  schemaMatchScore: number;
  missingRequiredColumns: string[];
  unknownColumnsDetected: string[];
  dataTypeMismatchCount: number;
  nullViolations: number;
}

export interface HostContext {
  hostName: string;
  processId: number;
  cpuUsagePercent: number | null;
  memoryUsedMb: number;
  threadId: number;
  workerId: string;
  environment: string;
}

export interface BusinessContext {
  fileType: string;
  expectedRecordCount: number | null;
  actualRecordCount: number;
  recordCountVariance: number | null;
  isFirstRunOfDay: boolean;
  filesReceivedTodayForCu: number;
  slaBreach: boolean;
  slaThresholdMs: number;
}

export interface ErrorContext {
  status: string;
  errorCode: string;
  errorMessage: string;
  failedStage: string;
  retryAttemptNumber: number;
  retryReason: string;
  isRecoverable: boolean;
}
```

---

### 8.6 Data Flow — SQL Server to React UI

Every piece of data on the dashboard originates from the `observability` schema in TruStage SQL Server. Here is the complete flow from database to screen:

```
observability schema (SQL Server)
         │
         │  Dapper query (raw SQL)
         ▼
ObservabilityRepository.cs
         │
         │  Returns typed C# model
         ▼
ASP.NET Core Minimal API Endpoint
         │
         │  Serialized as JSON over HTTPS
         ▼
axios (React frontend)
         │
         │  Cached + managed by TanStack Query
         ▼
React Component renders chart / table / card
```

---

### 8.7 Backend Data Layer — Dapper + SQL Server

Dapper is used as the data access layer. Each dashboard page has a dedicated repository method that runs a parameterized SQL query directly against the `observability` schema.

**Connection setup:**
```csharp
// appsettings.json
{
  "ConnectionStrings": {
    "TruStage": "Server=<your-server>;Database=TruStage;
                 Integrated Security=true;TrustServerCertificate=true;"
  }
}

// ObservabilityRepository.cs
public class ObservabilityRepository(IConfiguration config)
{
    private IDbConnection Connect() =>
        new SqlConnection(config.GetConnectionString("TruStage"));
}
```

**Example — Overview KPI query:**
```csharp
public async Task<OverviewKpiDto> GetTodayKpisAsync()
{
    const string sql = """
        SELECT
            COUNT(*)                                                   AS TotalRuns,
            SUM(CASE WHEN JSON_VALUE(metrics,'$.rowsFailed') = '0'
                     THEN 1 ELSE 0 END) * 100.0 / COUNT(*)            AS SuccessRate,
            COUNT(DISTINCT cuId)                                       AS ActiveCus
        FROM observability.IngestionEvents
        WHERE eventType = 'RunCompleted'
          AND CAST(timestamp AS DATE) = CAST(GETUTCDATE() AS DATE);
        """;

    using var db = Connect();
    return await db.QuerySingleAsync<OverviewKpiDto>(sql);
}
```

**Example — Run Explorer with filters:**
```csharp
public async Task<IEnumerable<RunSummaryDto>> GetRunsAsync(RunFilters filters)
{
    const string sql = """
        SELECT
            ie.correlationId, ie.cuId,
            bc.blobName,     biz.fileType,
            MIN(ie.timestamp)              AS startedAt,
            pm.totalProcessingDurationMs,
            pm.rowsProcessed,              pm.rowsFailed,
            vm.validationPassed,           biz.slaBreach
        FROM observability.IngestionEvents ie
        LEFT JOIN observability.BlobContext       bc  ON bc.correlationId  = ie.correlationId
        LEFT JOIN observability.PipelineMetrics   pm  ON pm.correlationId  = ie.correlationId
        LEFT JOIN observability.ValidationMetrics vm  ON vm.correlationId  = ie.correlationId
        LEFT JOIN observability.BusinessContext   biz ON biz.correlationId = ie.correlationId
        WHERE ie.eventType = 'RunCompleted'
          AND (@CuId     IS NULL OR ie.cuId          = @CuId)
          AND (@FileType IS NULL OR biz.fileType      = @FileType)
          AND (@From     IS NULL OR ie.timestamp     >= @From)
          AND (@To       IS NULL OR ie.timestamp     <= @To)
          AND (@SlaBreach IS NULL OR biz.slaBreach   = @SlaBreach)
        GROUP BY ie.correlationId, ie.cuId, bc.blobName, biz.fileType,
                 pm.totalProcessingDurationMs, pm.rowsProcessed,
                 pm.rowsFailed, vm.validationPassed, biz.slaBreach
        ORDER BY MIN(ie.timestamp) DESC;
        """;

    using var db = Connect();
    return await db.QueryAsync<RunSummaryDto>(sql, filters);
}
```

---

### 8.8 Frontend Data Fetching — TanStack Query

TanStack Query sits between the React components and the API. It handles caching, background refresh, loading states, and error states automatically.

```typescript
// hooks/useOverviewKpis.ts
export const useOverviewKpis = () =>
  useQuery({
    queryKey: ['overview-kpis'],
    queryFn: () => axios.get('/api/observability/kpis/today').then(r => r.data),
    refetchInterval: 30_000,   // auto-refresh every 30s from SQL Server
    staleTime: 20_000,
  });

// hooks/useRunList.ts
export const useRunList = (filters: RunFilters) =>
  useQuery({
    queryKey: ['runs', filters],
    queryFn: () => axios.get('/api/observability/runs', { params: filters }).then(r => r.data),
    staleTime: 15_000,
  });

// hooks/useRunDetail.ts
export const useRunDetail = (correlationId: string) =>
  useQuery({
    queryKey: ['run', correlationId],
    queryFn: () => axios.get(`/api/observability/runs/${correlationId}`).then(r => r.data),
    staleTime: 60_000,
  });
```

Each hook maps 1:1 to a SQL query in the repository. The component never knows about SQL — it just calls the hook.

---

### 8.9 Real-Time Feed — SignalR + SQL Server

The Overview live feed uses SignalR. When the ingestion pipeline writes a new event to `observability.IngestionEvents`, it also pushes the event to the SignalR hub. The React client receives it and TanStack Query is invalidated to re-fetch from SQL.

```csharp
// TelemetryHub.cs — called by the pipeline after INSERT
public class TelemetryHub : Hub
{
    public async Task BroadcastEvent(IngestionEventDto evt) =>
        await Clients.All.SendAsync("NewEvent", evt);
}
```

```typescript
// hooks/useLiveFeed.ts
export const useLiveFeed = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const conn = new HubConnectionBuilder()
      .withUrl('/hubs/telemetry')
      .withAutomaticReconnect()
      .build();

    conn.on('NewEvent', () => {
      // New event written to SQL → invalidate → re-fetch from SQL Server
      queryClient.invalidateQueries({ queryKey: ['overview-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['live-feed'] });
    });

    conn.start();
    return () => { conn.stop(); };
  }, [queryClient]);
};
```

---

### 8.10 Dev & Build Tooling

| Tool | Purpose |
|---|---|
| `Vite` | Dev server with HMR, production build |
| `ESLint` + `Prettier` | Code quality and formatting |
| `Vitest` + `React Testing Library` | Unit and component tests |
| `dotnet watch` | Hot reload for ASP.NET Core API during development |

> **Note:** No mock layer is needed. During development the frontend points directly at the ASP.NET Core API running locally (`http://localhost:5000`), which queries the real `observability` schema in TruStage SQL Server.

---

### 8.11 Hosting

| Component | Host | Notes |
|---|---|---|
| React Frontend | Azure Static Web Apps or IIS | Internal access only |
| ASP.NET Core API | Azure App Service or IIS | Same domain preferred for SignalR |
| SQL Server | TruStage existing SQL Server | `observability` schema only — no new DB needed |

---

## 9. Phased Delivery

| Phase | Pages | Target |
|---|---|---|
| **Phase 1 — MVP** | Overview + Run Explorer | Week 1–2 |
| **Phase 2 — CU Intelligence** | CU Detail + Schema Health | Week 3–4 |
| **Phase 3 — Operations** | Performance + Alerts & SLA | Week 5–6 |

---

## 10. Success Metrics

| Metric | Target |
|---|---|
| Time to detect a pipeline failure | < 5 minutes (from run end) |
| Time to diagnose root cause | < 10 minutes using Run Explorer |
| SLA breach detection | 100% captured, zero missed |
| Schema drift detection | Flagged within 1 run of schema change |
| Daily ops queries eliminated | 90% reduction in manual SQL queries |