D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC\DATABASE_SCHEMA.md

i have the data base schema. where the data needs to be populated.

identify which tables are already feeds data from trustage adaptor, and identify the tables that the adaptor does not feed the data.
Read D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC\DATABASE_SCHEMA.md
Agent:Explore codebase for DB inserts/updates
IN
Search the codebase at D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC for all database insert/update operations. Find all SQL INSERT, UPDATE statements, and any ORM calls that write to tables. List every table name that gets data written to it. Be thorough - check all .cs, .sql, .py, .ts, .js files. Also look for repository classes, service classes, and data access layer code.
Here's the cross-reference between the schema doc and the adaptor codebase:

Tables Fed by the TruStage Adaptor
Table	Written By	How
cfl.CU_Registry	CanonicalRepository	UPSERT on each run
kafka.BatchJourneys	KafkaMetricsRepository	INSERT on first stage, UPDATE on subsequent stages
kafka.PipelineStageTimings	KafkaMetricsRepository	INSERT per pipeline stage
kafka.DlqEvents	KafkaMetricsRepository	INSERT when message routed to DLQ
audit.IngestionBatches	CanonicalRepository	UPSERT as first step of SaveAsync
audit.PipelineValidationReports	PipelineValidationRepository	INSERT/UPDATE per batch
Tables NOT Fed by the Adaptor
Table	Schema	Reason
observability.IngestionEvents	observability	No writes found in codebase — legacy telemetry pipeline
observability.BlobContext	observability	No writes found
observability.PipelineMetrics	observability	No writes found
observability.ValidationMetrics	observability	No writes found
observability.HostContext	observability	No writes found
observability.BusinessContext	observability	No writes found
observability.ErrorContext	observability	No writes found
observability.CuConfiguration	observability	Populated manually during CU onboarding
adapter.CU_Schedule	adapter	No writes found — owned by scheduler, not adaptor
kafka.DlqEventOccurrences	kafka	Added in Migration 007, no adaptor writes
audit.FieldValidationReport	audit	Added in Migration 006, no adaptor writes
ops.CU_Notes	ops	Written by the monitoring dashboard UI only
Additional Tables Written by Adaptor (not in schema doc)
The adaptor also writes to these operational tables that aren't documented in DATABASE_SCHEMA.md:

Table	Purpose
AdapterRunLogs	Run summary log per execution
MemberRecords	Individual member rows from source file
AdapterRunErrors	Row-level parse/validation errors
kafka.TopicOffsets	Kafka partition offset snapshots
kafka.ConsumerGroupLags	Consumer group lag metrics
Key gap: The entire observability schema (8 tables) receives no data from the adaptor. These were originally designed for a legacy telemetry pipeline. If the observability dashboard needs to show data, those tables will need a separate feed — or the dashboard queries need to be redirected to the kafka.* and audit.* tables that the adaptor does populate.

can you check the above fact?
Let me read the schema and explore the codebase directly to verify.

Read D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC\DATABASE_SCHEMA.md
Agent:Find all DB write operations
IN
Search the codebase at D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC for ALL database write operations (INSERT, UPDATE, UPSERT, ExecuteAsync, SaveChanges, SaveAsync, DbContext writes, raw SQL). For every write found, note: 1) the exact file path and line number, 2) the table name being written to, 3) the class/method doing the write. Be thorough - check .cs, .sql files. List everything you find.
Bash
IN
find "D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC" -type f \( -name "*.cs" -o -name "*.sql" \) | head -50

