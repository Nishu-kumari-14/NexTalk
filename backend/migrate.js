/**
 * MIGRATION SCRIPT — Phase 3
 * Converts existing 1-to-1 messages to the new Conversation model
 *
 * SAFE TO RE-RUN — idempotent:
 * - Skips messages that already have conversationId set
 * - Skips conversations that already exist for a pair
 * - Can be run multiple times until null count = 0
 *
 * RUN: node migrate.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Message = require("./models/Message");
const Conversation = require("./models/Conversation");

const MONGO_URI = process.env.MONGO_URI;

async function migrate() {
  console.log("═══════════════════════════════════════");
  console.log("  NexTalk Migration — Phase 3");
  console.log("  1-to-1 Messages → Conversation Model");
  console.log("═══════════════════════════════════════\n");

  // ── CONNECT ───────────────────────────────────────────────────────────────
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  // ── STEP A — find all messages that need migration ────────────────────────
  // only process messages that DON'T have conversationId yet
  const unmigrated = await Message.find({ conversationId: null });
  console.log(`📊 Messages to migrate: ${unmigrated.length}`);

  if (unmigrated.length === 0) {
    console.log("✅ All messages already migrated — nothing to do\n");
    await printVerification();
    await mongoose.disconnect();
    return;
  }

  // ── STEP B — build unique sender/receiver pairs ───────────────────────────
  // use a map to track: "simran|tiger" → conversationId
  // sorted key prevents "tiger|simran" and "simran|tiger" being treated as different pairs
  const pairToConversationId = {};

  // first — load any conversations already created (by dual-write)
  // so we don't create duplicates
  const existingConversations = await Conversation.find({ type: "direct" });
  console.log(`📊 Existing conversations: ${existingConversations.length}`);

  existingConversations.forEach((conv) => {
    const key = conv.members.slice().sort().join("|");
    pairToConversationId[key] = conv._id;
  });

  console.log(`\n📋 Building conversation map from unmigrated messages...`);

  // ── STEP C — create missing conversations ────────────────────────────────
  let conversationsCreated = 0;

  for (const msg of unmigrated) {
    const members = [msg.sender, msg.receiver].sort();
    const key = members.join("|");

    // skip if conversation already exists for this pair
    if (pairToConversationId[key]) continue;

    // create new conversation
    const conversation = await Conversation.create({
      type: "direct",
      members,
      memberHistory: [
        { username: members[0], action: "joined", by: msg.sender },
        { username: members[1], action: "joined", by: msg.sender },
      ],
    });

    pairToConversationId[key] = conversation._id;
    conversationsCreated++;
    console.log(`  ✅ Created conversation for [${members.join(", ")}] → ${conversation._id}`);
  }

  console.log(`\n📊 Conversations created: ${conversationsCreated}`);
  console.log(`📊 Total conversation pairs: ${Object.keys(pairToConversationId).length}\n`);

  // ── STEP D — backfill conversationId on every unmigrated message ──────────
  console.log("📋 Backfilling conversationId on old messages...");

  let messagesUpdated = 0;
  let messagesFailed = 0;

  for (const msg of unmigrated) {
    const key = [msg.sender, msg.receiver].sort().join("|");
    const conversationId = pairToConversationId[key];

    if (!conversationId) {
      console.log(`  ⚠️  No conversation found for message ${msg._id} — skipping`);
      messagesFailed++;
      continue;
    }

    // convert old status to new deliveredTo/seenBy arrays
    let deliveredTo = [];
    let seenBy = [];

    if (msg.status === "delivered" || msg.status === "seen") {
      deliveredTo = [msg.receiver];
    }

    if (msg.status === "seen") {
      seenBy = [{ username: msg.receiver, at: msg.updatedAt }];
    }

    // also handle missing sentAt (old messages before sentAt was added)
    const sentAt = msg.sentAt || msg.createdAt;

    await Message.updateOne(
      { _id: msg._id },
      {
        conversationId,
        deliveredTo,
        seenBy,
        sentAt,  // backfill sentAt from createdAt if missing
      }
    );

    messagesUpdated++;
  }

  console.log(`\n📊 Messages updated: ${messagesUpdated}`);
  if (messagesFailed > 0) {
    console.log(`⚠️  Messages failed: ${messagesFailed}`);
  }

  // ── STEP E — update lastMessage on each conversation ─────────────────────
  console.log("\n📋 Updating lastMessage on each conversation...");

  for (const [key, conversationId] of Object.entries(pairToConversationId)) {
    // find the most recent message for this conversation
    const lastMsg = await Message.findOne(
      { conversationId },
      {},
      { sort: { sentAt: -1 } }
    );

    if (lastMsg) {
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: lastMsg.message,
        lastMessageSender: lastMsg.sender,
        lastMessageAt: lastMsg.sentAt || lastMsg.createdAt,
      });
      console.log(`  ✅ [${key}] → "${lastMsg.message}"`);
    }
  }

  // ── VERIFICATION ──────────────────────────────────────────────────────────
  await printVerification();

  await mongoose.disconnect();
  console.log("\n✅ Migration complete — MongoDB disconnected");
}

async function printVerification() {
  console.log("\n═══════════════════════════════════════");
  console.log("  VERIFICATION");
  console.log("═══════════════════════════════════════");

  const totalMessages = await Message.countDocuments();
  const migratedMessages = await Message.countDocuments({ conversationId: { $ne: null } });
  const nullMessages = await Message.countDocuments({ conversationId: null });
  const totalConversations = await Conversation.countDocuments();

  console.log(`📊 Total messages:      ${totalMessages}`);
  console.log(`📊 Migrated messages:   ${migratedMessages}`);
  console.log(`📊 Null conversationId: ${nullMessages}`);
  console.log(`📊 Total conversations: ${totalConversations}`);

  if (nullMessages === 0) {
    console.log("\n🎉 SUCCESS — All messages have conversationId");
    console.log("   Safe to deploy new application code");
  } else {
    console.log(`\n⚠️  ${nullMessages} messages still need migration`);
    console.log("   Re-run this script to catch messages that arrived during migration");
  }

  console.log("═══════════════════════════════════════\n");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  mongoose.disconnect();
  process.exit(1);
});