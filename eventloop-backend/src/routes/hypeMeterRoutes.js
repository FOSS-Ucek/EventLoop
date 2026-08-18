const express = require("express");
const { requireAdmin } = require("../middleware/auth");
const {
  getHypeMeters,
  getHypeMeter,
  createHypeMeter,
  updateHypeMeter,
  deleteHypeMeter,
  activateHypeMeter,
  resetHypeMeter,
  stopHypeMeter,
} = require("../controllers/hypeMeterController");

const router = express.Router();

router.get("/hype-meters", getHypeMeters);
router.get("/hype-meter/:id", getHypeMeter);
router.post("/hype-meters", requireAdmin, createHypeMeter);
router.put("/hype-meters/:id", requireAdmin, updateHypeMeter);
router.delete("/hype-meters/:id", requireAdmin, deleteHypeMeter);
router.post("/hype-meters/:id/activate", requireAdmin, activateHypeMeter);
router.post("/hype-meters/:id/stop", requireAdmin, stopHypeMeter);
router.post("/hype-meters/:id/reset", requireAdmin, resetHypeMeter);

module.exports = router;
