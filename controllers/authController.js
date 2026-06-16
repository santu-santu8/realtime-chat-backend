const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ======================
// SIGNUP
// ======================

const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await db.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const newUser = await db.query(
      `
      INSERT INTO users
      (username, email, password)
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [
        username,
        email,
        hashedPassword,
      ]
    );

    const token = jwt.sign(
      { id: newUser.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Signup successful",
      token,
      user: newUser.rows[0],
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ======================
// LOGIN
// ======================

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const validPassword =
      await bcrypt.compare(
        password,
        user.rows[0].password
      );

    if (!validPassword) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { id: user.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: user.rows[0],
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ======================
// SAVE FCM TOKEN
// ======================

const saveToken = async (req, res) => {
  try {

    const {
      user_id,
      token,
    } = req.body;

    await db.query(
      `
      INSERT INTO notification_tokens
      (user_id, token)
      VALUES ($1, $2)
      `,
      [user_id, token]
    );

    res.status(200).json({
      message: "Token saved successfully",
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server error",
    });

  }
};

// ======================
// EXPORTS
// ======================

module.exports = {
  signup,
  login,
  saveToken,
};