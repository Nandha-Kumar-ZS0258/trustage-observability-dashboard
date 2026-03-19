// AKS Health types — mirroring AksModels.cs DTOs

export interface AksKpi {
  nodesOnline:     number;
  nodesTotal:      number;
  podsRunning:     number;
  warningsLast24h: number;
  oomKillsLast24h: number;
  totalRestarts:   number;
  adaptorsReady:   number;
  adaptorsTotal:   number;
}

export interface AdaptorPodHealth {
  adaptorId:             string;
  podName:               string;
  deploymentName:        string;
  namespace:             string;
  podStatus:             string;   // Running / Pending / Failed / Succeeded
  containerStatus:       string;   // running / waiting / terminated
  containerStatusReason: string;   // e.g. CrashLoopBackOff
  isReady:               boolean;
  restartCount:          number;
  nodeName:              string;
  podIp:                 string;
  podStartTime:          string | null;
  lastSyncedAt:          string;
}

export interface ClusterEvent {
  id:              number;
  adaptorId:       string | null;
  objectKind:      string;   // Pod / Node
  objectName:      string;
  namespace:       string | null;
  reason:          string;
  message:         string | null;
  eventCount:      number;
  firstSeen:       string;
  lastSeen:        string;
  kubeEventType:   string;   // Warning / Normal
  sourceComponent: string | null;
}

export interface EventSummary {
  reason:     string;
  objectKind: string;
  count:      number;
}

export interface NodeHealth {
  nodeName:      string;
  osType:        string | null;
  agentVersion:  string | null;
  lastHeartbeat: string;
  isOnline:      boolean;
}

export interface AdaptorUptime {
  adaptorId:     string;
  uptimePercent: number;
  totalSamples:  number;
  readySamples:  number;
}

export interface RestartTrend {
  day:          string;
  restartCount: number;
}

export interface ProbeFailureTimeline {
  hour:         string;
  failureCount: number;
}

export interface AdaptorHistory {
  uptime:        AdaptorUptime;
  restartTrend:  RestartTrend[];
  probeTimeline: ProbeFailureTimeline[];
}

export interface AdaptorRunSummary {
  batchId:         string;
  cuId:            string;
  fileName:        string | null;
  podName:         string;
  nodeName:        string | null;
  runStart:        string;
  runEnd:          string;
  totalDurationMs: number;
  finalOutcome:    string | null;  // Passed / Failed
}

export interface AdaptorRunStage {
  stage:        string;
  stageTime:    string;
  memberCount:  number | null;
  errorCount:   number | null;
  warningCount: number | null;
  gateResult:   string | null;
  outcome:      string | null;
}

export interface AdaptorRunContext extends AdaptorRunSummary {
  stages: AdaptorRunStage[];
}
