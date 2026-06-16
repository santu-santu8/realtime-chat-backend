const express =
  require("express");

const router =
  express.Router();

const db =
  require("../config/db");

// GET USERS
router.get(
  "/",
  async (req, res) => {

    try {

      const users =
        await db.query(
          `
          SELECT
          id,
          username,
          email,
          last_seen
          FROM users
          `
        );

      res.json(
        users.rows
      );

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message:
          "Server Error",
      });
    }
  }
);

module.exports =
  router;