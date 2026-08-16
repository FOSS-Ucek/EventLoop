const express = require("express");
const {
  getHypeMeters,
  getHypeMeter,
  createHypeMeter,
  deleteHypeMeter,
  activateHypeMeter,
  resetHypeMeter,
} = require("../controllers/hypeMeterController");

const router = express.Router();

router.get("/hype-meters", getHypeMeters);
router.get("/hype-meter/:id", getHypeMeter);
router.post("/hype-meters", createHypeMeter);
router.delete("/hype-meters/:id", deleteHypeMeter);
router.post("/hype-meters/:id/activate", activateHypeMeter);
router.post("/hype-meters/:id/reset", resetHypeMeter);

module.exports = router;
