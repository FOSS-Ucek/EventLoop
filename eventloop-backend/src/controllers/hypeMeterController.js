const prisma = require("../config/prisma");
const { isValidObjectId } = require("../utils/validation");

// 1. Get All Hype Meters for an Event
const getHypeMeters = async (req, res) => {
  const { eventId } = req.query;
  
  if (!eventId || !isValidObjectId(eventId)) {
    return res.status(400).json({ success: false, error: "Valid Event ID is required" });
  }

  try {
    const hypeMeters = await prisma.hypeMeter.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      include: {
        event: {
          select: { title: true }
        }
      }
    });
    res.json({ success: true, hypeMeters });
  } catch (error) {
    console.error("❌ Get hype meters error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch hype meters" });
  }
};

// 2. Get Single Hype Meter
const getHypeMeter = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Hype Meter ID" });
  }

  try {
    const hypeMeter = await prisma.hypeMeter.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!hypeMeter) {
      return res.status(404).json({ success: false, error: "Hype meter not found" });
    }

    res.json({ success: true, hypeMeter });
  } catch (error) {
    console.error("❌ Get hype meter error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch hype meter" });
  }
};

// 3. Create Hype Meter
const createHypeMeter = async (req, res) => {
  const { eventId, title, tapsNeeded, videoUrl, createdBy } = req.body;

  if (!eventId || !isValidObjectId(eventId)) {
    return res.status(400).json({ success: false, error: "Valid Event ID is required" });
  }
  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: "Title is required" });
  }
  if (!videoUrl || !videoUrl.trim()) {
    return res.status(400).json({ success: false, error: "Video URL is required" });
  }
  if (!tapsNeeded || tapsNeeded <= 0) {
    return res.status(400).json({ success: false, error: "Taps needed must be greater than 0" });
  }

  try {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    const newMeter = await prisma.hypeMeter.create({
      data: {
        eventId,
        title: title.trim(),
        tapsNeeded: Number(tapsNeeded),
        videoUrl: videoUrl.trim(),
        createdBy: createdBy && isValidObjectId(createdBy) ? createdBy : null,
      },
    });

    console.log(`Created new hype meter: ${newMeter.title}`);
    res.json({ success: true, hypeMeter: newMeter });
  } catch (error) {
    console.error("❌ Create hype meter error:", error);
    res.status(500).json({ success: false, error: "Failed to create hype meter" });
  }
};

// 4. Delete Hype Meter
const deleteHypeMeter = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Hype Meter ID" });
  }

  try {
    await prisma.hypeMeter.delete({ where: { id } });
    console.log(`Deleted hype meter: ${id}`);
    res.json({ success: true, message: "Hype meter deleted successfully" });
  } catch (error) {
    console.error("❌ Delete hype meter error:", error);
    res.status(500).json({ success: false, error: "Failed to delete hype meter" });
  }
};

// 5. Activate Hype Meter
const activateHypeMeter = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Hype Meter ID" });
  }

  try {
    const updated = await prisma.hypeMeter.update({
      where: { id },
      data: { status: "active", currentTaps: 0 },
    });
    console.log(`Activated hype meter: ${id}`);
    res.json({ success: true, hypeMeter: updated });
  } catch (error) {
    console.error("❌ Activate hype meter error:", error);
    res.status(500).json({ success: false, error: "Failed to activate hype meter" });
  }
};

// 6. Reset Hype Meter
const resetHypeMeter = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Hype Meter ID" });
  }

  try {
    const updated = await prisma.hypeMeter.update({
      where: { id },
      data: { status: "pending", currentTaps: 0 },
    });
    console.log(`Reset hype meter: ${id}`);
    res.json({ success: true, hypeMeter: updated });
  } catch (error) {
    console.error("❌ Reset hype meter error:", error);
    res.status(500).json({ success: false, error: "Failed to reset hype meter" });
  }
};

module.exports = {
  getHypeMeters,
  getHypeMeter,
  createHypeMeter,
  deleteHypeMeter,
  activateHypeMeter,
  resetHypeMeter,
};
