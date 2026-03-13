# IMPLEMENTATION_PLAN.md
## TruStage — CU Data Ingestion Monitoring Application
**Refactor from:** TruStage Observability Dashboard (details_v1_original.md)  
**Refactor to:** CU Data Ingestion Monitoring Application (MONITORING_SPEC.md v4.0)  
**Data sources:** kafka.*, audit.*, cfl.* schemas — NOT observability.* (legacy)

---

## How to Use This File

Each task below is **one Claude Code session**. Do them in order.  
Do not combine tasks. Do not skip tasks.

**Every session starts with this orient block (copy-paste it verbatim):**

```
Read MONITORING_SPEC.md completely before doing anything.
Then read WIREFRAME_REFERENCE.html.
Then do only the task described below — nothing else.
Do not modify any files not explicitly listed in the task.
```

After each task, run the verify command before moving to the next task.  
If the verify command fails, fix it in the same session before closing.

**Colour coding:**
- 🟢 Safe — no existing functionality touched
- 🟡 Careful — modifies existing files, read instructions closely
- 🔴 Breaking — replaces existing component/page entirely

---

## PHASE 0 — Housekeeping (do this before any code changes)

---

### Task 0.1 — Archive original spec 🟢
**Time estimate:** 2 minutes  
**Risk:** None

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Then read WIREFRAME_REFERENCE.html.
Then do only this task — nothing else.

Rename the file `details.md` to `details_v1_original.md` in the root of the repository.
Do not modify the file contents.
Confirm the rename completed successfully.
```

**Verify:**
```bash
ls details_v1_original.md   # should exist
ls details.md               # should NOT exist
```

---

### Task 0.2 — Copy wireframe into repo 🟢
**Time estimate:** 2 minutes  
**Risk:** None

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Then do only this task — nothing else.

Copy the file WIREFRAME_REFERENCE.html into the root of the repository.
Do not modify any other files.
```

**Verify:**
```bash
ls WIREFRAME_REFERENCE.html   # should exist at repo root
```

---

## PHASE 1 — Database & Foundation (no UI changes yet)

---

### Task 1.1 — Run verification queries then create migration scripts 🟡
**Time estimate:** 20 minutes  
**Risk:** Low — but run verification queries first before creating any migration

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Specifically read Section 4 (Data Sources) and Section 7 (Database Changes Required) in full.
Then do only this task — nothing else.

STEP 1 — Verify the database before writing any migration.
Run the verification queries from Section 7.4 of MONITORING_SPEC.md against the database.
Report what each query returns before proceeding.
If any query fails (table does not exist), STOP and report the error — do not guess.

STEP 2 — If verification passes, create the folder backend/Migrations/ and create 
three SQL migration scripts exactly as specified in Section 7 of MONITORING_SPEC.md:

001_extend_cu_registry.sql     — ADD columns to cfl.CU_Registry (AssignedEngineer, StateEnteredAt)
002_create_cu_schedule.sql     — CREATE SCHEMA adapter (if not exists) + CREATE TABLE adapter.CU_Schedule
003_add_dlq_ownership_columns.sql — ADD columns to kafka.DlqEvents (ResolvedFlag, OwnerId, etc.)

Each script must be idempotent — safe to run twice. Use IF COL_LENGTH / IF NOT EXISTS checks.
Each script must include a comment block at the top: -- Migration: [name] | Date: [today] | Safe to re-run: YES
Do not DROP any existing tables or columns.
Do NOT create adapter.CU_Configuration — this table is not needed. Use cfl.CU_Registry instead.
Do NOT touch observability.* tables — they are legacy.
```

**Verify:**
```bash
ls backend/Migrations/
# Should show: 001_extend_cu_registry.sql
#              002_create_cu_schedule.sql
#              003_add_dlq_ownership_columns.sql
# Should NOT show: anything referencing CU_Configuration or observability

grep -r "DROP " backend/Migrations/           # should return nothing
grep -r "CU_Configuration" backend/Migrations/ # should return nothing
grep -r "observability" backend/Migrations/    # should return nothing
```

---

### Task 1.2 — Create new TypeScript types 🟢
**Time estimate:** 10 minutes  
**Risk:** None — creates new files only

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Then do only this task — nothing else.
Do not modify types/telemetry.ts or any existing file.

Create two new TypeScript type files exactly as specified in Section 10 of MONITORING_SPEC.md:

frontend/src/types/programme.ts   — CuConfiguration, CuSchedule, CuFleetRow, 
                                    LifecycleCounts, GanttEntry, LifecycleState,
                                    HealthStatus, CoreBankingPlatform
frontend/src/types/exceptions.ts  — FeedException, ExceptionSummary

Copy the interfaces exactly from MONITORING_SPEC.md Section 10.
Add a JSDoc comment at the top of each file: 
  /** @see MONITORING_SPEC.md Section 10 for interface definitions */
Do not modify any existing .ts or .tsx files.
```

**Verify:**
```bash
cd frontend && npx tsc --noEmit   # should compile with 0 errors
cat frontend/src/types/programme.ts   # review — no existing types modified
cat frontend/src/types/exceptions.ts  # review — no existing types modified
```

---

### Task 1.3 — Create backend models 🟢
**Time estimate:** 15 minutes  
**Risk:** None — creates new files only

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Then do only this task — nothing else.
Do not modify Models/TelemetryModels.cs or any existing file.

Create two new C# model files in backend/Models/:

backend/Models/ProgrammeModels.cs
  - CuConfigurationDto    (matches CuConfiguration TypeScript interface)
  - CuFleetRowDto         (matches CuFleetRow TypeScript interface)
  - LifecycleCountsDto    (matches LifecycleCounts TypeScript interface)
  - GanttEntryDto + GanttFeedDto
  - LifecycleState enum:  Onboarding, ReadyForFirstFeed, BAU
  - HealthStatus enum:    Healthy, Overdue, Failed, Awaiting

