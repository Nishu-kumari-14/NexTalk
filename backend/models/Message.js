

const mongoose = require("mongoose");

const msgSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      required: true,
      trim: true,
    },

    receiver: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },

    type: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },

    edited: {
      type: Boolean,
      default: false,
    },

    deleted: {
      type: Boolean,
      default: false,
    },
     sentAt: {
      type: Date,
      required: true,
    },


    // ── NEW FIELDS — added in Phase 1, backfilled by migration script ─────
 
    // replaces sender/receiver pair as the conversation identifier
    // nullable during migration — backfilled by script, written by dual-write
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,  // null until migration script or dual-write sets it
    },
 
    // replaces single status string — supports multi-receiver (groups)
    // for direct chats: array of length 0 or 1
    // for groups: array of length 0 to N
    deliveredTo: {
      type: [String],
      default: [],
    },
 
    // seenBy with timestamps — lets us show "seen at 2:34 PM" per person
    seenBy: {
      type: [
        {
          username: { type: String, required: true },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },



  },
  {
    timestamps: true,
  }
);


module.exports = mongoose.model("Message", msgSchema);


