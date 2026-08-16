const prisma = require("../config/prisma");

// In-Memory Hype Meter Cache to handle 100,000+ taps without DB connection pool choke
const activeMeters = new Map();

/**
 * Get active meter from in-memory cache or DB
 */
async function getActiveMeter(id) {
  let meter = activeMeters.get(id);
  if (!meter) {
    const dbMeter = await prisma.hypeMeter.findUnique({
      where: { id },
      include: { event: true },
    });
    if (!dbMeter) return null;
    meter = {
      id: dbMeter.id,
      eventId: dbMeter.eventId,
      title: dbMeter.title,
      tapsNeeded: dbMeter.tapsNeeded,
      currentTaps: dbMeter.currentTaps,
      status: dbMeter.status,
      videoUrl: dbMeter.videoUrl,
      event: dbMeter.event,
      dirty: false,
    };
    if (dbMeter.status === "active") {
      activeMeters.set(id, meter);
    }
  }
  return meter;
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
 * Handle a tap event in memory
 */
async function registerTap(hypeMeterId) {
  const meter = await getActiveMeter(hypeMeterId);
  if (!meter || meter.status !== "active") return null;

  if (meter.currentTaps >= meter.tapsNeeded) {
    return { meter, isCompleted: true };
  }

  meter.currentTaps += 1;
  meter.dirty = true;

  const isCompleted = meter.currentTaps >= meter.tapsNeeded;
  if (isCompleted) {
    meter.status = "completed";
    activeMeters.delete(hypeMeterId);
    // Write completion state immediately to DB
    await prisma.hypeMeter.update({
      where: { id: hypeMeterId },
      data: { status: "completed", currentTaps: meter.currentTaps },
    });
  }

  return { meter, isCompleted };
}

/**
 * Stop a meter
 */
async function stopMeter(id) {
  const meter = await getActiveMeter(id);
  const currentTaps = meter ? meter.currentTaps : 0;
  
  if (meter) {
    meter.status = "stopped";
    activeMeters.delete(id);
  }

  const dbMeter = await prisma.hypeMeter.update({
    where: { id },
    data: { status: "stopped", currentTaps },
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
  registerTap,
  stopMeter,
};
