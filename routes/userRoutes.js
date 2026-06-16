const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET ALL USERS
router.get("/", async (req, res) => {
  try {
    const users = await db.query(`
      SELECT id, username, email
      FROM users
      ORDER BY username
    `);

    res.json(users.rows);

  } catch (error) {
    console.log("Users Error:", error);

    res.status(500).json({
      message: "Server Error",
    });
  }
});

module.exports = router;