const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUser,
  upsertUser,
  updateUser,
} = require("../controllers/userController");

router.get("/users", getUsers);
router.get("/user", getUser);
router.post("/user/upsert", upsertUser);
router.post("/user/update", updateUser);

module.exports = router;
