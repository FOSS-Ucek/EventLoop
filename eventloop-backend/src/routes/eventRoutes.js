const express = require("express");
const router = express.Router();
const {
  getEvents,
  getEvent,
  createEvent,
  joinEvent,
  getUserJoinedEvents,
  deleteEvent,
} = require("../controllers/eventController");

router.get("/events", getEvents);
router.get("/event", getEvent);
router.post("/events", createEvent);
router.post("/event/join", joinEvent);
router.get("/user/joined-events", getUserJoinedEvents);
router.delete("/events/:id", deleteEvent);

module.exports = router;
