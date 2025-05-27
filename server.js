import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));

app.use(express.static(join(__dirname, "public")));
// In-memory storage for connected users and their socket IDs
const connectedUsers = {}; // userId: socketId

// --- Socket.IO Logic ---
io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId; // Get userId from query parameters

  if (userId) {
    console.log(`User connected: ${userId} (Socket ID: ${socket.id})`);
    connectedUsers[userId] = { socketId: socket.id, latestLocation: null }; // Initialize user data

    // Notify all other connected clients about the new user online
    socket.broadcast.emit("userOnline", userId);

    // Listen for location updates from this client
    socket.on("locationUpdate", (data) => {
      const { latitude, longitude, timestamp } = data;
      console.log(`Received location update from ${userId}:`, data);

      if (connectedUsers[userId]) {
        connectedUsers[userId].latestLocation = {
          latitude,
          longitude,
          timestamp,
        };
        // Broadcast the location update to all other connected clients
        socket.broadcast.emit("userLocationUpdated", {
          userId,
          latitude,
          longitude,
          timestamp,
        });
      }
    });

    // Handle client disconnection
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userId} (Socket ID: ${socket.id})`);
      delete connectedUsers[userId]; // Remove user from the connected list
      // Notify all other connected clients about the user offline
      io.emit("userOffline", userId);
    });
  } else {
    console.log(
      "Anonymous client connected without userId, disconnecting:",
      socket.id
    );
    socket.disconnect(true); // Disconnect if no userId is provided
  }
});

// --- Express Routes ---
app.get("/", (req, res) => {
  res.render("index", { title: "Real-Time Location Tracker" });
});

// --- Start Server ---
const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log("Open multiple browser tabs to simulate different users.");
});
