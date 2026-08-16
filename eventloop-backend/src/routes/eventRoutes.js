const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middleware/auth");
const {
  getEvents,
  getEvent,
  createEvent,
  joinEvent,
  getUserJoinedEvents,
  deleteEvent,
  getEventState,
} = require("../controllers/eventController");

router.get("/events", getEvents);
router.get("/event", getEvent);
router.get("/event/state", getEventState);
router.post("/events", requireAdmin, createEvent);
router.post("/event/join", joinEvent);
router.get("/user/joined-events", getUserJoinedEvents);
router.delete("/events/:id", requireAdmin, deleteEvent);

module.exports = router;
