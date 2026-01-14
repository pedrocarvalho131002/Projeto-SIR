const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const path = require("path");

const authRoutes = require("./routes/auth.routes");
const eventRoutes = require("./routes/events.routes");
const rsvpRoutes = require("./routes/rsvp.routes");

const app = express();
const server = http.createServer(app);

// SOCKET
const { Server } = require("socket.io");
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map(s => s.trim());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true
  },
});

// tornar socket acessível nos controllers
app.set("io", io);

// middlewares
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// routes
// routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/rsvps", rsvpRoutes);
app.use("/api/users", require('./routes/users.routes'));
app.use("/api/comments", require('./routes/comments.routes'));
app.use("/api/notifications", require('./routes/notifications.routes'));

// mongo
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(console.error);

// socket logic
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-event", (eventId) => {
    socket.join(eventId);
  });

  socket.on("join-user", (userId) => {
    socket.join(userId);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// server
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () =>
  console.log("Server running on port", PORT)
);
