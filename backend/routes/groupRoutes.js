const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Conversation = require("../models/Conversation");
const User = require("../models/User");

// CREATE GROUP
// body: { name: string, members: [username, ...] }  — members = other people, not including self
router.post("/create", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;
  const { name, members } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Group name is required" });
  }

  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).json({ error: "Select at least one member" });
  }

  try {
    // de-dupe + always include creator
    const allMembers = Array.from(new Set([currentUser, ...members]));

    // validate every invited member actually exists — mirrors the
    // existence check contactRoutes.js does before acting on a username
    const existingUsers = await User.find({
      username: { $in: allMembers },
    }).select("username");

    if (existingUsers.length !== allMembers.length) {
      const foundUsernames = existingUsers.map((u) => u.username);
      const missing = allMembers.filter((u) => !foundUsernames.includes(u));
      return res.status(400).json({
        error: `User(s) not found: ${missing.join(", ")}`,
      });
    }

    const conversation = await Conversation.create({
      type: "group",
      members: allMembers,
      name: name.trim(),
      admins: [currentUser],
      memberHistory: allMembers.map((username) => ({
        username,
        action: "joined",
        by: currentUser,
      })),
    });

    const conversationPayload = {
      conversationId: conversation._id,
      type: conversation.type,
      name: conversation.name,
      members: conversation.members,
      lastMessage: "",
      time: conversation.createdAt,
    };
 
    // ── NOTIFY INVITED MEMBERS IN REAL TIME ────────────────────────────────
    // this route has no direct socket reference, so it reaches sockets via
    // the personal room every socket joins on connect (see handlers.js)
    const io = req.app.get("io");
    const roomId = conversation._id.toString();
 
    if (io) {
      const invitedMembers = allMembers.filter((u) => u !== currentUser);
 
      for (const username of invitedMembers) {
        
        // join any of their active sockets (e.g. multiple tabs) to the
        // new group room, so future message:send broadcasts reach them
        io.in(username).socketsJoin(roomId);
 
        // tell their client(s) a new group exists, so it can be added
        // to the conversation list immediately without a refresh
        io.to(username).emit("group:created", {
          conversation: conversationPayload,
        });
      }
    }

    res.json({
      message: "Group created",
      conversation: conversationPayload,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create group" });
  }
});

module.exports = router;