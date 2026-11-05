const MAX_EVENTS = 50;
const MAX_VALUE_LENGTH = 500;
const MAX_SNAPSHOT_BYTES = 6_000;

function bounded(value) {
  if (typeof value === 'string') return value.slice(0, MAX_VALUE_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(bounded);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => [key.slice(0, 80), bounded(item)]));
  }
  return undefined;
}

/**
 * Keeps a short, local-only history of host-observed session facts. Hosts decide
 * which facts to record; the collector never reads cookies, storage, form values,
 * headers, or the DOM. A snapshot is made only when the host submits a report.
 */
export function createSessionEvidenceCollector({ window: browserWindow = globalThis.window, maxEvents = MAX_EVENTS, now = () => new Date().toISOString() } = {}) {
  const events = [];

  function record(type, data = {}) {
    if (typeof type !== 'string' || !type.trim()) throw new Error('evidence event type is required');
    events.push({ type: type.trim().slice(0, 80), at: now(), data: bounded(data) || {} });
    if (events.length > maxEvents) events.shift();
  }

  function snapshot() {
    const location = browserWindow?.location;
    const packet = {
      schema: 'context-relay-session-v1',
      capturedAt: now(),
      observed: {
        url: location?.href,
        path: location?.pathname,
        title: browserWindow?.document?.title,
        referrer: browserWindow?.document?.referrer,
        locale: browserWindow?.navigator?.language,
        viewport: browserWindow ? { width: browserWindow.innerWidth, height: browserWindow.innerHeight } : undefined
      },
      events: [...events]
    };
    // Leave room for the report text and protocol envelope in Forge's bounded
    // intake request. Keep the newest evidence when a host records heavily.
    while (packet.events.length && new TextEncoder().encode(JSON.stringify(packet)).byteLength > MAX_SNAPSHOT_BYTES) {
      packet.events.shift();
    }
    return packet;
  }

  async function enableShake({ onShake, threshold = 22, cooldownMs = 1_500 } = {}) {
    if (!browserWindow?.addEventListener) throw new Error('Shake capture requires a browser window');
    if (typeof browserWindow.DeviceMotionEvent?.requestPermission === 'function') {
      const permission = await browserWindow.DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') throw new Error('Motion permission was not granted');
    }
    let lastShakeAt = 0;
    const listener = (event) => {
      const acceleration = event.accelerationIncludingGravity || event.acceleration;
      const magnitude = Math.abs(acceleration?.x || 0) + Math.abs(acceleration?.y || 0) + Math.abs(acceleration?.z || 0);
      const nowMs = Date.now();
      if (magnitude < threshold || nowMs - lastShakeAt < cooldownMs) return;
      lastShakeAt = nowMs;
      record('device.shake', { magnitude: Math.round(magnitude * 100) / 100 });
      onShake?.(snapshot());
    };
    browserWindow.addEventListener('devicemotion', listener);
    return () => browserWindow.removeEventListener('devicemotion', listener);
  }

  return { record, snapshot, enableShake };
}