OUT
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Adapters/AdapterBase.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Configuration/BlobStorageOptions.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Contracts/IAdapter.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Contracts/IBlobStorageService.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Contracts/ICanonicalAdapter.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Contracts/IDataMapper.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Contracts/IFileReader.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Contracts/IFileStreamProvider.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Exceptions/AdapterException.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Exceptions/UnsupportedFileFormatException.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Extensions/ServiceCollectionExtensions.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/IO/PhysicalFileStreamProvider.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/AdapterError.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/AdapterResult.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/Canonical/CuAccount.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/Canonical/CuJointOwner.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/Canonical/CuLoan.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/Canonical/CuLoanApplication.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/Canonical/CuMember.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/Canonical/CuRegistry.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/Canonical/CuTransaction.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/Canonical/IngestionBatch.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/CanonicalAdapterResult.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Models/MemberRecord.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/obj/Debug/net8.0/.NETCoreApp,Version=v8.0.AssemblyAttributes.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/obj/Debug/net8.0/TruStage.Adaptor.Core.AssemblyInfo.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/obj/Debug/net8.0/TruStage.Adaptor.Core.GlobalUsings.g.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/obj/Release/net8.0/.NETCoreApp,Version=v8.0.AssemblyAttributes.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/obj/Release/net8.0/TruStage.Adaptor.Core.AssemblyInfo.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/obj/Release/net8.0/TruStage.Adaptor.Core.GlobalUsings.g.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Readers/Base/FileReaderBase.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Readers/CsvFileReader.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Readers/ExcelFileReader.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Readers/FileReaderFactory.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Readers/JsonFileReader.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Readers/XmlFileReader.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Utilities/AdapterParsingHelpers.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.Core/Validation/BlobStorageOptionsValidator.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/Configuration/CreditUnionJsonOptions.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/CreditUnionJsonAdapter.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/Extensions/ServiceCollectionExtensions.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/Mappers/KeystoneAccountMapper.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/Mappers/KeystoneLoanMapper.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/Mappers/KeystoneMemberMapper.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/Mappers/KeystoneTransactionMapper.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/Models/KeystoneExport.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/obj/Debug/net8.0/.NETCoreApp,Version=v8.0.AssemblyAttributes.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/obj/Debug/net8.0/TruStage.Adaptor.CreditUnionJson.AssemblyInfo.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/obj/Debug/net8.0/TruStage.Adaptor.CreditUnionJson.GlobalUsings.g.cs
D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC/src/TruStage.Adaptor.CreditUnionJson/obj/Release/net8.0/.NETCoreApp,Version=v8.0.AssemblyAttributes.cs
Globpattern: "**/*.cs"
Found 101 files
Grep "FromSqlRaw|FromSqlInterpolated" (in D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC\src, type: cs)
1 line of output
Read D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC\src\TruStage.Adaptor.Persistence\Repositories\AdapterResultRepository.cs
Read D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC\src\TruStage.Adaptor.Persistence\AdaptorDbContext.cs
Grep "\.Add\(|\.Update\(|\.Remove\(|\.AddRange\(|\.UpdateRange\(|\.AddRangeAsync\(|\.UpdateRangeAsync\(" (in D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC\src\TruStage.Adaptor.Listeners, type: cs)
5 lines of output
Read D:\Truestage\Git\Trustage-git\TruStage_Adaptor_POC\src\TruStage.Adaptor.Persistence\Migrations\20250227000000_InitialSchema.cs
Here's the verified picture based on the actual codebase:

