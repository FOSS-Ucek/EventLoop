/**
 * Load test for EventLoop's hype-meter realtime path.
 *
 * Simulates N concurrent users:
 *   1. Cold-start probe: single hit to /health before anything else (Render free tier
 *      spins down after 15min idle - this measures that penalty in isolation).
 *   2. HTTP burst: N concurrent GET /api/hype-meter/:id (what every client's page load does).
 *   3. Socket.io burst: N concurrent socket connections, all join the event room, then all
 *      tap repeatedly for a fixed duration. Per-tap latency is measured end-to-end: time from
 *      when a simulated client emits "hype:tap" to when that same client's tap shows up in a
 *      broadcast "HYPE_METER_UPDATE" (matched via a unique fake tapper name per client).
 *
 * Usage:
 *   node hype-loadtest.js <backendUrl> <eventId> <hypeMeterId> [concurrentUsers] [tapDurationSec]
 *
 * Requires the disposable test event's hype meter to be ACTIVE (not pending/completed) and
 * have a large tapsNeeded (e.g. 100000) so it doesn't complete mid-test.
 */

const { io } = require("socket.io-client");

const BACKEND_URL = process.argv[2];
const EVENT_ID = process.argv[3];
const HYPE_METER_ID = process.argv[4];
const CONCURRENT_USERS = parseInt(process.argv[5] || "180", 10);
const TAP_DURATION_SEC = parseInt(process.argv[6] || "20", 10);

if (!BACKEND_URL || !EVENT_ID || !HYPE_METER_ID) {
  console.error("Usage: node hype-loadtest.js <backendUrl> <eventId> <hypeMeterId> [concurrentUsers] [tapDurationSec]");
  process.exit(1);
}

function percentile(arr, p) {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function stats(arr) {
  if (arr.length === 0) return { min: NaN, avg: NaN, p50: NaN, p95: NaN, p99: NaN, max: NaN, count: 0 };
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    count: arr.length,
    min: Math.min(...arr).toFixed(0),
    avg: (sum / arr.length).toFixed(0),
    p50: percentile(arr, 50).toFixed(0),
    p95: percentile(arr, 95).toFixed(0),
    p99: percentile(arr, 99).toFixed(0),
    max: Math.max(...arr).toFixed(0),
  };
}

async function httpGetTiming(url) {
  const start = Date.now();
  try {
    const res = await fetch(url);
    await res.text();
    return { ok: res.ok, ms: Date.now() - start, status: res.status };
  } catch (err) {
    return { ok: false, ms: Date.now() - start, error: err.message };
  }
}

