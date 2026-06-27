const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// SEARCH USER
router.get("/search", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: "Username required" });
  }

  try {
    const user = await User.findOne({
        $and: [
    { username: username },
    { username: { $ne: currentUser } }
  ]
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // check relationship status
    const me = await User.findOne({ username: currentUser });
    if (!me) {
     return res.status(404).json({ error: "Current user not found" });
  }

    let status = "none";

    if (me.contacts.includes(username)) {
      status = "contact";
    } else if (user.pendingRequests.includes(currentUser)) {
      status = "pending";  // i already sent request
    } else if (me.pendingRequests.includes(username)) {
      status = "incoming"; // they sent me request
    }

    res.json({ username: user.username, status });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

// SEND CONTACT REQUEST
router.post("/request/:username", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;
  const { username } = req.params;

  if (currentUser === username) {
    return res.status(400).json({ error: "Cannot add yourself" });
  }

  try {
    const targetUser = await User.findOne({ username });

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // already a contact
    if (targetUser.contacts.includes(currentUser)) {
      return res.status(400).json({ error: "Already a contact" });
    }

    // already sent request
    if (targetUser.pendingRequests.includes(currentUser)) {
      return res.status(400).json({ error: "Request already sent" });
    }

    // add to their pendingRequests
    await User.updateOne(
      { username },
      { $push: { pendingRequests: currentUser } }
    );

    res.json({ message: "Request sent" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send request" });
  }
});

// ACCEPT REQUEST
router.post("/accept/:username", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;
  const { username } = req.params;

  try {
    const me = await User.findOne({ username: currentUser });

    // check request exists
    if (!me.pendingRequests.includes(username)) {
      return res.status(400).json({ error: "No request from this user" });
    }

    // add to contacts on both sides
    await User.updateOne(
      { username: currentUser },
      {
        $push: { contacts: username },
        $pull: { pendingRequests: username }, // remove from pending
      }
    );

    await User.updateOne(
      { username },
      { $push: { contacts: currentUser } }
    );

    res.json({ message: "Request accepted" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to accept request" });
  }
});

// REJECT REQUEST
router.delete("/reject/:username", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;
  const { username } = req.params;

  try {
    await User.updateOne(
      { username: currentUser },
      { $pull: { pendingRequests: username } }
    );

    res.json({ message: "Request rejected" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject request" });
  }
});

// GET PENDING REQUESTS
router.get("/pending", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;

  try {
    const user = await User.findOne({ username: currentUser });
    res.json({ pending: user.pendingRequests });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pending requests" });
  }
});

// GET CONTACTS
router.get("/", authMiddleware, async (req, res) => {
  const currentUser = req.user.username;

  try {
    const user = await User.findOne({ username: currentUser });
    res.json({ contacts: user.contacts });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

module.exports = router;