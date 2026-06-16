const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.post("/save-token", async (req, res) => {
  try {
    const { user_id, token } = req.body;

    await db.query(
      `
      INSERT INTO notification_tokens
      (user_id, token)
      VALUES ($1, $2)
      `,
      [user_id, token]
    );

    res.json({
      success: true,
      message: "Token saved",
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
    });
  }
});

module.exports = router;