async function main() {
  console.log(`\n=== EventLoop Hype-Meter Load Test ===`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Event: ${EVENT_ID}  HypeMeter: ${HYPE_METER_ID}`);
  console.log(`Simulated users: ${CONCURRENT_USERS}  Tap duration: ${TAP_DURATION_SEC}s\n`);

  // ---- Phase 1: cold-start probe ----
  console.log("[1/3] Cold-start probe (single request to /health)...");
  const cold = await httpGetTiming(`${BACKEND_URL}/health`);
  console.log(
    cold.ok
      ? `  -> responded in ${cold.ms}ms (status ${cold.status})${cold.ms > 3000 ? "  *** looks like a cold start ***" : ""}`
      : `  -> FAILED after ${cold.ms}ms: ${cold.error || cold.status}`
  );

  // ---- Phase 2: HTTP burst (everyone opens the hype-meter page at once) ----
  console.log(`\n[2/3] HTTP burst: ${CONCURRENT_USERS} concurrent GET /api/hype-meter/${HYPE_METER_ID} ...`);
  const httpStart = Date.now();
  const httpResults = await Promise.all(
    Array.from({ length: CONCURRENT_USERS }, () => httpGetTiming(`${BACKEND_URL}/api/hype-meter/${HYPE_METER_ID}`))
  );
  const httpWallMs = Date.now() - httpStart;
  const httpOk = httpResults.filter((r) => r.ok);
  const httpFail = httpResults.filter((r) => !r.ok);
  const httpLatencies = httpOk.map((r) => r.ms);
  console.log(`  -> wall time for all ${CONCURRENT_USERS} requests: ${httpWallMs}ms`);
  console.log(`  -> success: ${httpOk.length}/${CONCURRENT_USERS}, failed: ${httpFail.length}`);
  console.log(`  -> latency (ms): ${JSON.stringify(stats(httpLatencies))}`);
  if (httpFail.length > 0) {
    console.log(`  -> sample failures: ${JSON.stringify(httpFail.slice(0, 3))}`);
  }

  // ---- Phase 3: socket.io burst (everyone connects, joins, taps) ----
  console.log(`\n[3/3] Socket.io burst: connecting ${CONCURRENT_USERS} clients...`);

  const clients = [];
  const connectLatencies = [];
  const tapLatenciesByUser = new Map(); // userName -> array of pending sentAt timestamps (FIFO)
  const tapRoundTripMs = [];
  let connectFailures = 0;
  let totalTapsSent = 0;
  let totalUpdatesReceived = 0;

  const connectPromises = Array.from({ length: CONCURRENT_USERS }, (_, i) => {
    return new Promise((resolve) => {
      const userName = `LoadTestUser-${i}`;
      const connectStart = Date.now();
      const socket = io(BACKEND_URL, { transports: ["websocket"], reconnection: false, timeout: 20000 });
      tapLatenciesByUser.set(userName, []);

      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      socket.on("connect", () => {
        connectLatencies.push(Date.now() - connectStart);
        socket.emit("hype:join-room", { eventId: EVENT_ID });
        finish();
      });

      socket.on("connect_error", (err) => {
        connectFailures++;
        finish();
      });

      socket.on("HYPE_METER_UPDATE", (payload) => {
        totalUpdatesReceived++;
        const tapperName = payload?.tapper?.name;
        if (tapperName && tapLatenciesByUser.has(tapperName)) {
          const queue = tapLatenciesByUser.get(tapperName);
          const sentAt = queue.shift();
          if (sentAt !== undefined) {
            tapRoundTripMs.push(Date.now() - sentAt);
          }
        }
      });

      clients.push({ socket, userName });
    });
  });

  await Promise.all(connectPromises);
  console.log(`  -> connected: ${clients.filter((c) => c.socket.connected).length}/${CONCURRENT_USERS}, failed: ${connectFailures}`);
  console.log(`  -> connect latency (ms): ${JSON.stringify(stats(connectLatencies))}`);

  console.log(`\n  Tapping for ${TAP_DURATION_SEC}s (each client taps every 250-600ms, like a real user)...`);
  const tapEnd = Date.now() + TAP_DURATION_SEC * 1000;
  const tapIntervals = [];

  clients.forEach(({ socket, userName }) => {
    const tap = () => {
      if (Date.now() >= tapEnd || !socket.connected) return;
      const sentAt = Date.now();
      tapLatenciesByUser.get(userName).push(sentAt);
      totalTapsSent++;
      socket.emit("hype:tap", { hypeMeterId: HYPE_METER_ID, user: { name: userName, image: null } });
      const nextDelay = 250 + Math.random() * 350;
      tapIntervals.push(setTimeout(tap, nextDelay));
    };
    tap();
  });

  await new Promise((resolve) => setTimeout(resolve, TAP_DURATION_SEC * 1000 + 1500));
  tapIntervals.forEach(clearTimeout);

  console.log(`\n  -> total taps sent: ${totalTapsSent}`);
  console.log(`  -> total broadcast updates received (per-client, summed): ${totalUpdatesReceived}`);
  console.log(`  -> matched tap round-trip latency (ms): ${JSON.stringify(stats(tapRoundTripMs))}`);
  const unmatched = [...tapLatenciesByUser.values()].reduce((sum, q) => sum + q.length, 0);
  console.log(`  -> unmatched taps (sent but no broadcast seen back): ${unmatched}`);

  clients.forEach(({ socket }) => socket.disconnect());

  console.log(`\n=== Done ===\n`);
}

main().catch((err) => {
  console.error("Load test crashed:", err);
  process.exit(1);
});