Verified: Tables Fed by the Adaptor
Table	Repository	Method	Write Type
cfl.CU_Registry	CanonicalRepository	UpsertRegistryAsync	UPSERT
audit.IngestionBatches	CanonicalRepository	UpsertBatchAsync	UPSERT
audit.PipelineValidationReports	PipelineValidationRepository	SaveReportAsync	UPSERT
kafka.BatchJourneys	KafkaMetricsRepository	UpdateBatchJourneyAsync	UPSERT
kafka.PipelineStageTimings	KafkaMetricsRepository	RecordStageTimingAsync	INSERT
kafka.DlqEvents	KafkaMetricsRepository	SaveDlqEventAsync	INSERT
Verified: Tables NOT in the Schema Doc, Also Written by Adaptor
Table	Repository	Notes
cfl.CU_Members	CanonicalRepository	Bulk UPSERT
cfl.CU_Accounts	CanonicalRepository	Bulk UPSERT
cfl.CU_Loans	CanonicalRepository	Bulk UPSERT
cfl.CU_Transactions	CanonicalRepository	Bulk INSERT (append-only)
cfl.CU_JointOwners	CanonicalRepository	Full replace (DELETE + INSERT)
AdapterRunLogs	AdapterResultRepository	Local adaptor DB
MemberRecords	AdapterResultRepository	Local adaptor DB
AdapterRunErrors	AdapterResultRepository	Local adaptor DB
kafka.TopicOffsets	KafkaMetricsRepository	Bulk INSERT
kafka.ConsumerGroupLags	KafkaMetricsRepository	Bulk INSERT
Verified: Tables NOT Fed by the Adaptor (confirmed no writes)
Table	Confirmed
All 8 observability.* tables	No writes found
adapter.CU_Schedule	No writes found
kafka.DlqEventOccurrences	No writes found
audit.FieldValidationReport	No writes found
ops.CU_Notes	No writes found (dashboard-owned)
Corrections to the Previous Analysis
The original was mostly correct on what it listed, but had one significant omission:

Missing from "tables fed": cfl.CU_Members, cfl.CU_Accounts, cfl.CU_Loans, cfl.CU_Transactions, and cfl.CU_JointOwners — these 5 tables are written by CanonicalRepository and are arguably the core canonical data tables the adaptor exists to populate. They're not documented in DATABASE_SCHEMA.md at all.

can you check the below path to check do we write any of those tables. because i am using it as a package in trustage adaptor to get those metrics.

D:\Truestage\Git\Trustage-git\TelemetryApp
Agent:Find DB writes in TelemetryApp
IN
Search the codebase at D:\Truestage\Git\Trustage-git\TelemetryApp for ALL database write operations. Find every SQL INSERT, UPDATE, UPSERT, EF Core SaveChanges, AddRange, Add, ExecuteAsync, or any other DB write. For each write found, note: 1) the exact file path and line number, 2) the exact table name being written to, 3) the class/method doing the write. Be thorough - check all .cs, .sql, .py, .ts, .js files. Also check for any package references, NuGet packages, or project references that might indicate what database schema this app targets. List the project structure and all repository/service classes you find.
Bash
IN
find "D:\Truestage\Git\Trustage-git\TelemetryApp" -type f -name "*.cs" -o -name "*.sql" -o -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.csproj" -o -name "*.json" 2>/dev/null | head -100

