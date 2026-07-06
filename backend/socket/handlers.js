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


    // ── JOIN ROOMS ───────────────────────────────────────────────────────────
    // join all existing conversations on connect
    // so socket.io can route messages to this user via room broadcasts
    const userConversations = await Conversation.find({ members: userId });
    userConversations.forEach((conv) => {
      socket.join(conv._id.toString());
      console.log(`${userId} joined room: ${conv._id}`);
    });

    // ── PENDING MESSAGES ─────────────────────────────────────────────────────
    // fetch messages not yet delivered — now using conversationId
    const pendingMessages = await Message.find({
      conversationId: { $in: userConversations.map((c) => c._id) },
      sender: { $ne: userId },                    // not sent by this user
      deliveredTo: { $nin: [userId] },            // not yet delivered to this user
    });
 
    for (const msg of pendingMessages) {
      socket.emit("message:receive", {
        id: msg._id,
        from: msg.sender,
        message: msg.message,
        sentAt: msg.sentAt,
        conversationId: msg.conversationId,
      });
    }

  // ── DELIVERY ACKNOWLEDGEMENT ──────────────────────────────────────────────
    socket.on("message:ack", async ({ id }) => {
      const msg = await Message.findOneAndUpdate(
        { _id: id, deliveredTo: { $ne: userId } },
        {
          $addToSet: { deliveredTo: userId },
        },
        { new: true }
      );
 
      // notify sender if online — still uses users{} for direct notification
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
           
           const roomId = conversation._id.toString();

           // STEP 2 — join room if newly created
        // both sender and receiver need to be in the room
        socket.join(roomId);
        if (users[receiver]) {
          users[receiver].join(roomId);
        }
          // DUAL-WRITE STEP 3 — save Message with BOTH old and new fields

          
          const newMsg = await Message.create({

             

            sender: userId,

            // conversationId is now the source of truth for routing —
            // receiver stays a function param (used above to find/create
            // the conversation and join rooms) but is no longer stored
  
            conversationId: conversation._id,
            deliveredTo: [],
            seenBy: [],

            // unchanged fields
            message: msgText,
            
            sentAt: sentAt || new Date(), // fallback to server time if missing
          });

          console.log("Saved:", newMsg);

          // DUAL-WRITE STEP 4 — update Conversation's last message
          await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessage: msgText,
            lastMessageSender: userId,
            lastMessageAt: newMsg.sentAt,
          });
 
          console.log("Saved:", newMsg._id, "conversationId:", newMsg.conversationId);

          // STEP 5 — broadcast to room (replaces manual users[receiver].emit)
        // io.to(roomId) delivers to ALL members of the room except sender
        // for direct chat: just the receiver
        // for group chat (future): all members automatically
        socket.to(roomId).emit("message:receive", {
          id: newMsg._id,
          from: userId,
          message: msgText,
          sentAt: newMsg.sentAt,
          conversationId: newMsg.conversationId,
        });
            

         // confirm to sender
        socket.emit("message:sent", {
          id: newMsg._id,
          message: msgText,
          conversationId: newMsg.conversationId,
          sentAt: newMsg.sentAt,
        });
            

        } catch (err) {

          console.error("DB SAVE ERROR:",err);   
        }
      });

// ── SEEN HANDLER ──────────────────────────────────────────────────────────
    // from = username of the person whose messages we are marking as seen
    socket.on("message:seen", async ({ from, conversationId }) => {
      try {
        const seenAt = new Date();
 
        // update by conversationId + sender — handles both direct and group
        await Message.updateMany(
          {
            conversationId,
            sender: from,
            "seenBy.username": { $ne: userId }, // not already seen by this user
          },
          {
             // per-person seen timestamp
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
            conversationId,
          });
        }

        console.log(`${userId} saw messages from ${from} in ${conversationId}`);

      } catch (err) {
        console.error("SEEN ERROR:", err);
      }
    });

    // ── TYPING INDICATORS ─────────────────────────────────────────────────────
    // still use users{} — typing is per-user not per-room
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


    // ── CONTACT REQUESTS 

    // ✅ notify user when request received
    socket.on("request:send", ({ to }) => {
      if (users[to]) {
        users[to].emit("request:received", {
          from: userId,
        });
      }
    });

    // ✅ notify user when request accepted
    socket.on("request:accept", async ({ to }) => {
  if (users[to]) {
    // fetch the conversation that was just created
    const members = [userId, to].sort();
    const conversation = await Conversation.findOne({ type: "direct", members });

     // add both users to the conversation room
    // so they can receive messages immediately without reconnecting
    if (conversation) {
      const roomId = conversation._id.toString();
      socket.join(roomId);           // acceptor joins
      users[to].join(roomId);        // requester joins
    }

    users[to].emit("request:accepted", {
      by: userId,
      conversation: conversation ? {
        conversationId: conversation._id,
        type: conversation.type,
        name: userId,  // from receiver's perspective — the person who accepted
        members: conversation.members,
        lastMessage: "",
        time: conversation.createdAt,
      } : null,
    });
  }
});

  

// ── DISCONNECT ────────────────────────────────────────────────────────────

    socket.on("disconnect", (reason) => {

  // remove from users map immediately
  // so new connections aren't blocked by stale socket
  delete users[userId];

  // Socket.IO automatically removes the socket from all rooms on disconnect
      // no manual room cleanup needed

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