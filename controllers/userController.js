const db = require("../config/db");

const getUsers = async (req, res) => {
  try {

    const users = await db.query(
      "SELECT id, username, email FROM users"
    );

    res.status(200).json(users.rows);

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

module.exports = {
  getUsers,
};