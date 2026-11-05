export type RelayStage = 'requesting_assertion' | 'routing' | 'complete';

export interface RelayReceipt {
  status: 'created' | 'needs_triage';
  issueKey?: string;
  serviceId?: string;
  receivedAt?: string;
  reason?: string;
}

export interface ContextRelayClient {
  submit(input: {
    report: { message: string; evidence?: SessionEvidence };
    surface: string;
    evidence?: SessionEvidence;
    signal?: AbortSignal;
    onStatus?: (event: { stage: RelayStage; receipt?: RelayReceipt }) => void;
  }): Promise<RelayReceipt>;
}

export function createContextRelay(options: {
  assertionUrl: string;
  receiverUrl: string;
  evidenceCollector?: SessionEvidenceCollector;
  fetch?: typeof fetch;
}): ContextRelayClient;

export interface SessionEvidence { schema?: string; capturedAt?: string; observed?: Record<string, unknown>; events?: Array<{ type: string; at: string; data: Record<string, unknown> }>; }
export interface SessionEvidenceCollector { record(type: string, data?: Record<string, unknown>): void; snapshot(): SessionEvidence; enableShake(options?: { onShake?: (evidence: SessionEvidence) => void; threshold?: number; cooldownMs?: number }): Promise<() => void>; }
export function createSessionEvidenceCollector(options?: { window?: Window; maxEvents?: number; now?: () => string }): SessionEvidenceCollector;
