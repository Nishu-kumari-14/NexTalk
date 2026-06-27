const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
    },

    // current active members — usernames
    // for direct chats: always stored sorted alphabetically to prevent duplicates
    // e.g. ["simran", "tiger"] never ["tiger", "simran"]
    members: {
      type: [String],
      required: true,
    },

    // full history of membership changes
    // separate from members[] — members[] is current state, this is audit trail
    memberHistory: [
      {
        username: { type: String, required: true },
        action: {
          type: String,
          enum: ["joined", "left", "removed"],
          required: true,
        },
        by: { type: String, default: null }, // who performed the action
        at: { type: Date, default: Date.now },
      },
    ],

    // null for direct chats, required for groups
    name: {
      type: String,
      default: null,
    },

    // group avatar image URL, null for direct chats
    avatar: {
      type: String,
      default: null,
    },

    // multiple admins supported — empty array for direct chats
    admins: {
      type: [String],
      default: [],
    },

    // denormalized last message — avoids extra query on conversation list load
    lastMessage: {
      type: String,
      default: "",
    },

    // who sent the last message — needed for group previews ("Tiger: hey all")
    lastMessageSender: {
      type: String,
      default: "",
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// index for fast direct conversation lookup by sorted members pair
ConversationSchema.index({ members: 1, type: 1 });

module.exports = mongoose.model("Conversation", ConversationSchema);