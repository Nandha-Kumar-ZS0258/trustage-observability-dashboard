using System.Data;
using System.Text.Json;
using System.Text.RegularExpressions;
using Azure.Identity;
using Azure.Monitor.Query;
using Dapper;
using Microsoft.Data.SqlClient;

namespace TruStage.Observability.Api.Services;

/// <summary>
/// Background service that syncs AKS telemetry from Log Analytics into Azure SQL
/// every <c>Aks:SyncIntervalMs</c> milliseconds (default 2 min).
///
/// Tables written:
///   aks.AdaptorPodHealth  — latest state per adaptor, upserted from KubePodInventory
///   aks.ClusterEvents     — warning events appended from KubeEvents (7-day rolling)
///   aks.NodeHealth        — latest heartbeat per node, upserted from Heartbeat
///   aks.SyncState         — watermarks to avoid re-processing old rows
///
/// Adaptor identity:
///   Today  → AdaptorId = ControllerName (e.g. "trustage-adaptor")
///   Future → if pod label "adaptorId" is present, use that value instead.
///             New adaptors auto-appear as new rows — no code changes needed.
/// </summary>
public sealed class AksSyncService : IHostedService, IDisposable
{
    private readonly IConfiguration          _config;
    private readonly ILogger<AksSyncService> _logger;
    private CancellationTokenSource?         _cts;
    private Task?                            _syncTask;

