const express = require("express");

const {
  getMessages,
} = require("../controllers/messageController");

const router = express.Router();

router.get(
  "/:senderId/:receiverId",
  getMessages
);

module.exports = router;