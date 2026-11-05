import assert from 'node:assert/strict';
import test from 'node:test';
import { createContextRelay, createSessionEvidenceCollector } from '../src/index.js';

function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('posts the host assertion and then routes the exact report to Forge', async () => {
  const requests = [];
  const relay = createContextRelay({
    assertionUrl: 'https://signer.example.com/api/context-assertion',
    receiverUrl: 'https://receiver.example.com/intake',
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return requests.length === 1 ? jsonResponse(200, { envelope: 'header.payload.signature' }) : jsonResponse(201, { status: 'created', issueKey: 'CG26-42' });
    }
  });
  const receipt = await relay.submit({ report: { message: 'Checkout failed' }, surface: 'payments' });
  assert.equal(receipt.issueKey, 'CG26-42');
  assert.deepEqual(requests, [
    { url: 'https://signer.example.com/api/context-assertion', body: { report: { message: 'Checkout failed' }, surface: 'payments' } },
    { url: 'https://receiver.example.com/intake', body: { report: { message: 'Checkout failed' }, envelope: 'header.payload.signature' } }
  ]);
});

test('rejects an invalid client report before any network call', async () => {
  const relay = createContextRelay({ assertionUrl: 'https://signer.example.com/api', receiverUrl: 'https://receiver.example.com/intake', fetch: async () => { throw new Error('should not fetch'); } });
  await assert.rejects(relay.submit({ report: { message: '' }, surface: 'catalog' }), /report.message/);
});

test('binds an explicit local evidence snapshot into both relay requests', async () => {
  const calls = [];
  const relay = createContextRelay({
    assertionUrl: 'https://signer.example.com/api', receiverUrl: 'https://receiver.example.com/intake',
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => url.includes('signer') ? { envelope: 'header.payload.signature' } : { status: 'created', issueKey: 'CG26-11' } };
    }
  });
  const evidence = { schema: 'context-relay-session-v1', events: [{ type: 'bid.refresh', at: '2026-11-03T00:00:00.000Z', data: { lotId: '047' } }] };
  await relay.submit({ report: { message: 'Bid history moved backward.' }, evidence, surface: 'auction-lot-detail' });
  assert.deepEqual(calls[0].body.report.evidence, evidence);
  assert.deepEqual(calls[1].body.report.evidence, evidence);
});

test('keeps a bounded host-observed session buffer', () => {
  const fakeWindow = { location: { href: 'https://auction.example/lots/047', pathname: '/lots/047' }, document: { title: 'Lot 047', referrer: '' }, navigator: { language: 'en-US' }, innerWidth: 390, innerHeight: 844 };
  const collector = createSessionEvidenceCollector({ window: fakeWindow, maxEvents: 2, now: () => '2026-11-03T00:00:00.000Z' });
  collector.record('lot.opened', { lotId: '047' });
  collector.record('bid.refresh', { bidCount: 18 });
  collector.record('bid.history.regressed', { previous: 19, current: 18 });
  const evidence = collector.snapshot();
  assert.equal(evidence.observed.path, '/lots/047');
  assert.deepEqual(evidence.events.map((event) => event.type), ['bid.refresh', 'bid.history.regressed']);
});

test('trims old evidence so the signed packet stays within the intake budget', () => {
  const collector = createSessionEvidenceCollector({ window: {}, maxEvents: 50 });
  for (let index = 0; index < 50; index += 1) collector.record('detail', { value: 'x'.repeat(500), index });
  assert.ok(new TextEncoder().encode(JSON.stringify(collector.snapshot())).byteLength <= 6_000);
});
