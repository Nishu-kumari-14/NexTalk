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




const PORT = process.env.PORT || 8080;

const app = express();
app.use(cors());
app.use(express.json());

//connecting to database
main()
  .then(() => console.log("Database connected"))
  .catch((err) => console.log("Error occurred", err));


const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "*",
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
  console.log("Server running on port 8080");
});

const setupSockets = require("./socket/index.js");

io.use(socketAuth);
setupSockets(io);