OUT
D:\Truestage\Git\Trustage-git\TelemetryApp/.claude/settings.local.json
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/AdapterTelemetryService.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/bin/Debug/net8.0/CuAdapter.Observability.deps.json
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/bin/Release/net8.0/CuAdapter.Observability.deps.json
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/CuAdapter.Observability.csproj
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/ApplicationBuilderExtensions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/IObservabilityBuilder.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/ObservabilityApplicationBuilderExtensions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/ObservabilityBuilder.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/ObservabilityServiceCollectionExtensions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/ServiceCollectionExtensions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/IAdapterTelemetryService.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Middleware/AdapterRunTrackingMiddleware.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Middleware/ObservabilityMiddleware.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/AdapterCorrelationContext.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/AdapterEvent.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/AdapterEventBuilder.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/AdapterEventType.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/AdapterStage.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/BlobEventContext.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/BusinessContext.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/EmitMode.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/ErrorContext.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/HostContext.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/ObservabilityOptions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/PipelineMetrics.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/ProcessingStatus.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/RunMetrics.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/TelemetryEvent.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/TelemetryLevel.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/ValidationMetrics.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/obj/CuAdapter.Observability.csproj.nuget.dgspec.json
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/obj/Debug/net8.0/.NETCoreApp,Version=v8.0.AssemblyAttributes.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/obj/Debug/net8.0/CuAdapter.Observability.AssemblyInfo.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/obj/Debug/net8.0/CuAdapter.Observability.GlobalUsings.g.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/obj/Debug/net8.0/CuAdapter.Observability.sourcelink.json
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/obj/project.assets.json
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/obj/Release/net8.0/.NETCoreApp,Version=v8.0.AssemblyAttributes.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/obj/Release/net8.0/CuAdapter.Observability.AssemblyInfo.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/obj/Release/net8.0/CuAdapter.Observability.GlobalUsings.g.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/obj/Release/net8.0/CuAdapter.Observability.sourcelink.json
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/CompositeTelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/FileTelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/FileTelemetrySinkOptions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/HttpTelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/HttpTelemetrySinkOptions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/IObservabilitySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/ITelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/NullObservabilitySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/NullTelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/SqlTelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/SqlTelemetrySinkOptions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/AdapterEventBuilderTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/AdapterTelemetryServiceTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/bin/Debug/net8.0/CuAdapter.Observability.Tests.deps.json
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/bin/Debug/net8.0/CuAdapter.Observability.Tests.runtimeconfig.json
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/CompositeTelemetrySinkTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/CuAdapter.Observability.Tests.csproj
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/FileTelemetrySinkTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/HttpTelemetrySinkTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/Models/NewContextModelsTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/Models/TelemetryEventTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/obj/CuAdapter.Observability.Tests.csproj.nuget.dgspec.json
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/obj/Debug/net8.0/.NETCoreApp,Version=v8.0.AssemblyAttributes.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/obj/Debug/net8.0/CuAdapter.Observability.Tests.AssemblyInfo.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/obj/Debug/net8.0/CuAdapter.Observability.Tests.GlobalUsings.g.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/obj/Debug/net8.0/CuAdapter.Observability.Tests.sourcelink.json
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/obj/project.assets.json
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/Sinks/NullObservabilitySinkTests.cs
Bash
IN
find "D:\Truestage\Git\Trustage-git\TelemetryApp" -type f \( -name "*.cs" -o -name "*.sql" -o -name "*.csproj" \) | grep -v "/obj/" | grep -v "/bin/" | sort

OUT
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/AdapterTelemetryService.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/CuAdapter.Observability.csproj
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/ApplicationBuilderExtensions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/IObservabilityBuilder.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/ObservabilityApplicationBuilderExtensions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/ObservabilityBuilder.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/ObservabilityServiceCollectionExtensions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions/ServiceCollectionExtensions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/IAdapterTelemetryService.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Middleware/AdapterRunTrackingMiddleware.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Middleware/ObservabilityMiddleware.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/AdapterCorrelationContext.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/AdapterEvent.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/AdapterEventBuilder.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/AdapterEventType.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/AdapterStage.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/BlobEventContext.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/BusinessContext.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/EmitMode.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/ErrorContext.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/HostContext.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/ObservabilityOptions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/PipelineMetrics.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/ProcessingStatus.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/RunMetrics.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/TelemetryEvent.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/TelemetryLevel.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models/ValidationMetrics.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/CompositeTelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/FileTelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/FileTelemetrySinkOptions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/HttpTelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/HttpTelemetrySinkOptions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/IObservabilitySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/ITelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/NullObservabilitySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/NullTelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/SqlTelemetrySink.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Sinks/SqlTelemetrySinkOptions.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/AdapterEventBuilderTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/AdapterTelemetryServiceTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/CompositeTelemetrySinkTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/CuAdapter.Observability.Tests.csproj
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/FileTelemetrySinkTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/HttpTelemetrySinkTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/Models/NewContextModelsTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/Models/TelemetryEventTests.cs
D:\Truestage\Git\Trustage-git\TelemetryApp/tests/CuAdapter.Observability.Tests/Sinks/NullObservabilitySinkTests.cs
Read D:\Truestage\Git\Trustage-git\TelemetryApp\tests\CuAdapter.Observability.Tests\CuAdapter.Observability.Tests.csproj
Grep "INSERT|UPDATE|DELETE|UPSERT|SaveChanges|AddRange|\.Add\(|ExecuteAsync|ExecuteNonQueryAsync" (in D:\Truestage\Git\Trustage-git\TelemetryApp, type: cs)
69 lines of output
Read D:\Truestage\Git\Trustage-git\TelemetryApp\src\CuAdapter.Observability\Sinks\CompositeTelemetrySink.cs
Grep "Repository|Service|DbContext|Database|Connection|Command" (in D:\Truestage\Git\Trustage-git\TelemetryApp, type: cs)
15 lines of output
Read D:\Truestage\Git\Trustage-git\TelemetryApp\src\CuAdapter.Observability\Sinks\SqlTelemetrySinkOptions.cs
Bash
IN
find "D:\Truestage\Git\Trustage-git\TelemetryApp" -type d | head -30

