const db = require("../config/db");

const getMessages = async (req, res) => {
  try {

    const { senderId, receiverId } = req.params;

    const messages = await db.query(
      `
      SELECT * FROM messages
      WHERE
      (sender_id = $1 AND receiver_id = $2)
      OR
      (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at ASC
      `,
      [senderId, receiverId]
    );

    res.status(200).json(messages.rows);

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

module.exports = {
  getMessages,
};