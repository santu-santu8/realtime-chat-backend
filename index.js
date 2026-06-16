
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const db = require("./config/db");

// ======================
// FIREBASE ADMIN SDK
// ======================
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:
      process.env.FIREBASE_PROJECT_ID,

    clientEmail:
      process.env.FIREBASE_CLIENT_EMAIL,

    privateKey:
      process.env.FIREBASE_PRIVATE_KEY.replace(
        /\\n/g,
        "\n"
      ),
  }),
});

// ======================
// ROUTES
// ======================

const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const userRoutes = require("./routes/userRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const unreadRoutes = require("./routes/unreadRoutes");

const app = express();
const server = http.createServer(app);

// ======================
// SOCKET.IO
// ======================

const io = new Server(server, {
  cors: {
    origin: "https://realtime-chat-backend-5kgp.onrender.com",
    methods: ["GET", "POST"],
  },
});

// ======================
// MIDDLEWARE
// ======================

app.use(cors());
app.use(express.json());

// ======================
// STATIC FILES
// ======================

app.use("/uploads", express.static("uploads"));

// ======================
// API ROUTES
// ======================

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/unread", unreadRoutes);

// ======================
// DATABASE
// ======================

db.connect()
  .then(() => {
    console.log("PostgreSQL Connected");
  })
  .catch((err) => {
    console.log("Database Error:", err);
  });

// ======================
// ONLINE USERS
// ======================

const onlineUsers = {};

// ======================
// LAST SEEN USERS
// ======================

const lastSeenUsers = {};

// ======================
// SEND ONLINE USERS
// ======================

const emitOnlineUsers = () => {
  io.emit("online_users", Object.keys(onlineUsers));
};

// ======================
// REMOVE USER
// ======================

const removeUser = (socketId) => {
  for (const userId in onlineUsers) {
    if (onlineUsers[userId] === socketId) {
      lastSeenUsers[userId] = new Date();
      delete onlineUsers[userId];

      io.emit("last_seen_update", {
        userId,
        lastSeen: lastSeenUsers[userId],
      });
      break;
    }
  }
  emitOnlineUsers();
};

// ======================
// SOCKET CONNECTION
// ======================

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  // ======================
  // USER JOIN
  // ======================

  socket.on("join", async (userId) => {
    try {
      userId = userId.toString();
      onlineUsers[userId] = socket.id;

      console.log("ONLINE USERS:", onlineUsers);
      emitOnlineUsers();

      // SEND LAST SEEN DATA
      socket.emit("all_last_seen", lastSeenUsers);

      // ======================
      // MARK DELIVERED
      // ======================

      await db.query(
        `
        UPDATE messages
        SET is_delivered = true
        WHERE receiver_id = $1
        AND is_delivered = false
        `,
        [userId]
      );

      // ======================
      // SEND DELIVERY EVENTS
      // ======================

      const deliveredMessages = await db.query(
        `
        SELECT *
        FROM messages
        WHERE receiver_id = $1
        `,
        [userId]
      );

      deliveredMessages.rows.forEach((msg) => {
        const senderSocketId = onlineUsers[msg.sender_id.toString()];

        if (senderSocketId) {
          io.to(senderSocketId).emit("message_delivered", {
            message_id: msg.id,
          });
        }
      });
    } catch (error) {
      console.log("JOIN ERROR:", error);
    }
  });

  // ======================
  // SEND MESSAGE
  // ======================

  socket.on("send_message", async (data) => {
    try {
      const {
        sender_id,
        receiver_id,
        message,
        file_url,
        reply_to = null,
      } = data;

      const receiverSocketId = onlineUsers[receiver_id.toString()];
      const isDelivered = !!receiverSocketId;

      // ======================
      // INSERT MESSAGE
      // ======================

      const savedMessage = await db.query(
        `
        INSERT INTO messages
        (
          sender_id,
          receiver_id,
          message,
          file_url,
          reply_to,
          is_read,
          is_delivered
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        `,
        [
          sender_id,
          receiver_id,
          message,
          file_url,
          reply_to,
          false,
          isDelivered,
        ]
      );

      const newMessage = savedMessage.rows[0];

      // ======================
      // SEND PUSH NOTIFICATION
      // ======================
      try {
        const tokenResult = await db.query(
          `
          SELECT token
          FROM notification_tokens
          WHERE user_id = $1
          `,
          [receiver_id]
        );

        console.log(
          "Token Query Result:",
          tokenResult.rows
        );

        const receiverToken = tokenResult.rows[0]?.token;

        if (receiverToken) {
          console.log(
            "Receiver Token:",
            receiverToken
          );

          const response = await admin.messaging().send({
            token: receiverToken,
            notification: {
              title: "New Message",
              body: message || "Sent an attachment",
            },
          });

          console.log(
            "FCM SUCCESS:",
            response
          );
        } else {
          console.log(
            "No FCM token found for user:",
            receiver_id
          );
        }
      } catch (err) {
        console.log(
          "FCM ERROR:",
          err
        );
      }

      // ======================
      // REPLY MESSAGE
      // ======================

      if (newMessage.reply_to) {
        const replyMessage = await db.query(
          `
          SELECT *
          FROM messages
          WHERE id = $1
          `,
          [newMessage.reply_to]
        );

        newMessage.reply_message = replyMessage.rows[0];
      }

      // ======================
      // SEND TO RECEIVER
      // ======================

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receive_message", newMessage);
      }

      // ======================
      // SEND TO SENDER
      // ======================

      socket.emit("receive_message", newMessage);
    } catch (error) {
      console.log("SEND MESSAGE ERROR:", error);
    }
  });

  // ======================
  // MESSAGE RECEIVED
  // ======================

  socket.on("message_received", async ({ message_id }) => {
    try {
      await db.query(
        `
        UPDATE messages
        SET is_delivered = true
        WHERE id = $1
        `,
        [message_id]
      );

      const messageResult = await db.query(
        `
        SELECT *
        FROM messages
        WHERE id = $1
        `,
        [message_id]
      );

      const message = messageResult.rows[0];
      if (!message) return;

      const senderSocketId = onlineUsers[message.sender_id.toString()];

      if (senderSocketId) {
        io.to(senderSocketId).emit("message_delivered", {
          message_id,
        });
      }
    } catch (error) {
      console.log("MESSAGE RECEIVED ERROR:", error);
    }
  });

  // ======================
  // TYPING
  // ======================

  socket.on("typing", (data) => {
    const receiverSocketId = onlineUsers[data.receiver_id.toString()];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", data);
    }
  });

  // ======================
  // STOP TYPING
  // ======================

  socket.on("stop_typing", (data) => {
    const receiverSocketId = onlineUsers[data.receiver_id.toString()];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stop_typing", data);
    }
  });

  // ======================
  // MARK READ
  // ======================

  socket.on("mark_read", async (data) => {
    try {
      const { sender_id, receiver_id } = data;

      // UPDATE DATABASE
      await db.query(
        `
        UPDATE messages
        SET is_read = true
        WHERE sender_id = $1
        AND receiver_id = $2
        `,
        [sender_id, receiver_id]
      );

      // GET ALL SEEN MESSAGES
      const seenMessages = await db.query(
        `
        SELECT id
        FROM messages
        WHERE sender_id = $1
        AND receiver_id = $2
        `,
        [sender_id, receiver_id]
      );

      const senderSocketId = onlineUsers[sender_id.toString()];

      // SEND BLUE TICKS INSTANTLY
      if (senderSocketId) {
        seenMessages.rows.forEach((msg) => {
          io.to(senderSocketId).emit("message_seen", {
            message_id: msg.id,
          });
        });

        io.to(senderSocketId).emit("messages_seen", {
          sender_id,
          receiver_id,
        });
      }
    } catch (error) {
      console.log("MARK READ ERROR:", error);
    }
  });

  // ======================
  // DELETE MESSAGE
  // ======================

  socket.on("delete_message", async ({ message_id, receiver_id, sender_id }) => {
    try {
      const messageResult = await db.query(
        `
        SELECT *
        FROM messages
        WHERE id = $1
        `,
        [message_id]
      );

      const message = messageResult.rows[0];
      if (!message) return;

      await db.query(
        `
        DELETE FROM messages
        WHERE id = $1
        `,
        [message_id]
      );

      const shouldDecreaseUnread = !message.is_read;

      socket.emit("message_deleted", {
        message_id,
        sender_id,
        receiver_id,
        decrease_unread: shouldDecreaseUnread,
      });

      const receiverSocketId = onlineUsers[receiver_id.toString()];

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("message_deleted", {
          message_id,
          sender_id,
          receiver_id,
          decrease_unread: shouldDecreaseUnread,
        });
      }
    } catch (error) {
      console.log("DELETE ERROR:", error);
    }
  });

  // ======================
  // LOGOUT
  // ======================

  socket.on("logout", (userId) => {
    userId = userId.toString();
    lastSeenUsers[userId] = new Date();
    delete onlineUsers[userId];

    emitOnlineUsers();

    io.emit("last_seen_update", {
      userId,
      lastSeen: lastSeenUsers[userId],
    });
  });

  // ======================
  // DISCONNECT
  // ======================

  socket.on("disconnect", () => {
    console.log("User Disconnected:", socket.id);
    removeUser(socket.id);
  });
});

// ======================
// TEST ROUTE
// ======================

app.get("/", (req, res) => {
  res.send("Server is running...");
});

// ======================
// START SERVER
// ======================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
