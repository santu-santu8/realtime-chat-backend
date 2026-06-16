const express = require("express");

const router = express.Router();

const db = require("../config/db");

// GET UNREAD COUNTS
router.get("/:userId", async (req, res) => {

  try {

    const { userId } = req.params;

    const result = await db.query(
      `
      SELECT
        sender_id,
        COUNT(*) as unread_count
      FROM messages
      WHERE receiver_id = $1
      AND is_read = false
      GROUP BY sender_id
      `,
      [userId]
    );

    res.status(200).json(
      result.rows
    );

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message:
        "Failed to fetch unread counts",
    });
  }
});

// MARK AS READ
router.put(
  "/mark-read",
  async (req, res) => {

    try {

      const {
        sender_id,
        receiver_id,
      } = req.body;

      await db.query(
        `
        UPDATE messages
        SET is_read = true
        WHERE sender_id = $1
        AND receiver_id = $2
        `,
        [
          sender_id,
          receiver_id,
        ]
      );

      res.status(200).json({
        message:
          "Messages marked as read",
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message:
          "Failed to mark messages",
      });
    }
  }
);

module.exports = router;