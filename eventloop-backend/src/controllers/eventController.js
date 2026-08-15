const prisma = require("../config/prisma");
const { isValidObjectId } = require("../utils/validation");

// 1. Get All Events (Includes participant counts)
const getEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });
    res.json({ success: true, events });
  } catch (error) {
    console.error("❌ Get events error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch events" });
  }
};

// 2. Get Single Event (by ID or Code)
const getEvent = async (req, res) => {
  const { id, code } = req.query;

  try {
    let event = null;
    if (id && isValidObjectId(id)) {
      event = await prisma.event.findUnique({
        where: { id },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      });
    }
    if (!event && code) {
      event = await prisma.event.findUnique({
        where: { code: String(code).trim() },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      });
    }

    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    res.json({ success: true, event });
  } catch (error) {
    console.error("❌ Get event error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch event" });
  }
};

// 3. Create Event (Admin)
const createEvent = async (req, res) => {
  const { title, description, location, startDate, endDate, code, createdBy } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: "Event title is required" });
  }

  let eventCode = code ? String(code).trim() : "";
  if (!eventCode) {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    eventCode = `${slug}-${randomSuffix}`;
  }

  try {
    const existing = await prisma.event.findUnique({ where: { code: eventCode } });
    if (existing) {
      eventCode = `${eventCode}-${Date.now().toString().slice(-4)}`;
    }

    const newEvent = await prisma.event.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        location: location ? location.trim() : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        code: eventCode,
        createdBy: createdBy && isValidObjectId(createdBy) ? createdBy : null,
        status: "active",
      },
    });

    console.log(`Created new event: ${newEvent.title} (${newEvent.code})`);
    res.json({ success: true, event: newEvent });
  } catch (error) {
    console.error("❌ Create event error:", error);
    res.status(500).json({ success: false, error: "Failed to create event" });
  }
};

// 4. Join Event (Backend persistence for authenticated user)
const joinEvent = async (req, res) => {
  const { userId, eventId, code } = req.body;

  if (!userId || !isValidObjectId(userId)) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Only logged-in users can join an event.",
    });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found. Please sign in again." });
    }

    let event = null;
    if (eventId && isValidObjectId(eventId)) {
      event = await prisma.event.findUnique({ where: { id: eventId } });
    }
    if (!event && code) {
      event = await prisma.event.findUnique({ where: { code: String(code).trim() } });
    }

    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found. Invalid event code or QR code." });
    }

    const participant = await prisma.eventParticipant.upsert({
      where: {
        eventId_userId: {
          eventId: event.id,
          userId: user.id,
        },
      },
      update: {
        joinedAt: new Date(),
      },
      create: {
        eventId: event.id,
        userId: user.id,
      },
    });

    console.log(`User ${user.email || user.id} joined event: ${event.title} (${event.code}) on backend`);
    res.json({ success: true, event, participant });
  } catch (error) {
    console.error("❌ Join event error:", error);
    res.status(500).json({ success: false, error: "Failed to process event join on backend" });
  }
};

// 5. Get Joined Events for a User
const getUserJoinedEvents = async (req, res) => {
  const { userId } = req.query;

  if (!userId || !isValidObjectId(userId)) {
    return res.status(400).json({ success: false, error: "Valid User ID is required" });
  }

  try {
    const participants = await prisma.eventParticipant.findMany({
      where: { userId: String(userId) },
      orderBy: { joinedAt: "desc" },
      include: {
        event: true,
      },
    });

    const events = participants.map((p) => ({
      ...p.event,
      joinedAt: p.joinedAt,
    }));

    res.json({ success: true, events });
  } catch (error) {
    console.error("❌ Get user joined events error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch joined events" });
  }
};

// 6. Delete Event (Admin)
const deleteEvent = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Event ID" });
  }

  try {
    await prisma.event.delete({ where: { id } });
    console.log(`Deleted event: ${id}`);
    res.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.error("❌ Delete event error:", error);
    res.status(500).json({ success: false, error: "Failed to delete event" });
  }
};

module.exports = {
  getEvents,
  getEvent,
  createEvent,
  joinEvent,
  getUserJoinedEvents,
  deleteEvent,
};