backend/Models/ExceptionModels.cs
  - FeedExceptionDto      (matches FeedException TypeScript interface)
  - ExceptionSummaryDto   (matches ExceptionSummary TypeScript interface)
  - PatchOwnerRequest     { string OwnerId }
  - PatchNoteRequest      { string Note }

All DTOs must use System.Text.Json serialization.
Add XML doc comments to all public types.
Do not modify any existing .cs files.
```

**Verify:**
```bash
cd backend && dotnet build   # should compile with 0 errors, 0 warnings
```

---

### Task 1.4 — Create repository classes 🟢
**Time estimate:** 30 minutes  
**Risk:** None — creates new files only

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Then do only this task — nothing else.
Do not modify ObservabilityRepository.cs or any existing file.

Create three new Dapper repository classes in backend/Repositories/:

backend/Repositories/ProgrammeRepository.cs
  Methods:
  - GetLifecycleCountsAsync()           → LifecycleCountsDto
  - GetCuFleetAsync(filters)            → IEnumerable<CuFleetRowDto>
  - GetLifecyclePanelCusAsync(state)    → IEnumerable<CuConfigurationDto>
  
  SQL notes:
  - CU list comes from cfl.CU_Registry
  - Lifecycle state is DERIVED in SQL — not stored as a column:
      Onboarding  = OnboardingStatus = 'Onboarding'
      BAU         = OnboardingStatus = 'Active' AND EXISTS(SELECT 1 FROM kafka.BatchJourneys 
                    WHERE CuId = r.CU_ID AND FinalStatus = 'Completed')
      Ready       = OnboardingStatus = 'Active' AND NOT EXISTS(above)
  - Last feed data: LEFT JOIN kafka.BatchJourneys bj ON bj.CuId = r.CU_ID 
    WHERE bj.IngestedAt = (SELECT MAX(IngestedAt) FROM kafka.BatchJourneys WHERE CuId = r.CU_ID)
  - Health status derived via CASE WHEN matching Section 3 of MONITORING_SPEC.md
  - DaysInState = DATEDIFF(day, r.StateEnteredAt, GETUTCDATE())
  - Schedule data: LEFT JOIN adapter.CU_Schedule s ON s.CuId = r.CU_ID

backend/Repositories/FeedsRepository.cs
  Methods:
  - GetTodaySummaryAsync()              → DTO { feedsToday, successRate, activeExceptions, activeBauCus }
  - GetGanttDataAsync()                 → IEnumerable<GanttEntryDto>
  - GetFeedListAsync(filters)           → IEnumerable<FeedSummaryDto>
  - GetFeedDetailAsync(feedReferenceId) → FeedDetailDto (all sections combined)

  SQL notes:
  - All feed data from kafka.BatchJourneys WHERE DATE(IngestedAt) = CAST(GETUTCDATE() AS DATE)
  - feedsToday = COUNT(*) from above
  - successRate = SUM(CASE WHEN FinalStatus = 'Completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)
  - activeBauCus = COUNT(DISTINCT CuId) where FinalStatus = 'Completed' today
  - activeExceptions = COUNT(*) from kafka.DlqEvents WHERE ResolvedFlag = 0
  - Gantt: kafka.BatchJourneys today LEFT JOIN adapter.CU_Schedule for expected windows
  - Feed list: kafka.BatchJourneys JOIN cfl.CU_Registry for CU_Name
  - Feed detail: kafka.BatchJourneys + kafka.PipelineStageTimings + 
    audit.PipelineValidationReports (via BatchId join) + audit.IngestionBatches

backend/Repositories/ExceptionRepository.cs
  Methods:
  - GetSummaryAsync()                   → ExceptionSummaryDto
  - GetExceptionsAsync(filters)         → IEnumerable<FeedExceptionDto>
  - GetExceptionByIdAsync(id)           → FeedExceptionDto
  - PatchOwnerAsync(id, ownerId)        → bool
  - PatchNoteAsync(id, note)            → bool
  - ResolveAsync(id, resolvedById)      → bool
  - GetUnresolvedCountAsync()           → int

  SQL notes:
  - All exception data from kafka.DlqEvents JOIN cfl.CU_Registry ON CuId = CU_ID
  - StageName mapped to step labels at serialization layer (not in SQL)
  - Unresolved = ResolvedFlag = 0
  - RecurrenceCount: COUNT of DlqEvents with same StageName + same CuId

All repositories must use parameterized queries via Dapper. No string interpolation in SQL.
All repositories must inject IConfiguration and create connections via the same pattern 
as ObservabilityRepository.cs.
All SQL column names must use the EXISTING database column names — apply display name mapping 
only at the API response serialization layer, not in SQL.
Do NOT query observability.* tables — they are legacy. All queries use kafka.*, audit.*, cfl.* only.
```

**Verify:**
```bash
cd backend && dotnet build   # 0 errors, 0 warnings
```

---

