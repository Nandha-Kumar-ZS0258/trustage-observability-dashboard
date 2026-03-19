namespace TruStage.Observability.Api.Models;

// ── API response DTOs ─────────────────────────────────────────────────────────

public class AksKpiDto
{
    public int NodesOnline      { get; set; }
    public int NodesTotal       { get; set; }
    public int PodsRunning      { get; set; }
    public int WarningsLast24h  { get; set; }
    public int OomKillsLast24h  { get; set; }
    public int TotalRestarts    { get; set; }
    public int AdaptorsReady    { get; set; }
    public int AdaptorsTotal    { get; set; }
}

public class AdaptorPodHealthDto
{
    public string          AdaptorId             { get; set; } = "";
    public string          PodName               { get; set; } = "";
    public string          DeploymentName        { get; set; } = "";
    public string          Namespace             { get; set; } = "";
    public string          PodStatus             { get; set; } = "";  // Running / Pending / Failed
    public string          ContainerStatus       { get; set; } = "";  // running / waiting / terminated
    public string          ContainerStatusReason { get; set; } = "";  // e.g. CrashLoopBackOff
    public bool            IsReady               { get; set; }
    public int             RestartCount          { get; set; }
    public string          NodeName              { get; set; } = "";
    public string          PodIp                 { get; set; } = "";
    public DateTimeOffset? PodStartTime          { get; set; }
    public DateTimeOffset  LastSyncedAt          { get; set; }
}

public class ClusterEventDto
{
    public long            Id              { get; set; }
    public string?         AdaptorId       { get; set; }
    public string          ObjectKind      { get; set; } = "";  // Pod / Node
    public string          ObjectName      { get; set; } = "";
    public string?         Namespace       { get; set; }
    public string          Reason          { get; set; } = "";
    public string?         Message         { get; set; }
    public int             EventCount      { get; set; }
    public DateTimeOffset  FirstSeen       { get; set; }
    public DateTimeOffset  LastSeen        { get; set; }
    public string          KubeEventType   { get; set; } = "";  // Warning / Normal
    public string?         SourceComponent { get; set; }
}

public class EventSummaryDto
{
    public string Reason     { get; set; } = "";
    public string ObjectKind { get; set; } = "";
    public int    Count      { get; set; }
}

public class NodeHealthDto
{
    public string         NodeName      { get; set; } = "";
    public string?        OsType        { get; set; }
    public string?        AgentVersion  { get; set; }
    public DateTimeOffset LastHeartbeat { get; set; }
    public bool           IsOnline      { get; set; }
}

public class AdaptorUptimeDto
{
    public string  AdaptorId     { get; set; } = "";
    public decimal UptimePercent { get; set; }   // 0–100
    public int     TotalSamples  { get; set; }
    public int     ReadySamples  { get; set; }
}

public class RestartTrendDto
{
    public string Day          { get; set; } = "";  // "2026-03-17"
    public int    RestartCount { get; set; }
}

public class ProbeFailureTimelineDto
{
    public string Hour         { get; set; } = "";  // "2026-03-17T14:00"
    public int    FailureCount { get; set; }
}

public class AdaptorRunSummaryDto
{
    public string         BatchId         { get; set; } = "";
    public string         CuId            { get; set; } = "";
    public string?        FileName        { get; set; }
    public string         PodName         { get; set; } = "";
    public string?        NodeName        { get; set; }
    public DateTimeOffset RunStart        { get; set; }
    public DateTimeOffset RunEnd          { get; set; }
    public int            TotalDurationMs { get; set; }
    public string?        FinalOutcome    { get; set; }  // Passed / Failed
}

public class AdaptorRunStageDto
{
    public string         Stage        { get; set; } = "";
    public DateTimeOffset StageTime    { get; set; }
    public int?           MemberCount  { get; set; }
    public int?           ErrorCount   { get; set; }
    public int?           WarningCount { get; set; }
    public string?        GateResult   { get; set; }
    public string?        Outcome      { get; set; }
}

public class AdaptorRunContextDto
{
    public string         BatchId         { get; set; } = "";
    public string         CuId            { get; set; } = "";
    public string?        FileName        { get; set; }
    public string         PodName         { get; set; } = "";
    public string?        NodeName        { get; set; }
    public DateTimeOffset RunStart        { get; set; }
    public DateTimeOffset RunEnd          { get; set; }
    public int            TotalDurationMs { get; set; }
    public string?        FinalOutcome    { get; set; }
    public IEnumerable<AdaptorRunStageDto> Stages { get; set; } = [];
}