    public AksSyncService(IConfiguration config, ILogger<AksSyncService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        var workspaceId = _config["Aks:WorkspaceId"];
        if (string.IsNullOrWhiteSpace(workspaceId))
        {
            _logger.LogWarning("[AksSync] Aks:WorkspaceId is not configured — AKS sync disabled.");
            return Task.CompletedTask;
        }

        var connStr = _config.GetConnectionString("TruStage");
        if (string.IsNullOrWhiteSpace(connStr))
        {
            _logger.LogWarning("[AksSync] ConnectionStrings:TruStage is not configured — AKS sync disabled.");
            return Task.CompletedTask;
        }

        _cts      = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _syncTask = SyncLoopAsync(workspaceId, connStr, _cts.Token);
        _logger.LogInformation("[AksSync] Started — syncing Log Analytics workspace {WorkspaceId} every {Interval}ms.",
            workspaceId, _config.GetValue("Aks:SyncIntervalMs", 120_000));
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_cts is null) return;
        await _cts.CancelAsync().ConfigureAwait(false);
        try { await (_syncTask ?? Task.CompletedTask).ConfigureAwait(false); }
        catch (OperationCanceledException) { }
    }

    public void Dispose() => _cts?.Dispose();

    // ── Sync loop ─────────────────────────────────────────────────────────────

    private async Task SyncLoopAsync(string workspaceId, string connStr, CancellationToken ct)
    {
        int intervalMs      = _config.GetValue("Aks:SyncIntervalMs", 120_000);
        int retentionDays   = _config.GetValue("Aks:EventRetentionDays", 7);
        var logsClient      = new LogsQueryClient(new DefaultAzureCredential());

        // Run immediately on startup, then on interval
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await RunSyncAsync(logsClient, workspaceId, connStr, retentionDays, ct).ConfigureAwait(false);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AksSync] Sync cycle failed — will retry in {Interval}ms.", intervalMs);
            }

            try { await Task.Delay(intervalMs, ct).ConfigureAwait(false); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task RunSyncAsync(
        LogsQueryClient logsClient,
        string workspaceId,
        string connStr,
        int retentionDays,
        CancellationToken ct)
    {
        using IDbConnection db = new SqlConnection(connStr);

        // 1. Read current watermarks
        var syncStates = (await db.QueryAsync<SyncStateRow>(
            "SELECT SyncKey, LastWatermark FROM aks.SyncState")).ToDictionary(r => r.SyncKey);

        string eventsWatermark = syncStates.TryGetValue("KubeEvents", out var es)
            ? es.LastWatermark ?? DateTimeOffset.UtcNow.AddHours(-24).ToString("o")
            : DateTimeOffset.UtcNow.AddHours(-24).ToString("o");

        string logsWatermark = syncStates.TryGetValue("ContainerLogV2", out var ls)
            ? ls.LastWatermark ?? DateTimeOffset.UtcNow.AddHours(-24).ToString("o")
            : DateTimeOffset.UtcNow.AddHours(-24).ToString("o");

        // 2. Sync pod health from KubePodInventory
        await SyncPodHealthAsync(logsClient, workspaceId, db, ct).ConfigureAwait(false);

        // 3. Sync warning events from KubeEvents
        await SyncClusterEventsAsync(logsClient, workspaceId, db, eventsWatermark, retentionDays, ct).ConfigureAwait(false);

        // 4. Sync node health from Heartbeat
        await SyncNodeHealthAsync(logsClient, workspaceId, db, ct).ConfigureAwait(false);

        // 5. Sync adaptor run logs from ContainerLogV2
        await SyncAdaptorRunLogsAsync(logsClient, workspaceId, db, logsWatermark, ct).ConfigureAwait(false);

        // 6. Update sync state
        var now = DateTimeOffset.UtcNow;
        await db.ExecuteAsync("""
            MERGE aks.SyncState AS target
            USING (VALUES (@key, @now, @watermark)) AS src(SyncKey, LastSyncedAt, LastWatermark)
            ON target.SyncKey = src.SyncKey
            WHEN MATCHED THEN UPDATE SET LastSyncedAt = src.LastSyncedAt, LastWatermark = src.LastWatermark
            WHEN NOT MATCHED THEN INSERT (SyncKey, LastSyncedAt, LastWatermark) VALUES (src.SyncKey, src.LastSyncedAt, src.LastWatermark);
            """,
            new { key = "KubeEvents", now, watermark = now.ToString("o") }).ConfigureAwait(false);

        await db.ExecuteAsync("""
            MERGE aks.SyncState AS target
            USING (VALUES (@key, @now, @watermark)) AS src(SyncKey, LastSyncedAt, LastWatermark)
            ON target.SyncKey = src.SyncKey
            WHEN MATCHED THEN UPDATE SET LastSyncedAt = src.LastSyncedAt, LastWatermark = src.LastWatermark
            WHEN NOT MATCHED THEN INSERT (SyncKey, LastSyncedAt, LastWatermark) VALUES (src.SyncKey, src.LastSyncedAt, src.LastWatermark);
            """,
            new { key = "ContainerLogV2", now, watermark = now.ToString("o") }).ConfigureAwait(false);

        // Purge old snapshots and run logs beyond retention window
        await db.ExecuteAsync("""
            DELETE FROM aks.AdaptorHealthSnapshot
            WHERE SnapshotTime < DATEADD(day, @negDays, SYSUTCDATETIME())
            """, new { negDays = -retentionDays }).ConfigureAwait(false);

        await db.ExecuteAsync("""
            DELETE FROM aks.AdaptorRunLog
            WHERE IngestedAt < DATEADD(day, -30, SYSUTCDATETIME())
            """).ConfigureAwait(false);

        _logger.LogInformation("[AksSync] Sync cycle complete at {Time}.", now);
    }

    // ── Pod health sync ───────────────────────────────────────────────────────

    private async Task SyncPodHealthAsync(
        LogsQueryClient logsClient, string workspaceId, IDbConnection db, CancellationToken ct)
    {
        // Get latest snapshot per DEPLOYMENT (not ReplicaSet) for all pods in the namespace.
        // ControllerName in KubePodInventory is the ReplicaSet name, e.g. "trustage-adaptor-6b64f56bd8".
        // We strip the trailing ReplicaSet hash to recover the Deployment name "trustage-adaptor",
        // then take the most-recent pod record per deployment.
        const string kql = """
            KubePodInventory
            | where Namespace == 'trustage'
            | where ControllerKind == 'ReplicaSet'
            | where PodStatus != 'Succeeded'
            | extend DeploymentName = replace_regex(ControllerName, @'-[a-f0-9]{8,12}$', '')
            | summarize arg_max(TimeGenerated, *) by DeploymentName
            | project TimeGenerated, Name, DeploymentName, ControllerName = DeploymentName,
                      ControllerKind, Namespace, PodStatus, ContainerStatus, ContainerStatusReason,
                      PodRestartCount, ContainerRestartCount, Computer, PodIp,
                      PodStartTime, PodLabel
            """;

        var response = await logsClient.QueryWorkspaceAsync(
            workspaceId, kql, QueryTimeRange.All, cancellationToken: ct).ConfigureAwait(false);

        if (response?.Value?.Table is null) return;

        var rows = response.Value.Table.Rows;
        var now  = DateTimeOffset.UtcNow;

        foreach (var row in rows)
        {
            var controllerName = row["ControllerName"]?.ToString() ?? "";
            var podLabel       = row["PodLabel"]?.ToString() ?? "";
            var adaptorId      = ExtractAdaptorId(controllerName, podLabel);

            var containerStatus       = row["ContainerStatus"]?.ToString() ?? "";
            var containerStatusReason = row["ContainerStatusReason"]?.ToString() ?? "";
            var podStatus             = row["PodStatus"]?.ToString() ?? "";
            bool isReady              = containerStatus.Equals("running", StringComparison.OrdinalIgnoreCase)
                                        && string.IsNullOrEmpty(containerStatusReason);

            int restartCount = 0;
            int.TryParse(row["PodRestartCount"]?.ToString(), out restartCount);

            DateTimeOffset? podStartTime = null;
            if (DateTimeOffset.TryParse(row["PodStartTime"]?.ToString(), out var pst))
                podStartTime = pst;

            await db.ExecuteAsync("""
                MERGE aks.AdaptorPodHealth AS target
                USING (VALUES (
                    @AdaptorId, @PodName, @DeploymentName, @Namespace,
                    @PodStatus, @ContainerStatus, @ContainerStatusReason,
                    @IsReady, @RestartCount, @NodeName, @PodIp, @PodStartTime,
                    @Labels, @LastSyncedAt
                )) AS src (
                    AdaptorId, PodName, DeploymentName, Namespace,
                    PodStatus, ContainerStatus, ContainerStatusReason,
                    IsReady, RestartCount, NodeName, PodIp, PodStartTime,
                    Labels, LastSyncedAt
                )
                ON target.AdaptorId = src.AdaptorId
                WHEN MATCHED THEN UPDATE SET
                    PodName = src.PodName, DeploymentName = src.DeploymentName,
                    Namespace = src.Namespace, PodStatus = src.PodStatus,
                    ContainerStatus = src.ContainerStatus,
                    ContainerStatusReason = src.ContainerStatusReason,
                    IsReady = src.IsReady, RestartCount = src.RestartCount,
                    NodeName = src.NodeName, PodIp = src.PodIp,
                    PodStartTime = src.PodStartTime, Labels = src.Labels,
                    LastSyncedAt = src.LastSyncedAt
                WHEN NOT MATCHED THEN INSERT (
                    AdaptorId, PodName, DeploymentName, Namespace,
                    PodStatus, ContainerStatus, ContainerStatusReason,
                    IsReady, RestartCount, NodeName, PodIp, PodStartTime,
                    Labels, LastSyncedAt
                ) VALUES (
                    src.AdaptorId, src.PodName, src.DeploymentName, src.Namespace,
                    src.PodStatus, src.ContainerStatus, src.ContainerStatusReason,
                    src.IsReady, src.RestartCount, src.NodeName, src.PodIp,
                    src.PodStartTime, src.Labels, src.LastSyncedAt
                );
                """, new
            {
                AdaptorId             = adaptorId,
                PodName               = row["Name"]?.ToString() ?? "",
                DeploymentName        = controllerName,
                Namespace             = row["Namespace"]?.ToString() ?? "",
                PodStatus             = podStatus,
                ContainerStatus       = containerStatus,
                ContainerStatusReason = containerStatusReason,
                IsReady               = isReady,
                RestartCount          = restartCount,
                NodeName              = row["Computer"]?.ToString() ?? "",
                PodIp                 = row["PodIp"]?.ToString() ?? "",
                PodStartTime          = podStartTime,
                Labels                = podLabel,
                LastSyncedAt          = now,
            }).ConfigureAwait(false);

            // Record a health snapshot for uptime % and restart trend charts
            await db.ExecuteAsync("""
                INSERT INTO aks.AdaptorHealthSnapshot (AdaptorId, IsReady, RestartCount, PodStatus)
                VALUES (@AdaptorId, @IsReady, @RestartCount, @PodStatus)
                """, new { AdaptorId = adaptorId, IsReady = isReady, RestartCount = restartCount, PodStatus = podStatus })
                .ConfigureAwait(false);
        }

        _logger.LogDebug("[AksSync] Upserted {Count} adaptor pod rows.", rows.Count);
    }

    // ── Cluster events sync ───────────────────────────────────────────────────


    private async Task SyncClusterEventsAsync(
        LogsQueryClient logsClient, string workspaceId, IDbConnection db,
        string watermark, int retentionDays, CancellationToken ct)
    {
        // Fetch warning events since last watermark
        string kql = $"""
            KubeEvents
            | where KubeEventType == 'Warning'
            | where LastSeen > datetime({watermark})
            | project TimeGenerated, Name, Namespace, ObjectKind, Reason,
                      Message, Count, FirstSeen, LastSeen, KubeEventType, SourceComponent
            | order by LastSeen asc
            """;

        var response = await logsClient.QueryWorkspaceAsync(
            workspaceId, kql, QueryTimeRange.All, cancellationToken: ct).ConfigureAwait(false);

        if (response?.Value?.Table is null) return;

        var rows    = response.Value.Table.Rows;
        var now     = DateTimeOffset.UtcNow;
        int inserted = 0;

        // Load known adaptor pod names to link events
        var adaptorPods = (await db.QueryAsync<(string AdaptorId, string PodName)>(
            "SELECT AdaptorId, PodName FROM aks.AdaptorPodHealth")).ToDictionary(r => r.PodName, r => r.AdaptorId);

        foreach (var row in rows)
        {
            var objectName = row["Name"]?.ToString() ?? "";
            var ns         = row["Namespace"]?.ToString();
            var reason     = row["Reason"]?.ToString() ?? "";

            // Check for duplicates by ObjectName + Reason + LastSeen
            DateTimeOffset.TryParse(row["LastSeen"]?.ToString(), out var lastSeen);
            DateTimeOffset.TryParse(row["FirstSeen"]?.ToString(), out var firstSeen);
            int.TryParse(row["Count"]?.ToString(), out var eventCount);

            bool exists = await db.ExecuteScalarAsync<int>("""
                SELECT COUNT(1) FROM aks.ClusterEvents
                WHERE ObjectName = @objectName AND Reason = @reason AND LastSeen = @lastSeen
                """, new { objectName, reason, lastSeen }) > 0;

            if (exists) continue;

            // Link to adaptor if the pod name matches
            string? adaptorId = adaptorPods.TryGetValue(objectName, out var aid) ? aid : null;
            // Also try prefix match for pods like "trustage-adaptor-6b64f56bd8-49gdf"
            if (adaptorId is null && !string.IsNullOrEmpty(ns) && ns == "trustage")
            {
                adaptorId = adaptorPods.Keys
                    .Where(p => !string.IsNullOrEmpty(p) && objectName.StartsWith(p.Split('-')[0], StringComparison.OrdinalIgnoreCase))
                    .Select(p => adaptorPods[p])
                    .FirstOrDefault();

                // Fallback: any adaptor in the same namespace
                if (adaptorId is null)
                {
                    var nsAdaptor = await db.QuerySingleOrDefaultAsync<string>(
                        "SELECT TOP 1 AdaptorId FROM aks.AdaptorPodHealth WHERE Namespace = @ns", new { ns });
                    adaptorId = nsAdaptor;
                }
            }

            await db.ExecuteAsync("""
                INSERT INTO aks.ClusterEvents
                    (AdaptorId, ObjectKind, ObjectName, Namespace, Reason, Message,
                     EventCount, FirstSeen, LastSeen, KubeEventType, SourceComponent)
                VALUES
                    (@AdaptorId, @ObjectKind, @ObjectName, @Namespace, @Reason, @Message,
                     @EventCount, @FirstSeen, @LastSeen, @KubeEventType, @SourceComponent)
                """, new
            {
                AdaptorId       = adaptorId,
                ObjectKind      = row["ObjectKind"]?.ToString() ?? "",
                ObjectName      = objectName,
                Namespace       = ns,
                Reason          = reason,
                Message         = row["Message"]?.ToString(),
                EventCount      = eventCount > 0 ? eventCount : 1,
                FirstSeen       = firstSeen,
                LastSeen        = lastSeen,
                KubeEventType   = row["KubeEventType"]?.ToString() ?? "Warning",
                SourceComponent = row["SourceComponent"]?.ToString(),
            }).ConfigureAwait(false);
            inserted++;
        }

        // Purge old events beyond retention window
        int deleted = await db.ExecuteAsync("""
            DELETE FROM aks.ClusterEvents
            WHERE IngestedAt < DATEADD(day, @negDays, SYSUTCDATETIME())
            """, new { negDays = -retentionDays }).ConfigureAwait(false);

        _logger.LogDebug("[AksSync] Inserted {Inserted} cluster events, purged {Deleted} old events.", inserted, deleted);
    }

    // ── Node health sync ──────────────────────────────────────────────────────

    private async Task SyncNodeHealthAsync(
        LogsQueryClient logsClient, string workspaceId, IDbConnection db, CancellationToken ct)
    {
        const string kql = """
            Heartbeat
            | where TimeGenerated > ago(1h)
            | where Computer startswith 'aks-'
            | summarize arg_max(TimeGenerated, *) by Computer
            | project Computer, OSType, Version, TimeGenerated
            """;

        var response = await logsClient.QueryWorkspaceAsync(
            workspaceId, kql, QueryTimeRange.All, cancellationToken: ct).ConfigureAwait(false);

        if (response?.Value?.Table is null) return;

        var rows     = response.Value.Table.Rows;
        var now      = DateTimeOffset.UtcNow;
        var activeNodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows)
        {
            var nodeName = row["Computer"]?.ToString() ?? "";
            if (string.IsNullOrEmpty(nodeName)) continue;
            activeNodes.Add(nodeName);

            DateTimeOffset.TryParse(row["TimeGenerated"]?.ToString(), out var lastHeartbeat);

            await db.ExecuteAsync("""
                MERGE aks.NodeHealth AS target
                USING (VALUES (@NodeName, @OsType, @AgentVersion, @LastHeartbeat, @IsOnline, @LastSyncedAt))
                    AS src (NodeName, OsType, AgentVersion, LastHeartbeat, IsOnline, LastSyncedAt)
                ON target.NodeName = src.NodeName
                WHEN MATCHED THEN UPDATE SET
                    OsType = src.OsType, AgentVersion = src.AgentVersion,
                    LastHeartbeat = src.LastHeartbeat, IsOnline = src.IsOnline,
                    LastSyncedAt = src.LastSyncedAt
                WHEN NOT MATCHED THEN INSERT
                    (NodeName, OsType, AgentVersion, LastHeartbeat, IsOnline, LastSyncedAt)
                VALUES
                    (src.NodeName, src.OsType, src.AgentVersion, src.LastHeartbeat, src.IsOnline, src.LastSyncedAt);
                """, new
            {
                NodeName     = nodeName,
                OsType       = row["OSType"]?.ToString(),
                AgentVersion = row["Version"]?.ToString(),
                LastHeartbeat = lastHeartbeat,
                IsOnline     = true,
                LastSyncedAt = now,
            }).ConfigureAwait(false);
        }

        // Mark nodes not seen recently as offline
        if (activeNodes.Count > 0)
        {
            await db.ExecuteAsync("""
                UPDATE aks.NodeHealth SET IsOnline = 0
                WHERE LastHeartbeat < DATEADD(minute, -10, SYSUTCDATETIME())
                """).ConfigureAwait(false);
        }

        _logger.LogDebug("[AksSync] Upserted {Count} node health rows.", rows.Count);
    }

    // ── Adaptor run log sync ──────────────────────────────────────────────────

    // Matches: [Stage] CU {CuId} batch {BatchId}[: {rest}]
    // The colon is OPTIONAL — SchemaValidation messages do not use it:
    //   [SchemaValidation] CU cu-id batch guid passed schema validation (N members)
    //   [RulesValidation]  CU cu-id batch guid: Gate1=PASS Gate2=PASS | blocked=0 warnings=2
    //   [Publishing]       CU cu-id batch guid: persisted N members
    // Ingestion stage is excluded — its log messages do not include a BatchId.
    private static readonly Regex _stageHeaderRx = new(
        @"^\[(?<stage>SchemaValidation|RulesValidation|Publishing)\]\s+CU\s+(?<cu>\S+)\s+batch\s+(?<batch>[0-9a-f\-]{36})\s*:?\s*(?<rest>.*)$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex _memberCountRx   = new(@"\((?<n>\d+)\s+members?\)", RegexOptions.Compiled);
    private static readonly Regex _errorsRx        = new(@"Errors=(?<n>\d+)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex _warningsRx      = new(@"[Ww]arnings=(?<n>\d+)", RegexOptions.Compiled);
    private static readonly Regex _gateResultRx    = new(@"(Gate\d+=\w+(?:\s+Gate\d+=\w+)*)", RegexOptions.Compiled);
    private static readonly Regex _outcomeRx       = new(@"Overall=(?<o>Passed|Failed)", RegexOptions.Compiled);
    private static readonly Regex _schemaPassedRx  = new(@"passed schema validation", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex _schemaFailedRx  = new(@"failed schema validation", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex _fileNameRx      = new(@"archived blob\s+(?<f>\S+)", RegexOptions.Compiled);
    private static readonly Regex _blockedRx       = new(@"blocked=(?<n>\d+)", RegexOptions.Compiled);

    private async Task SyncAdaptorRunLogsAsync(
        LogsQueryClient logsClient, string workspaceId, IDbConnection db,
        string watermark, CancellationToken ct)
    {
        string kql = $"""
            ContainerLogV2
            | where TimeGenerated > datetime({watermark})
            | where PodNamespace == 'trustage'
            | where PodName contains 'trustage-adaptor'
            | where LogMessage matches regex @'\[(SchemaValidation|RulesValidation|Publishing)\] CU [^ ]+ batch [0-9a-f-]+'
            | project TimeGenerated, PodName, LogMessage
            | order by TimeGenerated asc
            """;

        var response = await logsClient.QueryWorkspaceAsync(
            workspaceId, kql, QueryTimeRange.All, cancellationToken: ct).ConfigureAwait(false);

        if (response?.Value?.Table is null) return;

        var rows = response.Value.Table.Rows;

        // Load pod → node mapping
        var podNodes = (await db.QueryAsync<(string PodName, string NodeName)>(
            "SELECT PodName, NodeName FROM aks.AdaptorPodHealth")).ToDictionary(r => r.PodName, r => r.NodeName);

        int inserted = 0;

        foreach (var row in rows)
        {
            // .NET ConsoleLogger writes two lines: the prefix on line 1 and the message
            // indented with 6 spaces on line 2.  Kubernetes captures each line as a
            // separate ContainerLogV2 row, so the meaningful line starts with spaces.
            var logMessage = (row["LogMessage"]?.ToString() ?? "").TrimStart();
            var podName    = row["PodName"]?.ToString() ?? "";
            DateTimeOffset.TryParse(row["TimeGenerated"]?.ToString(), out var stageTime);

            var m = _stageHeaderRx.Match(logMessage);
            if (!m.Success) continue;

            var stage   = m.Groups["stage"].Value;
            var cuId    = m.Groups["cu"].Value;
            var batchId = m.Groups["batch"].Value;
            var rest    = m.Groups["rest"].Value;

            // Skip rows where nothing useful follows the batch GUID
            if (string.IsNullOrWhiteSpace(rest)) continue;

            string? fileName     = _fileNameRx.Match(rest) is { Success: true } fm ? fm.Groups["f"].Value : null;
            int?    memberCount  = _memberCountRx.Match(rest) is { Success: true } mc ? int.Parse(mc.Groups["n"].Value) : null;
            int?    errorCount   = _errorsRx.Match(rest) is { Success: true } em ? int.Parse(em.Groups["n"].Value) : null;
            int?    warningCount = _warningsRx.Match(rest) is { Success: true } wm ? int.Parse(wm.Groups["n"].Value) : null;
            string? gateResult   = _gateResultRx.Match(rest) is { Success: true } gm ? gm.Value.Trim() : null;
            string? outcome      = _outcomeRx.Match(rest) is { Success: true } om ? om.Groups["o"].Value : null;

            // SchemaValidation outcome comes from "passed/failed schema validation" text
            if (outcome is null)
            {
                if (_schemaPassedRx.IsMatch(rest)) outcome = "Passed";
                else if (_schemaFailedRx.IsMatch(rest)) outcome = "Failed";
            }

            // blocked= lines from RulesValidation count as errors when no Errors= present
            if (errorCount is null && _blockedRx.Match(rest) is { Success: true } bm && int.Parse(bm.Groups["n"].Value) > 0)
                errorCount = int.Parse(bm.Groups["n"].Value);

            podNodes.TryGetValue(podName, out var nodeName);

            // Deduplicate by BatchId + Stage + StageTime
            bool exists = await db.ExecuteScalarAsync<int>("""
                SELECT COUNT(1) FROM aks.AdaptorRunLog
                WHERE BatchId = @batchId AND Stage = @stage AND StageTime = @stageTime
                """, new { batchId, stage, stageTime }) > 0;

            if (exists) continue;

            await db.ExecuteAsync("""
                INSERT INTO aks.AdaptorRunLog
                    (BatchId, CuId, FileName, Stage, PodName, NodeName, StageTime,
                     MemberCount, ErrorCount, WarningCount, GateResult, Outcome)
                VALUES
                    (@BatchId, @CuId, @FileName, @Stage, @PodName, @NodeName, @StageTime,
                     @MemberCount, @ErrorCount, @WarningCount, @GateResult, @Outcome)
                """, new
            {
                BatchId      = batchId,
                CuId         = cuId,
                FileName     = fileName,
                Stage        = stage,
                PodName      = podName,
                NodeName     = nodeName,
                StageTime    = stageTime,
                MemberCount  = memberCount,
                ErrorCount   = errorCount,
                WarningCount = warningCount,
                GateResult   = gateResult,
                Outcome      = outcome,
            }).ConfigureAwait(false);
            inserted++;
        }

        _logger.LogDebug("[AksSync] Inserted {Count} adaptor run log rows.", inserted);
    }

    // ── AdaptorId extraction (future-proof) ───────────────────────────────────

    /// <summary>
    /// Extracts a stable adaptor identity from K8s metadata.
    /// Priority:
    ///   1. Pod label "adaptorId" — set this when deploying a new adaptor
    ///   2. ControllerName        — works today with a single shared deployment
    /// When a team deploys trustage-adaptor-{id} with label adaptorId={id},
    /// the new adaptor auto-appears as a distinct row — no code changes needed.
    /// </summary>
    private static string ExtractAdaptorId(string controllerName, string podLabelJson)
    {
        if (!string.IsNullOrWhiteSpace(podLabelJson) && podLabelJson != "None")
        {
            try
            {
                // PodLabel comes as a JSON array: [{"key":"value",...}]
                // Try both array and object forms
                string json = podLabelJson.Trim();
                if (json.StartsWith('['))
                {
                    var arr = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(json);
                    if (arr is { Count: > 0 } && arr[0].TryGetValue("adaptorId", out var labelId))
                        return labelId;
                }
                else if (json.StartsWith('{'))
                {
                    var obj = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
                    if (obj?.TryGetValue("adaptorId", out var labelId2) == true)
                        return labelId2;
                }
            }
            catch { /* malformed label JSON — fall through to ControllerName */ }
        }

        return controllerName; // e.g. "trustage-adaptor" today
    }

    // ── DB row model ──────────────────────────────────────────────────────────

    private sealed class SyncStateRow
    {
        public string  SyncKey       { get; set; } = "";
        public string? LastWatermark { get; set; }
    }
}
