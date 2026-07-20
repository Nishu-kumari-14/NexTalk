require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const main = require('./config/connection.js')
const messageRoutes = require("./routes/messageRoutes.js");
const contactRoutes = require("./routes/contactRoutes");
const authRoutes = require("./routes/authRoutes.js");
const socketAuth = require("./middleware/socketAuth");
const groupRoutes = require("./routes/groupRoutes.js");
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";




const PORT = process.env.PORT || 8080;

const app = express();
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());

//connecting to database
main()
  .then(() => console.log("Database connected"))
  .catch((err) => console.log("Error occurred", err));


const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
  },
});


// expose io to REST routes (e.g. groupRoutes.js) so they can notify/join
// sockets without needing direct access to handlers.js's internal state
app.set("io", io);

app.use("/auth", authRoutes);
app.use("/contacts", contactRoutes);
app.use("/messages", messageRoutes);
app.use("/groups", groupRoutes);




// start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const setupSockets = require("./socket/index.js");

io.use(socketAuth);
setupSockets(io);


