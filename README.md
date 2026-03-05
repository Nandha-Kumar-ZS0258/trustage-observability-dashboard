# TruStage Observability Dashboard

A full-stack observability dashboard for monitoring data ingestion pipelines, credit union (CU) health, SLA compliance, and system performance.

## Tech Stack

### Backend
- **ASP.NET Core 8** — Minimal API
- **Dapper** — Lightweight SQL query micro-ORM
- **Microsoft.Data.SqlClient** — SQL Server connectivity
- **SignalR** — Real-time telemetry push via WebSocket hub

### Frontend
- **React 18** + **TypeScript** — UI framework
- **Vite** — Dev server and build tool
- **TailwindCSS** — Utility-first styling
- **TanStack Query (React Query v5)** — Server state management and caching
- **Recharts** — Data visualization / charting
- **React Router v6** — Client-side routing
- **@microsoft/signalr** — Real-time SignalR client
- **Axios** — HTTP client
- **Zod** + **React Hook Form** — Form validation

---

## Project Structure

```
trustage-observability-dashboard/
├── backend/                          # ASP.NET Core 8 Web API
│   ├── Endpoints/
│   │   ├── OverviewEndpoints.cs      # KPIs, live feed, CU health, timeline
│   │   ├── CuEndpoints.cs            # Credit union detail endpoints
│   │   ├── PerformanceEndpoints.cs   # Performance metrics
│   │   ├── ValidationEndpoints.cs    # Schema validation results
│   │   ├── AlertEndpoints.cs         # SLA breaches, errors, retries
│   │   └── RunEndpoints.cs           # Run list and run detail
│   ├── Hubs/
│   │   └── TelemetryHub.cs           # SignalR hub for real-time updates
│   ├── Repositories/
│   │   └── ObservabilityRepository.cs
│   └── Program.cs
│
└── frontend/                         # React + TypeScript SPA
    └── src/
        ├── api/                      # Axios API client
        ├── hooks/                    # TanStack Query data hooks
        ├── components/               # Shared UI components
        └── pages/
            ├── Overview/             # Dashboard home page
            ├── RunExplorer/          # Run list + run detail drill-down
            ├── CuDetail/             # Per-CU detail view
            ├── Performance/          # Performance metrics page
            ├── SchemaHealth/         # Schema validation health
            └── Alerts/               # SLA alerts and failed runs
```

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Overview | KPI strip, live ingestion feed, CU health grid, hourly timeline |
| `/runs` | Run Explorer | Filterable run list with status, SLA, and duration |
| `/runs/:correlationId` | Run Detail | Event timeline, validation report, host snapshot, business summary |
| `/cu/:cuId` | CU Detail | Per-credit-union ingestion history and health |
| `/performance` | Performance | Throughput and latency metrics over time |
| `/schema-health` | Schema Health | Schema validation failure analysis |
| `/alerts` | Alerts | SLA breaches, error summaries, retries, and failed runs |

---

## API Endpoints

All endpoints are prefixed with `/observability`.

| Method | Path | Description |
|---|---|---|
| GET | `/kpis/today` | Today's top-level KPIs |
| GET | `/feed/live` | Recent live ingestion events |
| GET | `/cu/health` | Health status for all credit unions |
| GET | `/overview/timeline` | Ingestion timeline for today |
| GET | `/overview/hourly-rows` | Hourly row counts |
| GET | `/alerts/sla` | SLA summary |
| GET | `/alerts/sla/breaches` | SLA breach details |
| GET | `/alerts/errors` | Error summary |
| GET | `/alerts/retries` | Runs with retries |
| GET | `/alerts/failed-runs` | Failed run list |

**SignalR Hub:** `ws://localhost:5000/hubs/telemetry`

---

## Getting Started

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/) and npm
- SQL Server instance

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Configure the database connection string in `appsettings.json`:
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Server=<server>;Database=<db>;Trusted_Connection=True;"
     },
     "Cors": {
       "AllowedOrigins": ["http://localhost:5173"]
     }
   }
   ```

3. Run the API:
   ```bash
   dotnet run
   ```

   The API will be available at `http://localhost:5000`.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`.

> The Vite dev server proxies `/observability` and `/hubs` requests to `http://localhost:5000`, so no additional CORS configuration is needed during development.

### Build for Production

**Frontend:**
```bash
cd frontend
npm run build
```

**Backend:**
```bash
cd backend
dotnet publish -c Release
```
