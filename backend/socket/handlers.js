const Message = require("../models/Message.js");

const Conversation = require("../models/Conversation.js");

const verifyToken = require("../utils/verifyToken");


// ── HELPER — find or create a direct conversation ────────────────────────────
// members sorted alphabetically to prevent duplicate conversations
// e.g. ["simran", "tiger"] always, never ["tiger", "simran"]
async function findOrCreateDirectConversation(userA, userB) {
  const members = [userA, userB].sort();
 
  let conversation = await Conversation.findOne({
    type: "direct",
    members: members,
  });
 
  if (!conversation) {
    conversation = await Conversation.create({
      type: "direct",
      members: members,
      memberHistory: [
        { username: userA, action: "joined", by: userA },
        { username: userB, action: "joined", by: userA },
      ],
    });
    console.log(`Created new conversation for [${members}]:`, conversation._id);
  }
 
  return conversation;
}
 

module.exports = function setupSocketHandlers(io) {

  // username -> socket-  kept for presence tracking (NOT for message routing)
  const users = {};

  io.on("connection", async (socket) => {

    
   const userId = socket.user.username;

    console.log(`User connected: ${userId}`);

    // Save socket for presence
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
  
socket.on("message:ack", async ({ id }) => {
  const msg = await Message.findOneAndUpdate(
    { _id: id, status: "sent" },
    { 
      status: "delivered" ,
      $addToSet: { deliveredTo: userId },
    },
    // DUAL-WRITE: also update new deliveredTo array
    
    { new: true }
  );

  if (msg && users[msg.sender]) {
    users[msg.sender].emit("message:delivered", {
      id: msg._id,
      by: userId,
    });
  }
});

    // ── Send message — DUAL-WRITE ─
    socket.on(
      "message:send",
      async ({ receiver, message: msgText,sentAt }) => {

        console.log(`${userId} → ${receiver}: ${msgText}`);
        

        try {

          // DUAL-WRITE STEP 1 — find or create Conversation
          const conversation = await findOrCreateDirectConversation(userId, receiver);

          // DUAL-WRITE STEP 2 — save Message with BOTH old and new fields

          
          const newMsg = await Message.create({

             // OLD fields — kept so old code paths still work

            sender: userId,
            receiver,
            status: "sent",

            // NEW fields — written by dual-write
            conversationId: conversation._id,
            deliveredTo: [],
            seenBy: [],

            // unchanged fields
            message: msgText,
            
            sentAt: sentAt || new Date(), // fallback to server time if missing
          });

          console.log("Saved:", newMsg);

          // DUAL-WRITE STEP 3 — update Conversation's last message
          await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessage: msgText,
            lastMessageSender: userId,
            lastMessageAt: newMsg.sentAt,
          });
 
          console.log("Saved:", newMsg._id, "conversationId:", newMsg.conversationId);

          // deliver to receiver if online
          if (users[receiver]) {

            users[receiver].emit("message:receive",
              {
                id: newMsg._id,
                from: userId,
                message: msgText,
                sentAt: newMsg.sentAt,
              });
            }
            

         // confirm to sender
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


      // seen handler — DUAL-WRITE
    socket.on("message:seen", async ({ from }) => {
      try {

        const seenAt = new Date();

       
        // update all unseen messages from this sender to seen — BOTH old and new fields
        await Message.updateMany(
          {
            sender: from,
            receiver: userId,
            status: { $in: ["sent", "delivered"] },
          },

          {

                // OLD field
               status: "seen",

               // NEW field — add to seenBy array with timestamp
                $addToSet: {
                      seenBy: { username: userId, at: seenAt },
                },

          }  

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