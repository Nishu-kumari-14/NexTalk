const Message = require("../models/Message.js");

const verifyToken = require("../utils/verifyToken");

module.exports = function setupSocketHandlers(io) {

  // username -> socket
  const users = {};

  io.on("connection", async (socket) => {

    
   const userId = socket.user.username;

    console.log(`User connected: ${userId}`);

    // Save socket
    users[userId] = socket;


    // ✅ tell everyone this user is online
    socket.broadcast.emit("user:online", { username: userId });

    // ✅ tell this user who is already online
    const onlineUsers = Object.keys(users);
    socket.emit("online:list", { users: onlineUsers });

    // Fetch pending messages
    const pendingMessages = await Message.find({
      receiver: userId,
      status: "sent",
    });

    // Send pending messages
    for (const msg of pendingMessages) {

      socket.emit("message:receive", {
        id: msg._id,
        from: msg.sender,
        message: msg.message,
        sentAt: msg.sentAt,
      });

    }

    // Delivery acknowledgement
   // ✅ only updates if still "sent"
socket.on("message:ack", async ({ id }) => {
  const msg = await Message.findOneAndUpdate(
    { _id: id, status: "sent" },
    { status: "delivered" },
    { new: true }
  );

  if (msg && users[msg.sender]) {
    users[msg.sender].emit("message:delivered", {
      id: msg._id,
      by: userId,
    });
  }
});

    // Send message
    socket.on(
      "message:send",
      async ({ receiver, message: msgText,sentAt }) => {

        console.log(`${userId} → ${receiver}: ${msgText}`);
        

        try {

          // Save to DB
          const newMsg = await Message.create({
            sender: userId,
            receiver,
            message: msgText,
            status: "sent",
            sentAt: sentAt || new Date(), // fallback to server time if missing
          });

          console.log("Saved:", newMsg);

          // Receiver online
          if (users[receiver]) {

            users[receiver].emit(
              "message:receive",
              {
                id: newMsg._id,
                from: userId,
                message: msgText,
                sentAt: newMsg.sentAt,
              });
            }
            

          // ✅ tell sender the message was saved with its id
        socket.emit("message:sent", {
          id: newMsg._id,
          message: msgText,
          receiver,
          status: "sent",
          sentAt: newMsg.sentAt,
        });
            

        } catch (err) {

          console.error("DB SAVE ERROR:",err);   
        }
      });


      // ✅ seen handler — receiver opened the chat
    socket.on("message:seen", async ({ from }) => {
      try {

        // update all unseen messages from this sender to "seen"
        await Message.updateMany(
          {
            sender: from,
            receiver: userId,
            status: { $in: ["sent", "delivered"] },
          },
          { status: "seen" }
        );

        // notify sender if online
        if (users[from]) {
          users[from].emit("message:seen", {
            by: userId,   // who saw it
            from,         // the sender
          });
        }

        console.log(`${userId} saw messages from ${from}`);

      } catch (err) {
        console.error("SEEN ERROR:", err);
      }
    });

    // typing indicators — only forward to the target user
    socket.on("typing:start", ({ to }) => {
      if (users[to]) {
        users[to].emit("typing:start", { from: userId });
      }
    });

    socket.on("typing:stop", ({ to }) => {
      if (users[to]) {
        users[to].emit("typing:stop", { from: userId });
      }
    });


    // ✅ notify user when request received
    socket.on("request:send", ({ to }) => {
      if (users[to]) {
        users[to].emit("request:received", {
          from: userId,
        });
      }
    });

    // ✅ notify user when request accepted
    socket.on("request:accept", ({ to }) => {
      if (users[to]) {
        users[to].emit("request:accepted", {
          by: userId,
        });
      }
    });

  



    socket.on("disconnect", (reason) => {

  // remove from users map immediately
  // so new connections aren't blocked by stale socket
  delete users[userId];

  // wait 5s before declaring offline
  setTimeout(() => {

    // check if user reconnected with a NEW socket
    // if they did, users[userId] will exist again (set by new connection)
    if (users[userId]) return; // ← they reconnected, do nothing

    // still gone after 5s — genuinely offline
    console.log(`User disconnected: ${userId}`, "Reason:", reason);
    io.emit("user:offline", { username: userId });

  }, 5000);

});

});

};