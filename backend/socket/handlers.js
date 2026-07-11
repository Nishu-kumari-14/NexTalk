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

    // personal room — lets any part of the app (including REST routes,
    // via io.to(username) / io.in(username).socketsJoin(...)) reach this
    // user's socket(s) without needing access to the users{} map
    socket.join(userId);


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

   // ── Send message ──────────────────────────────────────────────────────
    // routes by conversationId — works identically for direct and group,
    // since both are already created before anyone can send into them
    // (direct: at contact-accept, group: at group-creation)
    socket.on(
      "message:send",
      async ({  conversationId, message: msgText,sentAt }) => {

        console.log(`${userId} → conversation ${conversationId}: ${msgText}`);
        

        try {

          
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            console.error("message:send — conversation not found:", conversationId);
            return;
          }

          // security check — only members can send into this conversation
          if (!conversation.members.includes(userId)) {
            console.error(`message:send — ${userId} is not a member of ${conversationId}`);
            return;
          }
           
           const roomId = conversation._id.toString();

          // safety net — ensures the sender's current socket is in the
          // room even if it somehow missed the on-connect join

        socket.join(roomId);
          
          const newMsg = await Message.create({
            sender: userId,
            conversationId: conversation._id,
            deliveredTo: [],
            seenBy: [],
            message: msgText,
            sentAt: sentAt || new Date(), // fallback to server time if missing
          });

          console.log("Saved:", newMsg);

         
          await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessage: msgText,
            lastMessageSender: userId,
            lastMessageAt: newMsg.sentAt,
          });
 
          console.log("Saved:", newMsg._id, "conversationId:", newMsg.conversationId);
          // broadcast to room — reaches all OTHER members
          // direct: just the other person, group: everyone else
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
   // finds exactly which messages this user hasn't seen yet in this
// conversation, marks them, and tells each affected sender precisely
// WHICH of their messages were just seen ...
    socket.on("message:seen", async ({ conversationId }) => {
      try {
        const seenAt = new Date();

        const toMarkSeen = await Message.find({
          conversationId,
          sender: { $ne: userId },
          "seenBy.username": { $ne: userId },
        }).select("_id sender").lean();
 
        if (toMarkSeen.length > 0) {
          const idsToUpdate = toMarkSeen.map((m) => m._id);
 
 
       
        await Message.updateMany(
           { _id: { $in: idsToUpdate } },
          {
      
            $addToSet: {
              seenBy: { username: userId, at: seenAt },
            },
          }
        );
        

        // group affected message ids by sender — a group chat can have
          // messages from several different senders in one batch
          const bySender = {};
          toMarkSeen.forEach((m) => {
            const s = m.sender;
            if (!bySender[s]) bySender[s] = [];
            bySender[s].push(m._id.toString());
          });
 
          Object.entries(bySender).forEach(([senderUsername, messageIds]) => {
            if (users[senderUsername]) {
              users[senderUsername].emit("message:seen", {
                by: userId,
                conversationId,
                messageIds,
              });
            }
          });
 
          console.log(`${userId} saw ${idsToUpdate.length} message(s) in ${conversationId}`);
        }

      } catch (err) {
        console.error("SEEN ERROR:", err);
      }
    });

   // ── TYPING INDICATORS ─────────────────────────────────────────────────────
    // broadcast to the conversation's room — works for direct (reaches the
    // 1 other person) and group (reaches all other members) the same way
     socket.on("typing:start", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit("typing:start", { from: userId, conversationId });
    });
 
    socket.on("typing:stop", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit("typing:stop", { from: userId, conversationId });
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