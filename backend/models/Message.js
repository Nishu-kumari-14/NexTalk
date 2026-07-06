

const mongoose = require("mongoose");

const msgSchema = new mongoose.Schema(
  {


    // ── OLD FIELDS — kept during migration, removed in cleanup phase ──────
    // These stay until all application code has switched to conversationId4

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

    

    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
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

    // ── UNCHANGED FIELDS ──


     // extended enum — "system" added for "Tiger added Simran to the group" etc.
    type: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },

    message: {
      type: String,
      required: true,
      trim: true,
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
  },

  {
    timestamps: true,
  }
);

// index for fast conversation history fetch
msgSchema.index({ conversationId: 1, sentAt: 1 });

// index for unread count aggregate query
msgSchema.index({ sender: 1, "seenBy.username": 1 });

// old index kept during migration — still needed by old code paths
msgSchema.index({ sender: 1, receiver: 1, sentAt: 1 });


module.exports = mongoose.model("Message", msgSchema);


