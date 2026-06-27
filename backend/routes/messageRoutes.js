const express = require("express");

const router = express.Router();

const Message = require("../models/Message");

const authMiddleware = require(
   "../middleware/authMiddleware"
);




// GET /messages/conversations
// returns all users currentUser has chatted with
router.get("/conversations", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;

  try {

    // find all messages where currentUser is involved
    const messages = await Message.find({
      $or: [
        { sender: currentUser },
        { receiver: currentUser },
      ],
    }).sort({ createdAt: -1 }); // latest first

    // build conversation list
    const conversationMap = {};

    messages.forEach((msg) => {
      const otherUser = msg.sender === currentUser
        ? msg.receiver
        : msg.sender;

      // only keep the latest message per user
      if (!conversationMap[otherUser]) {
        conversationMap[otherUser] = {
          username: otherUser,
          lastMessage: msg.message,
          time: msg.sentAt,
          status: msg.status,
        };
      }
    });

    const conversations = Object.values(conversationMap);

    res.json({ conversations });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// GET /messages/unread
// returns unread counts per sender { unread: { alice: 3, bob: 1 } }
router.get("/unread", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;

  try {
    const messages = await Message.find({
      receiver: currentUser,
      status: { $in: ["sent", "delivered"] },
    });

    const unread = {};
    messages.forEach((msg) => {
      unread[msg.sender] = (unread[msg.sender] || 0) + 1;
    });

    res.json({ unread });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch unread counts" });
  }
});

// GET CHAT HISTORY
router.get("/:selectedUser",authMiddleware,async (req, res) => {

      // TRUSTED USER FROM JWT
      const currentUser = req.user.username;

      // OTHER USER FROM URL
      const selectedUser =
         req.params.selectedUser;

      try {

         const messages = await Message.find({
            $or: [
               {
                  sender: currentUser,
                  receiver: selectedUser,
               },
               {
                  sender: selectedUser,
                  receiver: currentUser,
               },
            ],
         }).sort({ createdAt: 1 });

         res.json(messages);

      } catch (err) {

         console.log(err);

         res.status(500).json({
            error: "Failed to fetch messages",
         });

      }
   }
);



module.exports = router;