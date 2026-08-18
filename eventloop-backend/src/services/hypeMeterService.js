const prisma = require("../config/prisma");

// In-Memory Hype Meter Cache
const activeMeters = new Map();
const loadingPromises = new Map();

/**
 * Get active meter from in-memory cache or DB (with promise deduplication)
 */
async function getActiveMeter(id) {
  let meter = activeMeters.get(id);
  if (meter) return meter;

  // Deduplicate concurrent async DB fetches for the same meter ID
  if (loadingPromises.has(id)) {
    return await loadingPromises.get(id);
  }

  const promise = (async () => {
    try {
      const dbMeter = await prisma.hypeMeter.findUnique({
        where: { id },
        include: { event: true },
      });
      if (!dbMeter) return null;

      // Check cache again in case activateMeter ran while we were fetching
      if (activeMeters.has(id)) {
        return activeMeters.get(id);
      }

      const m = {
        id: dbMeter.id,
        eventId: dbMeter.eventId,
        title: dbMeter.title,
        tapsNeeded: dbMeter.tapsNeeded,
        currentTaps: dbMeter.currentTaps,
        status: dbMeter.status,
        videoUrl: dbMeter.videoUrl,
        event: dbMeter.event,
        startedAt: dbMeter.startedAt,
        dirty: false,
      };

      if (dbMeter.status === "active") {
        activeMeters.set(id, m);
      }
      return m;
    } finally {
      loadingPromises.delete(id);
    }
  })();

  loadingPromises.set(id, promise);
  return await promise;
}

/**
 * Activate a meter in memory and DB
 */
async function activateMeter(id) {
  const meterToActivate = await prisma.hypeMeter.findUnique({ where: { id } });
  if (meterToActivate) {
    await prisma.hypeMeter.updateMany({
      where: { eventId: meterToActivate.eventId, status: "active" },
      data: { status: "pending" },
    });
    // Remove stale active meters for this event from in-memory cache
    for (const [k, v] of activeMeters.entries()) {
      if (v.eventId === meterToActivate.eventId) {
        activeMeters.delete(k);
      }
    }
  }

  const dbMeter = await prisma.hypeMeter.update({
    where: { id },
    data: { status: "active", currentTaps: 0, startedAt: new Date() },
    include: { event: true },
  });

  const meter = {
    id: dbMeter.id,
    eventId: dbMeter.eventId,
    title: dbMeter.title,
    tapsNeeded: dbMeter.tapsNeeded,
    currentTaps: 0,
    status: "active",
    videoUrl: dbMeter.videoUrl,
    event: dbMeter.event,
    startedAt: dbMeter.startedAt,
    dirty: false,
  };

  activeMeters.set(id, meter);
  return meter;
}

/**
 * Reset a meter to pending / 0 taps
 */
async function resetMeter(id) {
  activeMeters.delete(id);
  const updated = await prisma.hypeMeter.update({
    where: { id },
    data: { status: "pending", currentTaps: 0 },
    include: { event: true },
  });
  return updated;
}

/**
 * Handle a tap event synchronously in memory to prevent race conditions.
 * Does NOT broadcast directly - marks the meter dirty for the batched
 * broadcast loop (see index.js) so a burst of concurrent taps collapses
 * into one outgoing update per interval instead of one per tap.
 */
function registerTapSync(hypeMeterId, tapper) {
  const meter = activeMeters.get(hypeMeterId);
  if (!meter || meter.status !== "active") return null;

  if (meter.currentTaps >= meter.tapsNeeded) {
    return { meter, isCompleted: true };
  }

  meter.currentTaps += 1;
  meter.dirty = true;
  meter.pendingBroadcast = true;
  if (tapper) {
    if (!meter.pendingTappers) meter.pendingTappers = [];
    meter.pendingTappers.push(tapper);
    if (meter.pendingTappers.length > 8) meter.pendingTappers.shift();
  }

  const isCompleted = meter.currentTaps >= meter.tapsNeeded;
  if (isCompleted) {
    meter.status = "completed";
    activeMeters.delete(hypeMeterId);

    // Asynchronously update completion in DB
    prisma.hypeMeter
      .update({
        where: { id: hypeMeterId },
        data: { status: "completed", currentTaps: meter.currentTaps },
      })
      .catch((err) => console.error("❌ Completion DB update error:", err));
  }

  return { meter, isCompleted };
}

/**
 * Async wrapper for tap registration
 */
async function registerTap(hypeMeterId, tapper) {
  let meter = activeMeters.get(hypeMeterId);
  if (!meter) {
    meter = await getActiveMeter(hypeMeterId);
  }
  if (!meter || meter.status !== "active") return null;
  return registerTapSync(hypeMeterId, tapper);
}

/**
 * Stop a meter
 */
async function stopMeter(id) {
  const meter = activeMeters.get(id);
  const currentTaps = meter ? meter.currentTaps : 0;

  activeMeters.delete(id);

  const dbMeter = await prisma.hypeMeter.update({
    where: { id },
    data: { status: "stopped", currentTaps },
    include: { event: true },
  });

  return dbMeter;
}

// Background DB Sync every 2 seconds for high-performance batch updates
setInterval(async () => {
  for (const [id, meter] of activeMeters.entries()) {
    if (meter.dirty && meter.status === "active") {
      meter.dirty = false;
      try {
        await prisma.hypeMeter.update({
          where: { id },
          data: { currentTaps: meter.currentTaps },
        });
      } catch (err) {
        console.error(`❌ DB Sync error for hype meter ${id}:`, err);
      }
    }
  }
}, 2000);

module.exports = {
  activeMeters,
  getActiveMeter,
  activateMeter,
  resetMeter,
  registerTap,
  registerTapSync,
  stopMeter,
};
