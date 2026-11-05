const MAX_MESSAGE_LENGTH = 2_000;

export { createSessionEvidenceCollector } from './evidence.js';

function requireUrl(value, name) {
  if (typeof value !== 'string' || !value.startsWith('https://')) {
    throw new Error(`${name} must be an HTTPS URL`);
  }
  return value;
}

function assertMessage(report) {
  if (!report || typeof report.message !== 'string' || !report.message.trim() || report.message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`report.message is required and must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('Context Relay returned a non-JSON response');
  return response.json();
}

/**
 * Creates a browser client for the Context Relay protocol.
 * The host signer owns the mapping from surface to verified service context.
 */
export function createContextRelay({ assertionUrl, receiverUrl, evidenceCollector, fetch: fetchImplementation = globalThis.fetch }) {
  requireUrl(assertionUrl, 'assertionUrl');
  requireUrl(receiverUrl, 'receiverUrl');
  if (typeof fetchImplementation !== 'function') throw new Error('A fetch implementation is required');

  return {
    async submit({ report, surface, evidence, signal, onStatus }) {
      assertMessage(report);
      if (typeof surface !== 'string' || !surface) throw new Error('surface is required');
      const status = typeof onStatus === 'function' ? onStatus : () => {};
      const enrichedReport = evidence || evidenceCollector ? {
        ...report,
        evidence: evidence || evidenceCollector.snapshot()
      } : report;

      status({ stage: 'requesting_assertion' });
      const assertionResponse = await fetchImplementation(assertionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: enrichedReport, surface }),
        signal
      });
      const assertion = await parseResponse(assertionResponse);
      if (!assertionResponse.ok || typeof assertion.envelope !== 'string') {
        throw new Error(assertion.message || 'The host could not create a Context Relay assertion');
      }

      status({ stage: 'routing' });
      const receiverResponse = await fetchImplementation(receiverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: enrichedReport, envelope: assertion.envelope }),
        signal
      });
      const receipt = await parseResponse(receiverResponse);
      if (!receiverResponse.ok && receiverResponse.status !== 202) {
        throw new Error(receipt.message || receipt.error || 'Context Relay rejected the report');
      }
      status({ stage: 'complete', receipt });
      return receipt;
    }
  };
}
