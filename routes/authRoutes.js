const express = require("express");

const {
  signup,
  login,
  saveToken,
} = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);

router.post("/save-token", saveToken);

module.exports = router;