### Task 1.5 — Create API endpoints 🟢
**Time estimate:** 30 minutes  
**Risk:** None — creates new files only, registers new routes

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Then do only this task — nothing else.
Do not modify any existing Endpoints/*.cs files.

Create four new endpoint files in backend/Endpoints/ using ASP.NET Core Minimal APIs,
exactly matching the endpoint map in Section 7.3 of MONITORING_SPEC.md:

backend/Endpoints/ProgrammeEndpoints.cs
  GET /api/programme/lifecycle-counts
  GET /api/programme/cu-fleet          (query params: state, platform, health, search)
  GET /api/programme/lifecycle-panel/{state}

backend/Endpoints/FeedsEndpoints.cs
  GET /api/feeds/today/summary
  GET /api/feeds/today/gantt
  GET /api/feeds/today/ticker
  GET /api/feeds/today/grid

backend/Endpoints/HistoryEndpoints.cs
  GET /api/history/feeds               (query params: cuId, from, to, status)
  GET /api/history/feeds/{feedRefId}

backend/Endpoints/ExceptionEndpoints.cs
  GET   /api/exceptions/summary
  GET   /api/exceptions                (query params: cuId, status, step)
  GET   /api/exceptions/{id}
  PATCH /api/exceptions/{id}/owner
  PATCH /api/exceptions/{id}/note
  PATCH /api/exceptions/{id}/resolve
  GET   /api/exceptions/unresolved-count

Register all four new endpoint files in backend/Program.cs using the existing 
MapXxxEndpoints() extension method pattern already in Program.cs.
Add the new repositories to the DI container in Program.cs.
Do not remove or change any existing endpoint registrations.
```

**Verify:**
```bash
cd backend && dotnet build       # 0 errors, 0 warnings
cd backend && dotnet run &       # starts without error
curl http://localhost:5000/api/programme/lifecycle-counts   # returns JSON (may be empty)
curl http://localhost:5000/api/exceptions/unresolved-count  # returns { "count": 0 }
# Kill the test server after
```

---

### Task 1.6 — Create frontend API hooks 🟢
**Time estimate:** 20 minutes  
**Risk:** None — creates new files only

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Then do only this task — nothing else.
Do not modify any existing hooks/*.ts files.

Create five new TanStack Query hooks in frontend/src/hooks/ following the exact 
patterns in the existing hooks (useOverviewKpis.ts, useRunList.ts, useRunDetail.ts):

hooks/useProgramme.ts
  - useLifecycleCounts()       → GET /api/programme/lifecycle-counts, refetchInterval: 60_000
  - useCuFleet(filters)        → GET /api/programme/cu-fleet, staleTime: 30_000
  - useLifecyclePanel(state)   → GET /api/programme/lifecycle-panel/{state}, enabled: !!state

hooks/useTodaysFeeds.ts
  - useTodaysSummary()         → GET /api/feeds/today/summary, refetchInterval: 30_000
  - useGanttData()             → GET /api/feeds/today/gantt, refetchInterval: 60_000
  - useFeedTicker()            → GET /api/feeds/today/ticker, refetchInterval: 30_000
  - useCuStatusGrid()          → GET /api/feeds/today/grid, refetchInterval: 60_000

hooks/useFeedHistory.ts
  - useFeedList(filters)       → GET /api/history/feeds, staleTime: 15_000
  - useFeedDetail(feedRefId)   → GET /api/history/feeds/{feedRefId}, staleTime: 60_000, enabled: !!feedRefId

hooks/useExceptions.ts
  - useExceptionSummary()      → GET /api/exceptions/summary, refetchInterval: 30_000
  - useExceptions(filters)     → GET /api/exceptions, staleTime: 20_000
  - useException(id)           → GET /api/exceptions/{id}, enabled: !!id
  Mutations:
  - usePatchOwner()            → PATCH /api/exceptions/{id}/owner
  - usePatchNote()             → PATCH /api/exceptions/{id}/note
  - useResolveException()      → PATCH /api/exceptions/{id}/resolve

hooks/useUnresolvedCount.ts
  - useUnresolvedCount()       → GET /api/exceptions/unresolved-count, refetchInterval: 60_000
  Returns: { count: number }

All hooks must use proper TypeScript return types from types/programme.ts and types/exceptions.ts.
All hooks must follow the axios import pattern in the existing hooks.
```

**Verify:**
```bash
cd frontend && npx tsc --noEmit   # 0 type errors
```

---

## PHASE 2 — Navigation Refactor

---

### Task 2.1 — Update sidebar navigation and routes 🔴
**Time estimate:** 20 minutes  
**Risk:** Modifies App.tsx and sidebar — existing pages still reachable

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Then open frontend/src/App.tsx and the current sidebar/navigation component.
Then do only this task — nothing else.

Update the React Router routes and sidebar navigation to match Section 5 of MONITORING_SPEC.md.

NEW routes to add:
  /               → CuProgrammeView   (placeholder component — see note)
  /feeds          → TodaysFeeds       (placeholder)
  /history        → FeedHistory       (placeholder)
  /history/:feedRefId → FeedHistory   (placeholder — feedRefId param)
  /cu/:cuId       → CuDetail          (existing component — keep as-is)
  /exceptions     → FeedExceptions    (placeholder)

KEEP these existing routes unchanged:
  /performance    → Performance       (existing — do not touch)
  /schema-health  → SchemaHealth      (existing — do not touch)

For routes where the new page component does not exist yet, create a minimal 
placeholder component in the correct folder that renders:
  <div className="p-8 text-gray-500">
    [Page Name] — coming in a later task. See IMPLEMENTATION_PLAN.md.
  </div>

Update the sidebar navigation items to exactly match Section 5:
  🏢  CU Programme View     → /
  📥  Today's Feeds         → /feeds
  🔍  Feed History          → /history
  🏦  CU Detail             → /cu  (links to most recent CU or disabled until CU selected)
  ⚠️  Feed Exceptions       → /exceptions  [red badge from useUnresolvedCount()]
  
  ── (separator) ──
  ⚡  Performance           → /performance    (keep existing)
  ✅  Schema Health         → /schema-health  (keep existing)

The Feed Exceptions badge: import useUnresolvedCount. Show red badge when count > 0.

Do not remove, rename, or break the existing Overview, Run Explorer, 
Performance, or Schema Health pages. They may still be reachable during transition.
```

**Verify:**
```bash
cd frontend && npm run dev   # starts without error
# Browser: navigate to / → shows CU Programme View placeholder
# Browser: navigate to /performance → existing Performance page still works
# Browser: navigate to /schema-health → existing Schema Health page still works
# Browser: navigate to /exceptions → shows Feed Exceptions placeholder
# Browser: sidebar shows all 7 nav items with correct labels
```

---

## PHASE 3 — Tab 5 First: Feed Exceptions

> Build Feed Exceptions first because it is referenced by all other tabs via the exception banner and badge.

---

### Task 3.1 — Feed Exceptions page — summary strip and list 🟢
**Time estimate:** 45 minutes  
**Risk:** New component — no existing code modified

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Open WIREFRAME_REFERENCE.html and study the "Feed Exceptions" tab (Tab 5) structure carefully.
Then do only this task — nothing else.

Replace the FeedExceptions placeholder with a real implementation.

Create these components in frontend/src/pages/FeedExceptions/:

FeedExceptions.tsx            — page shell, imports ExceptionSummaryStrip + ExceptionList
ExceptionSummaryStrip.tsx     — four stat cards (Section 6.16 of MONITORING_SPEC.md)
ExceptionList.tsx             — filter bar + sortable table (Section 6.17)
ExceptionRow.tsx              — single table row that expands inline (Section 6.18)

ExceptionSummaryStrip.tsx:
- Uses useExceptionSummary() hook
- Four cards: Total (grey) | Active Unresolved (red) | Resolved Today (green) | Recurring (amber)
- Match the colour system in WIREFRAME_REFERENCE.html exactly

ExceptionList.tsx:
- Filter bar: search input, CU partner select, status select, failed step select
- Uses useExceptions(filters) hook
- Columns exactly as per Section 6.17 of MONITORING_SPEC.md
- Default sort: unresolved first, then most recent
- Each row is clickable — clicking opens ExceptionRow expanded state

ExceptionRow.tsx (the most complex component):
- Collapsed state: shows all columns, ▶ chevron at right
- Expanded state (inline, no modal): shows full exception detail per Section 6.18
  - Exception code + full message
  - Failed step (using step label from Nomenclature — NOT internal event name)
  - Retry count and last retry timestamp
  - Stack trace (collapsed accordion, "Show stack trace" toggle)
  - Occurrence history — a mini timeline if RecurrenceCount > 1
  - Owner assignment: <Select> dropdown populated from a static list of team members
  - Note field: <Textarea> + "Save Note" button — calls usePatchNote() mutation
  - Mark as Resolved button — calls useResolveException() mutation, shows confirmation
  - "View Feed Detail →" button — navigates to /history/{feedReferenceId}
- Recurring exceptions: show amber "Recurred N×" badge next to date in collapsed row
  Recurring and first-time exceptions MUST look visually distinct

Styling rules:
- Use Tailwind CSS and shadcn/ui components only — no new packages
- Colour system must match WIREFRAME_REFERENCE.html: 
  Active/red background, Resolved/green, Amber for recurring and unassigned
- Use lucide-react for all icons
- Use date-fns for timestamp formatting
```

**Verify:**
```bash
cd frontend && npm run dev
# Browser: /exceptions → page loads with 4 stat cards
# Browser: click any exception row → expands inline with all fields
# Browser: click "Mark as Resolved" → mutation fires, row updates to Resolved state
# Browser: recurring exception shows amber "Recurred N×" badge
cd frontend && npx tsc --noEmit   # 0 type errors
```

---

### Task 3.2 — Exception Banner shared component 🟢
**Time estimate:** 20 minutes  
**Risk:** New shared component

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Then do only this task — nothing else.

Create a shared reusable ExceptionBanner component at:
frontend/src/components/ExceptionBanner.tsx

The banner must:
- Use useUnresolvedCount() hook internally
- Show ONLY when unresolved count > 0
- Display: "🔴 [N] active feed exceptions across [CU count] CU partners 
   — last exception [X] minutes ago  [View Exceptions →]"
- "View Exceptions →" navigates to /exceptions using React Router useNavigate()
- Be session-dismissible (useState for dismissed) 
- Reappear automatically if count increases (useEffect watching count)
- Styling: red border-left accent, light red background — match WIREFRAME_REFERENCE.html

Import and render ExceptionBanner at the top of the content area in:
- CuProgrammeView.tsx (placeholder — add import ready for when it's built)
- TodaysFeeds.tsx (placeholder — add import ready)
- Do NOT add it to Performance, SchemaHealth, or any other existing page
```

**Verify:**
```bash
cd frontend && npm run dev
cd frontend && npx tsc --noEmit   # 0 type errors
```

---

## PHASE 4 — Tab 1: CU Programme View

---

### Task 4.1 — Lifecycle State Strip and summary sentence 🟢
**Time estimate:** 40 minutes  
**Risk:** New component

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Open WIREFRAME_REFERENCE.html and study the lifecycle state strip at the top of Tab 1.
Then do only this task — nothing else.

Build the top section of CuProgrammeView:

frontend/src/pages/CuProgrammeView/CuProgrammeView.tsx  — page shell
frontend/src/pages/CuProgrammeView/LifecycleStateStrip.tsx
frontend/src/pages/CuProgrammeView/LifecyclePanel.tsx

LifecycleStateStrip.tsx:
- Uses useLifecycleCounts() hook
- Three stat cards spanning full width: Onboarding (blue) | Ready for First Feed (amber) | BAU (green)
- Each card shows: count (large), sub-label with amber staleness warning if applicable
- Clicking any card calls onStateClick(state) prop → parent opens LifecyclePanel
- Auto-generated summary sentence below the three cards — format exactly per Section 6.2 of MONITORING_SPEC.md
- ExceptionBanner rendered above the strip (import the component from Task 3.2)

LifecyclePanel.tsx:
- shadcn/ui Sheet component (slide-over from right)
- Uses useLifecyclePanel(state) hook
- Header: state name + total count
- Amber banner if any CUs are past staleness threshold
- Table: CU Name | Platform | Days in State | Assigned Engineer | Owner dropdown | Note field
- Owner dropdown: static list matching your team (configure in a constants file)
- Note field: one-line text input + save button — POST to /api/programme/lifecycle-panel/note (create minimal stub endpoint if it doesn't exist)
- Amber row highlight for CUs past threshold (>7 days for Ready, as defined in MONITORING_SPEC.md)

Styling: match WIREFRAME_REFERENCE.html exactly — blue/amber/green accent colours on cards,
navy stat card headers.
```

**Verify:**
```bash
cd frontend && npm run dev
# Browser: / → lifecycle strip renders with 3 cards
# Browser: click "Onboarding" card → slide-over opens with CU list
# Browser: summary sentence renders below cards
cd frontend && npx tsc --noEmit   # 0 type errors
```

---

### Task 4.2 — CU Partner Fleet Table 🟢
**Time estimate:** 40 minutes  
**Risk:** New component

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Open WIREFRAME_REFERENCE.html and study the CU fleet table in Tab 1.
Then do only this task — nothing else.

Build the CU fleet table:
frontend/src/pages/CuProgrammeView/CuFleetTable.tsx

The table must:
- Use useCuFleet(filters) hook
- Filter bar above table: text search | Lifecycle State select | Core Banking Platform select | Health select
- Columns exactly as per Section 6.4 of MONITORING_SPEC.md — in this exact order:
  CU Partner Name | Core Banking Platform | Lifecycle State | Days in State | 
  Last Feed Delivered | Next Feed Expected | Last Feed Duration | Member Records (last) | 
  Records Rejected (last) | Health | Owner
- Column: "CU Partner Name" is a clickable link → navigate to /cu/{cuId}
- Column: "Lifecycle State" → colour pill (Blue=Onboarding, Amber=Ready, Green=BAU)
- Column: "Days in State" → amber "Waiting X days ⚠" badge if past staleness threshold
- Column: "Records Rejected" → red text if > 0
- Column: "Health" → colour pill (Green=Healthy, Amber=Overdue, Red=Failed, Grey=Awaiting)
- Column: "Owner" → initials badge (grey pill)
- Rows sortable by clicking column header
- "Not yet" for null Last Feed Delivered
- "Not scheduled" for null Next Feed Expected
- Duration displayed in seconds (divide ms by 1000, 1 decimal place)

Styling: navy table header, alternating row shading, hover highlight — match WIREFRAME_REFERENCE.html.
Use shadcn/ui Table component.
```

**Verify:**
```bash
cd frontend && npm run dev
# Browser: / → fleet table renders below the lifecycle strip
# Browser: click a CU name → navigates to /cu/{cuId}
# Browser: filter by state → table filters
# Browser: column headers sortable
cd frontend && npx tsc --noEmit   # 0 type errors
```

---

## PHASE 5 — Tab 3: Feed History (replaces Run Explorer)

> Build Feed History before Today's Feeds — it's simpler and the Feed Detail panel
> is reused in CU Detail and Today's Feeds.

---

### Task 5.1 — Feed History list and filters 🟡
**Time estimate:** 40 minutes  
**Risk:** Replaces RunExplorer — existing /runs route kept as fallback

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Open WIREFRAME_REFERENCE.html and study the Feed History tab (Tab 3).
Then do only this task — nothing else.
Do not delete or modify frontend/src/pages/RunExplorer/ — it stays as a fallback.

Create a NEW page at frontend/src/pages/FeedHistory/FeedHistory.tsx

This page replaces the Run Explorer conceptually but is built fresh.
The old RunExplorer is still reachable at /runs — do not touch it.

FeedHistory.tsx:
frontend/src/pages/FeedHistory/FeedHistory.tsx  — page shell
frontend/src/pages/FeedHistory/FeedListTable.tsx
frontend/src/pages/FeedHistory/FeedFilters.tsx

FeedFilters.tsx:
- CU Partner select (populated from /api/programme/cu-fleet or a names-only endpoint)
- Status select: All | Delivered | Failed | Partial
- Date range: two date inputs (from / to), defaulting to last 7 days
- Free text search (Feed Reference ID or CU name)

FeedListTable.tsx:
- Uses useFeedList(filters) hook
- Columns exactly as per Section 6.10 of MONITORING_SPEC.md:
  Feed Reference ID | CU Partner Name | Feed Started | Total Duration | 
  Member Records Processed | Records Rejected | Data Alignment Score | Status
- Feed Reference ID: monospace font, muted colour
- Duration: displayed in seconds (1 decimal place)
- Records Rejected: red text if > 0
- Data Alignment Score: green if ≥95%, amber if 80-94%, red if <80%
- Status: colour pill (Delivered=green, Failed=red, Partial=amber)
- Clicking any row opens the FeedDetail slide-over panel (build the panel shell in this task — inner tabs in Task 5.2)
- "Showing N of M feeds" count below table

Note: In the FeedDetail panel shell, render a placeholder:
  "Feed detail loading — tabs will be built in Task 5.2"
  Pass the feedReferenceId to the panel correctly.
```

**Verify:**
```bash
cd frontend && npm run dev
# Browser: /history → feed list renders with filter bar
# Browser: filter by status → list updates
# Browser: click a feed row → slide-over panel opens (placeholder content is fine)
# Browser: /runs → OLD Run Explorer still works unchanged
cd frontend && npx tsc --noEmit   # 0 type errors
```

---

### Task 5.2 — Feed Detail Panel — all four inner tabs 🟢
**Time estimate:** 60 minutes  
**Risk:** New component

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Open WIREFRAME_REFERENCE.html and study the Feed Detail slide-over panel carefully.
Pay close attention to the Step Timeline tab — the step label / internal event name display pattern.
Then do only this task — nothing else.

Build the complete FeedDetail slide-over panel:
frontend/src/pages/FeedHistory/FeedDetail/FeedDetail.tsx
frontend/src/pages/FeedHistory/FeedDetail/StepTimeline.tsx
frontend/src/pages/FeedHistory/FeedDetail/StepTimingBar.tsx
frontend/src/pages/FeedHistory/FeedDetail/DataQualityReport.tsx
frontend/src/pages/FeedHistory/FeedDetail/FeedSummary.tsx

FeedDetail.tsx:
- shadcn/ui Sheet (slide-over from right, wider than default — min 520px)
- Uses useFeedDetail(feedRefId) hook
- Header: "Feed Detail" | CU name | Feed Reference ID (monospace)
- Four inner tabs using shadcn/ui Tabs: Step Timeline | Step Timing | Data Validation | Feed Summary

StepTimeline.tsx — CRITICAL: study WIREFRAME_REFERENCE.html Tab 3 panel carefully
- Source: kafka.PipelineStageTimings WHERE CorrelationId = feedRefId, ordered by StartedAt
- One item per stage. StageName → step label mapping per MONITORING_SPEC.md Section 4.4:
    Ingestion          → Receive CU File
    SchemaValidation   → Data Validation Check
    Transform          → Apply Standardisation Rules
    RulesValidation    → Standardise & Transform
    Publishing         → Write to TruStage Standard
    (derived)          → Feed Delivered  (when kafka.BatchJourneys.FinalStatus = 'Completed')
- Each step item shows:
    [status dot — green tick, red X, amber warn, grey wait]
    Step Label (bold, 13px)    [StageName — 10px, muted, monospace font]
    HH:MM:SS  ·  Xs            [StartedAt time and DurationMs in seconds]
    Meta line                  [depends on step — see below]
- Meta lines:
    Receive CU File:           File: [BlobName from kafka.BatchJourneys]
    Data Validation Check:     Gate 1: [Passed/Failed] from audit.PipelineValidationReports
    Apply Standardisation Rules: Version [MappingVersion from audit.IngestionBatches]
    Standardise & Transform:   [RecordsIn] records in from kafka.BatchJourneys
    Write to TruStage Standard: [RecordsOut] records written from kafka.BatchJourneys
    Feed Delivered:            Total: [TotalDurationMs]ms from kafka.BatchJourneys
- Failed feeds: show a red terminal step using kafka.DlqEvents data for this CorrelationId

StepTimingBar.tsx:
- Source: kafka.PipelineStageTimings — DurationMs per StageName for this CorrelationId
- StageName mapped to step labels per MONITORING_SPEC.md Section 4.4

DataValidationReport.tsx  (was DataQualityReport.tsx):
- Source: audit.PipelineValidationReports joined via kafka.BatchJourneys.BatchId
- Three-gate status display (NOT a single score gauge):
    Gate 1 — Schema Check       [✅/❌]  Gate1ErrorCount errors
    Gate 2 — Business Rules     [✅/⚠]   Gate2ErrorCount errors · DqWarnings warnings
    Gate 3 — DB Reconciliation  [✅/❌]  Gate3ErrorCount errors
- Data Alignment Score gauge below gates: derived as (ProdMemberCount / SourceMemberCount) * 100
  Green ≥95%, amber 80-94%, red <80%
- Record counts table: Source vs Written to TruStage Standard for Members / Accounts / Loans
- Records Rejected (DqBlocked) | Warnings (DqWarnings)
- If field errors exist in GateDetailsJson: collapsible table showing Row | Field | Source Value | Reason
- Tab label in UI: "Data Validation" (NOT "Data Quality")

FeedSummary.tsx:
- Key-value list (label left, value right) — all fields from Section 6.11 Tab D
- Feed Reference ID in monospace
- Expected by: shows On time (green) or Late (red) by comparing delivered timestamp to CU_Schedule
- Status pill at bottom

After building this task, remove the placeholder content from the FeedDetail shell built in Task 5.1.
```

**Verify:**
```bash
cd frontend && npm run dev
# Browser: /history → click any feed row → panel opens
# Browser: Step Timeline tab → steps render with correct labels (NOT "BlobReceived", NOT "RunCompleted")
# Browser: Step Timing tab → stacked bar renders with legend
# Browser: Data Validation tab → three gate indicators + score gauge + record counts
# Browser: Feed Summary tab → key-value list renders
cd frontend && npx tsc --noEmit   # 0 type errors
```

---

## PHASE 6 — Tab 2: Today's Feeds

---

### Task 6.1 — Today's Feeds — KPI strip, banner, ticker, grid 🟢
**Time estimate:** 45 minutes  
**Risk:** New component — migrates existing CuHealthGrid and LiveFeed

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Open WIREFRAME_REFERENCE.html and study the Today's Feeds tab (Tab 2).
Then do only this task — nothing else.
Do not delete or modify frontend/src/pages/Overview/ — it stays as-is.

Build:
frontend/src/pages/TodaysFeeds/TodaysFeeds.tsx
frontend/src/pages/TodaysFeeds/FeedsSummaryStrip.tsx
frontend/src/pages/TodaysFeeds/LiveFeedTicker.tsx
frontend/src/pages/TodaysFeeds/CuStatusGrid.tsx

TodaysFeeds.tsx:
- ExceptionBanner at top (import from shared components)
- FeedsSummaryStrip
- DeliveryGantt placeholder (will be built in Task 6.2 — import stub)
- LiveFeedTicker
- CuStatusGrid

FeedsSummaryStrip.tsx:
- Uses useTodaysSummary() hook
- Four cards per Section 6.5 of MONITORING_SPEC.md with correct thresholds
- Successful Delivery Rate: green ≥98%, amber 90-97%, red <90%
- Active Feed Exceptions: green=0, amber=1-2, red=3+

LiveFeedTicker.tsx:
- Uses useFeedTicker() hook (replaces the existing useLiveFeed + overview query pattern)
- Still uses SignalR via the existing useLiveFeed hook for push invalidation
- Last 30 events, auto-refresh
- Row format: step badge (colour-coded by step type) | CU name | file name | timestamp | duration | status
- Exception events: red highlight, float to top
- Step badge colours match WIREFRAME_REFERENCE.html:
  Feed Received=blue | Feed Delivered=green | Exception=red | Data Validation Check=teal

CuStatusGrid.tsx:
- Uses useCuStatusGrid() hook
- Card per BAU CU — same layout as WIREFRAME_REFERENCE.html Tab 2 status grid
- Card: name | last delivery | status pill | member records today | Data Alignment Score | exception indicator
- Ready for First Feed CUs: muted style, "Awaiting first feed delivery" label
- Click any card → navigate to /cu/{cuId}
```

**Verify:**
```bash
cd frontend && npm run dev
# Browser: /feeds → page loads with 4 KPI cards
# Browser: live ticker renders recent events
# Browser: CU status grid shows cards
# Browser: /  (Overview) → old Overview page still works
cd frontend && npx tsc --noEmit   # 0 type errors
```

---

### Task 6.2 — Delivery Schedule Gantt Chart 🟢
**Time estimate:** 60 minutes  
**Risk:** New component — no existing code touched

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Open WIREFRAME_REFERENCE.html and study the Gantt chart carefully — look at how:
  - Expected delivery windows are shown as grey bands (dashed border)
  - Actual feed bars sit on top of or next to the grey bands
  - Overdue rows show an amber "Overdue" label instead of a bar
  - Time axis runs 00:00 to 23:59 across the full width
Then do only this task — nothing else.

Build the Gantt chart component:
frontend/src/pages/TodaysFeeds/DeliveryGantt.tsx

Implementation requirements:
- Uses useGanttData() hook
- X-axis: 00:00 to 23:59 (1440 minutes), rendered as time labels at 3-hour intervals
- Y-axis: one row per BAU CU partner, labelled with CU name
- For each CU row:
  - If CU_Schedule exists: render grey dashed band at the expected delivery window position
  - If feed delivered: render coloured bar (green=delivered, red=failed, amber=partial)
  - If expected window passed with no feed: render amber "Overdue — expected window passed" label
  - If feed not yet expected: render nothing (no bar, no label)
- Bar positioning formula: left% = (startMinute / 1440) * 100
- Bar width formula: width% = (durationMinutes / 1440) * 100  — minimum 0.5% for visibility
- Hover tooltip on each bar: CU name | start time | duration | member records | status
- Clicking a bar opens the FeedDetail panel for that feedReferenceId (import FeedDetail)

Use SVG or pure CSS/div positioning — do NOT use a Gantt chart library.
Use Recharts only for the CU Detail charts — the Gantt must be custom built.

The component must be responsive — horizontal scroll on small screens.
Wrap in a card with a navy header: "Delivery Schedule — Today" and legend on the right.
```

**Verify:**
```bash
cd frontend && npm run dev
# Browser: /feeds → Gantt chart renders with time axis
# Browser: expected window bands visible as grey dashed boxes
# Browser: feed bars render in correct time position
# Browser: hover over a bar → tooltip appears
# Browser: click a bar → Feed Detail panel opens
cd frontend && npx tsc --noEmit   # 0 type errors
```

---

## PHASE 7 — Tab 4: CU Detail (extend existing)

---

### Task 7.1 — Extend CU Detail page 🟡
**Time estimate:** 50 minutes  
**Risk:** Modifies existing CuDetail page — read existing code first

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Open WIREFRAME_REFERENCE.html and study the CU Detail tab (Tab 4).
Then open frontend/src/pages/CuDetail/ and read ALL existing files before making any changes.
Then do only this task — nothing else.

Extend (do not replace) the existing CU Detail page to match Section 6 Tab 4 of MONITORING_SPEC.md.

Changes required:

1. CU Header (update existing):
   - Replace any "Adapter ID" text with "CU Connector ID"
   - Replace any "correlationId" display with "Feed Reference ID"
   - Ensure it shows: CU name | Lifecycle State pill | Core Banking Platform | 
     CU Connector ID | Onboarding date | Assigned Engineer | Environment
   - If unresolved exceptions > 0 for this CU: show ExceptionBanner at top

2. Summary stats (update existing):
   - Rename "Total Runs" → "Total Feeds Delivered"
   - Rename "Rows Processed" → "Member Records Written to TruStage Standard"
   - Add "Avg Delivery Duration" if not present
   - Add "Successful Delivery Rate" if not present

3. Charts (update labels — do not change chart types or data sources):
   - "Run History Chart" → "Delivery Duration Trend" 
   - "Daily File Volume Chart" → "Member Records Volume Trend"  
   - "Validation Health Over Time" → "Data Alignment Score Over Time"
   - Add "Step Timing Trend" chart if not present (stacked area, last 30 feeds)
   - Add "Today's Delivery Gantt" (import DeliveryGantt from Task 6.2, scoped to this cuId)

4. Recent Feeds Table (update existing or rebuild):
   - Column names must match Section 6.15 of MONITORING_SPEC.md
   - "Correlation ID" → "Feed Reference ID" 
   - "Rows Processed" → "Member Records"
   - "Rows Failed" → "Records Rejected"
   - "Duration" → display in seconds
   - Clicking a row opens FeedDetail panel (import from Task 5.2)

5. Keep all existing chart functionality — only relabel, do not rewrite queries
```

**Verify:**
```bash
cd frontend && npm run dev
# Browser: /cu/[any valid cuId] → page loads
# Browser: header shows "CU Connector ID" (not "Adapter ID")
# Browser: no "Rows Processed" or "correlationId" visible in UI
# Browser: click a feed row → FeedDetail panel opens
cd frontend && npx tsc --noEmit   # 0 type errors
```

---

## PHASE 8 — Final Cleanup

---

### Task 8.1 — Terminology audit 🟡
**Time estimate:** 30 minutes  
**Risk:** String changes only — no logic changes

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely, specifically the Nomenclature table in Section 1.
Then do only this task — nothing else.

Run a full audit of all .tsx and .ts files in frontend/src/pages/ and frontend/src/components/
for any occurrences of the following forbidden terms in user-visible strings 
(JSX text, placeholder props, aria-label, title, tooltip content):

Forbidden: "Run", "Pipeline Run", "Rows Processed", "Rows Failed", "Schema Match", 
"Correlation ID", "Adapter ID", "CFL", "Canonical", "Persist", "BlobReceived",
"RunCompleted", "RunStarted", "IngestionCompleted", "correlationId", "rowsProcessed",
"rowsFailed", "schemaMatchScore", "mappingVersion", "adapterId",
"Data Quality", "DQ Check", "DQ Report", "DQ Tab", "DQ-"

For each occurrence found:
1. Report the file and line number
2. Replace with the correct term from MONITORING_SPEC.md Section 1
3. Do NOT change variable names, function names, API parameter names, 
   database column names, or TypeScript interface property names — 
   only change strings visible to the user

Do not change any files in frontend/src/pages/Performance/ or 
frontend/src/pages/SchemaHealth/ — those are out of scope.

Output a summary of every file changed and every string replaced.
```

**Verify:**
```bash
cd frontend && npm run dev   # still compiles and runs
cd frontend && npx tsc --noEmit   # 0 type errors

# Manual spot-check in browser:
# Tab 1: no "runs", "rows", "correlation"
# Tab 3: "Feed Reference ID" (not "Correlation ID"), "Member Records" (not "Rows Processed")
# Tab 5: "Failed Step" uses step labels (not "BlobReceived", "RunCompleted")
```

---

### Task 8.2 — End-to-end drill-down test 🟢
**Time estimate:** 20 minutes  
**Risk:** None — test and fix only

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md completely before doing anything.
Then do only this task — nothing else.

Test and fix the complete drill-down navigation chain described in Section 5 of MONITORING_SPEC.md:

  CU Programme View (/)
      └── CU Detail (/cu/:cuId)         ← click any CU name in fleet table
            └── Feed Detail panel        ← click any feed row in Recent Feeds table
                      └── Feed Exceptions (/exceptions)  ← click "View Feed Detail →" in exception

Specifically verify and fix if broken:
1. Clicking a CU name in the fleet table navigates to /cu/{cuId}
2. Clicking a feed row in CU Detail opens the FeedDetail panel
3. Clicking "View Feed Detail →" in an exception row opens FeedDetail for the correct feedReferenceId
4. Every page that shows a CU name makes it a clickable link to /cu/{cuId}
5. Breadcrumbs are present on CU Detail page showing "CU Programme View > [CU Name]"
6. Breadcrumbs on Feed History detail show "Feed History > Feed [shortId]"

Fix any broken navigation. Do not change any other behaviour.
```

**Verify:**
```bash
cd frontend && npm run dev
# Browser: walk the entire drill-down chain manually
# No dead ends, no 404s, no broken navigation
```

---

### Task 8.3 — Final build check 🟡
**Time estimate:** 15 minutes

**Prompt for Claude Code:**
```
Read MONITORING_SPEC.md before doing anything.
Then do only this task — nothing else.

Run a full production build and fix all errors and warnings:

cd frontend && npm run build
cd backend && dotnet build --configuration Release

Fix all TypeScript errors, all C# build warnings, and all ESLint errors.
Do not change any logic — only fix type errors, missing imports, and lint violations.

Then confirm:
1. frontend/src/pages/Performance/ — all files unchanged from before this refactor
2. frontend/src/pages/SchemaHealth/ — all files unchanged from before this refactor
3. backend/Repositories/ObservabilityRepository.cs — existing methods unchanged
4. backend/Models/TelemetryModels.cs — existing interfaces unchanged

Output: "Build clean. Performance and SchemaHealth pages verified unchanged."
```

**Verify:**
```bash
cd frontend && npm run build    # exits 0, no errors
cd backend && dotnet build --configuration Release   # exits 0, 0 warnings
```

---

## TASK COMPLETION TRACKER

Copy this into your notes. Check off each task as you verify it.

```
PHASE 0 — Housekeeping
  [ ] 0.1  Archive original spec
  [ ] 0.2  Copy wireframe into repo

PHASE 1 — Database & Foundation
  [ ] 1.1  Migration scripts (verify DB → extend cfl.CU_Registry → create adapter.CU_Schedule → add kafka.DlqEvents ownership columns)
  [ ] 1.2  TypeScript types
  [ ] 1.3  Backend models
  [ ] 1.4  Repository classes
  [ ] 1.5  API endpoints
  [ ] 1.6  Frontend hooks

PHASE 2 — Navigation
  [ ] 2.1  Sidebar + routes

PHASE 3 — Feed Exceptions (Tab 5)
  [ ] 3.1  Exception list + expandable rows
  [ ] 3.2  Exception banner (shared)

PHASE 4 — CU Programme View (Tab 1)
  [ ] 4.1  Lifecycle state strip + slide-over panels
  [ ] 4.2  CU fleet table

PHASE 5 — Feed History (Tab 3)
  [ ] 5.1  Feed list + filters
  [ ] 5.2  Feed Detail panel — all four inner tabs

PHASE 6 — Today's Feeds (Tab 2)
  [ ] 6.1  KPI strip + ticker + status grid
  [ ] 6.2  Delivery Gantt chart

PHASE 7 — CU Detail (Tab 4)
  [ ] 7.1  Extend existing page

PHASE 8 — Cleanup
  [ ] 8.1  Terminology audit
  [ ] 8.2  Drill-down navigation test
  [ ] 8.3  Final build check
```

---

## APPENDIX — Common Claude Code Failure Patterns and Fixes

### Claude Code drifts and uses forbidden terms
Add to the start of any session:
```
Before writing any JSX or string constants, re-read the Nomenclature table 
in MONITORING_SPEC.md Section 1. Every user-visible string must use the left column.
```

### Claude Code modifies files it was told not to touch
Add to the start of the next session:
```
In the previous session, [filename] was incorrectly modified. 
Revert [filename] to its state before that session using git checkout [filename].
Then continue with Task [N].
```

### Claude Code builds the wrong thing or goes beyond scope
Stop the session. Start a new session with:
```
The previous session went off-track. Discard any incomplete work. 
Read MONITORING_SPEC.md completely. Then do ONLY Task [N] — nothing else.
```

### A hook or API call returns unexpected data
Add to the session:
```
The endpoint GET /api/[path] is returning [shape]. 
The expected shape per MONITORING_SPEC.md is [expected shape].
Fix the repository method and the TypeScript type — do not change any other files.
```

### TypeScript errors on new interfaces
Add to the session:
```
There are TypeScript errors in [file]. 
The canonical interface definitions are in MONITORING_SPEC.md Section 10.
Fix the type errors to match those definitions exactly.
Do not change the interface definitions — fix the consuming code.
```
