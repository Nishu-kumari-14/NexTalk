const express = require("express");

const router = express.Router();
const mongoose = require("mongoose");

const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

const authMiddleware = require("../middleware/authMiddleware");




// GET /messages/conversations

router.get("/conversations", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;

  try {

    
    const conversations = await Conversation.find({
      members: currentUser,
    }).sort({ lastMessageAt: -1 }); // latest first
     
      const shaped = conversations.map((conv) => {
      const displayName =
        conv.type === "direct"
          ? conv.members.find((m) => m !== currentUser)
          : conv.name;
 
      return {
        conversationId: conv._id,
        type: conv.type,
        name: displayName,
        members: conv.members,
        lastMessage: conv.lastMessage,
        lastMessageSender: conv.lastMessageSender,
        time: conv.lastMessageAt,
        avatar: conv.avatar,
      };
    });
 
    res.json({ conversations: shaped });
    

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// GET /messages/unread
// uses aggregate — MongoDB counts in DB, nothing loaded into Node memory
router.get("/unread", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;
 
  try {
    const unread = await Message.aggregate([
      {
        $match: {
          conversationId: { $ne: null },
          sender: { $ne: currentUser },
          "seenBy.username": { $ne: currentUser },
        },
      },
      {
        $group: {
          _id: "$conversationId",
          count: { $sum: 1 },
        },
      },
    ]);
 
    // shape into { conversationId: count }
    const result = {};
    unread.forEach(({ _id, count }) => {
      result[_id.toString()] = count;
    });
 
    res.json({ unread: result });
 
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch unread counts" });
  }
});


// ── GET /messages/:conversationId ─────────────────────────────────────────────
// cursor-based pagination — ?limit=50&before=<sentAt timestamp>
router.get("/:conversationId", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;
  const { conversationId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before;
 
  // validate conversationId shape before hitting DB
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return res.status(400).json({ error: "Invalid conversationId" });
  }
 
  try {
    // verify currentUser is a member
    const conversation = await Conversation.findOne({
      _id: conversationId,
      members: currentUser,
    });
 
    if (!conversation) {
      return res.status(403).json({ error: "Not a member of this conversation" });
    }
 
    const query = { conversationId };
    if (before) {
      query.sentAt = { $lt: new Date(before) };
    }
 
    // fetch limit + 1 — the extra one tells us if more exist without extra query
    const messages = await Message.find(query)
      .sort({ sentAt: -1 })
      .limit(limit + 1)
      .lean();
 
    const hasMore = messages.length > limit;
    if (hasMore) messages.pop(); // remove the extra sentinel message
 
    // reverse to chronological order for frontend
    messages.reverse();
 
    res.json({
      messages,
      hasMore,
      nextCursor: messages.length > 0 ? messages[0].sentAt : null,
    });
 
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});







module.exports = router;