OUT
D:\Truestage\Git\Trustage-git\TelemetryApp
D:\Truestage\Git\Trustage-git\TelemetryApp/.claude
D:\Truestage\Git\Trustage-git\TelemetryApp/.git
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/hooks
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/info
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/logs
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/logs/refs
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/logs/refs/heads
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/logs/refs/remotes
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/logs/refs/remotes/origin
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/objects
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/objects/info
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/objects/pack
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/refs
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/refs/heads
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/refs/remotes
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/refs/remotes/origin
D:\Truestage\Git\Trustage-git\TelemetryApp/.git/refs/tags
D:\Truestage\Git\Trustage-git\TelemetryApp/.github
D:\Truestage\Git\Trustage-git\TelemetryApp/.github/workflows
D:\Truestage\Git\Trustage-git\TelemetryApp/src
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/bin
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/bin/Debug
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/bin/Debug/net8.0
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/bin/Release
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/bin/Release/net8.0
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Extensions
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Middleware
D:\Truestage\Git\Trustage-git\TelemetryApp/src/CuAdapter.Observability/Models
Bash
IN
find "D:\Truestage\Git\Trustage-git\TelemetryApp" -type f \( -name "*.py" -o -name "*.ts" -o -name "*.js" \) 2>/dev/null

OUT
(Bash completed with no output)
Read D:\Truestage\Git\Trustage-git\TelemetryApp\src\CuAdapter.Observability\Models\AdapterEvent.cs
Grep "DbContext|EF Core|Entity Framework|Dapper|SqlSugar|ORM" (in D:\Truestage\Git\Trustage-git\TelemetryApp, type: cs)
1 line of output
Bash
IN
grep -r "CREATE TABLE\|CREATE SCHEMA\|DROP TABLE\|ALTER TABLE" "D:\Truestage\Git\Trustage-git\TelemetryApp" 2>/dev/null | grep -v ".git" | head -20

OUT
(Bash completed with no output)
Here's what TelemetryApp actually does:

TelemetryApp Writes to ONE Table Only
[telemetry].[AdapterEvents] — auto-created by SqlTelemetrySink.EnsureTableAsync() on first emit.

This is not any of the observability.* tables from DATABASE_SCHEMA.md.

What This Means
The TelemetryApp is a flat, single-table sink. It collapses all the structured context data into JSON columns:

Column in telemetry.AdapterEvents	Equivalent observability.* table
[BlobContext] JSON	observability.BlobContext
[PipelineMetrics] JSON	observability.PipelineMetrics
[ValidationMetrics] JSON	observability.ValidationMetrics
[HostContext] JSON	observability.HostContext
[BusinessContext] JSON	observability.BusinessContext
[ErrorContext] JSON	observability.ErrorContext
[EventId], [CuId], [EventType]...	observability.IngestionEvents
Conclusion
The observability.* schema in DATABASE_SCHEMA.md is a normalized design that was never implemented as written. Instead, TelemetryApp stores the equivalent data denormalized into a single telemetry.AdapterEvents table with JSON columns.

The 8 observability.* tables remain unwritten. If the monitoring dashboard queries those tables by name (observability.IngestionEvents, etc.), it will get no data — the actual data lives in telemetry.AdapterEvents.