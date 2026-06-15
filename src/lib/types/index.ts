export interface Service {
  id: string;
  name: string;
  ownerTeam: string;
  classification: "customer-facing" | "internal" | "infrastructure";
  healthStatus: "healthy" | "degraded" | "down" | "unknown";
  lastHealthCheckAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dependency {
  id: string;
  sourceServiceId: string;
  targetServiceId: string;
  dependencyType:
    | "http_call"
    | "database_access"
    | "message_queue"
    | "shared_cache"
    | "dns"
    | "configuration";
  observedFrequency: string;
  observedLatencyMs: string;
  confidenceScore: string;
  lastObservedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthSignal {
  id: string;
  serviceId: string;
  signalType: "error_rate" | "latency_p95" | "health_check";
  metricValue: string;
  thresholdValue: string | null;
  isBreach: boolean;
  recordedAt: Date;
}

export interface TrafficSnapshot {
  serviceId: string;
  avgRequestsPerMin: string;
  conversionRate: string;
  avgOrderValueCents: number;
  revenuePerMinCents: number;
  snapshotWindowStart: Date;
  snapshotWindowEnd: Date;
  recalculatedAt: Date;
}

export interface FailureEvent {
  id: string;
  serviceId: string;
  failureType: "health_check" | "error_spike" | "latency_degradation";
  severity: "degraded" | "down";
  signalDetails: Record<string, unknown> | null;
  detectedAt: Date;
  resolvedAt: Date | null;
}

export interface Incident {
  id: string;
  rootFailureEventId: string;
  startedAt: Date;
  resolvedAt: Date | null;
  totalRevenueImpactCents: number;
  affectedServiceCount: number;
  maxDepth: number;
  resolutionNotes: string | null;
}

export interface BlastRadiusResult {
  id: string;
  incidentId: string;
  affectedServiceId: string;
  depth: number;
  dependencyPath: string[];
  dependencyType: string | null;
  isCustomerFacing: boolean;
  revenuePerMinCents: number;
  detectedAt: Date;
}

export interface GraphNode {
  id: string;
  name: string;
  classification: string;
  healthStatus: string;
  ownerTeam: string;
}

export interface GraphEdge {
  id: string;
  sourceServiceId: string;
  targetServiceId: string;
  dependencyType: string;
  confidenceScore: string;
  observedFrequency: string;
  observedLatencyMs: string;
}

export interface BlastRadiusEntry {
  serviceName: string;
  serviceId: string;
  classification: string;
  ownerTeam: string;
  depth: number;
  path: string[];
  dependencyType: string;
  isCustomerFacing: boolean;
  revenuePerMinCents: number;
  avgRequestsPerMin: number;
  conversionRate: number;
  avgOrderValueCents: number;
}

export interface UpstreamCandidate {
  serviceName: string;
  serviceId: string;
  healthStatus: string;
  depth: number;
  path: string[];
}

export interface IncidentWithDetails extends Incident {
  rootServiceName: string;
  failureType: string;
  blastRadius: BlastRadiusEntry[];
  upstreamCandidates: UpstreamCandidate[];
}

export interface IngestPayload {
  source: string;
  target: string;
  type: string;
  frequency: number;
  latency: number;
  timestamp?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface FixPriority {
  serviceName: string;
  serviceId: string;
  healthStatus: string;
  depth: number;
  score: number;
  reasons: string[];
}

export interface IncidentSummarySection {
  headline: string;
  whatHappened: string;
  rootCauseAnalysis: string;
  blastRadiusSummary: string;
  revenueImpactSummary: string;
  fixPriority: string;
  fullSummary: string;
}

export interface SimulateResult {
  incidentId: string;
  failureEventId: string;
  failedService: string;
  blastRadiusCount: number;
  totalRevenuePerMinCents: number;
  totalRevenuePerMinDollars: number;
  cascadeDepth: number;
  customerFacingAffected: number;
  affectedServices: Array<{
    name: string;
    depth: number;
    classification: string;
    isCustomerFacing: boolean;
    revenuePerMinCents: number;
  }>;
}
