import { create } from "zustand";
import socket from "../socket";
import useToastStore from "./useToastStore";
import { API_URL } from "../config";


// Derives display status ("sent" | "delivered" | "seen") from a message's
// deliveredTo/seenBy arrays, compared against how many people actually
// need to have received/seen it — 1 for direct chats, ALL other group
// members for groups. Matches WhatsApp: single tick until it reaches
// EVERY recipient's device, double grey once everyone has it, double
// blue only once everyone has actually seen it.
function computeStatus(msg, conversations) {
  const seenCount = msg.seenBy?.length || 0;
  const deliveredCount = msg.deliveredTo?.length || 0;
 
  const conv = conversations.find(
    (c) => c.conversationId?.toString() === msg.conversationId?.toString()
  );
  const totalMembers = conv?.members?.length || 2; // fallback assumes direct (2 people)
  const expectedRecipients = Math.max(totalMembers - 1, 1);
 
  if (seenCount >= expectedRecipients) return "seen";
  if (deliveredCount >= expectedRecipients) return "delivered";
  return "sent";
}

const useMessageStore = create((set, get) => {

  // ── SOCKET LISTENERS ─────────────────────────────────────────────
  // All registered ONCE at store creation — never duplicated across pages


  // 0. Socket connects — fetch initial data from DB 
  socket.on("connect", async () => {
    const token = localStorage.getItem("token");
    if (!token) return; // not logged in yet — ignore
 
    set({ loading: true });
 
    try {
      // fetch conversations
      const convRes = await fetch(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const convData = await convRes.json();
 
      // fetch unread counts
      const unreadRes = await fetch(`${API_URL}/messages/unread`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const unreadData = await unreadRes.json();
 
      set({
        conversations: convData.conversations || [],
        unreadCounts: unreadData.unread || {},
        loading: false,
      });
    } catch (err) {
      console.error("Failed to fetch initial data on connect", err);
      set({ loading: false });
    }
  });
 

  // 1. Incoming message
  socket.on("message:receive", (msg) => {

    const { conversations, unreadCounts, messages, activeChat } = get();

    // always ack delivery — message reached this device
    socket.emit("message:ack", { id: msg.id });

    const convId = msg.conversationId?.toString();

    // update conversation list — move to top with latest message
    // now matched by conversationId instead of username
    const exists = conversations.find((c) => c.conversationId?.toString() === convId);
    const updatedConversations = exists
      ? conversations.map((c) =>
          c.conversationId?.toString() === convId
            ? { ...c, lastMessage: msg.message, time: msg.sentAt }
            : c
        )
      : [
          {
            conversationId: msg.conversationId,
            name: msg.from,       // for direct chat — other user's name
            lastMessage: msg.message,
            time: msg.sentAt,
            type: "direct",
          },
          ...conversations,
        ];

    // buffer message keyed by conversationId
    const existing = messages[convId] || [];
    const updatedMessages = {
      ...messages,
      [convId]: [
        ...existing,
        {
          _id: msg.id,
          message: msg.message,
          sender: msg.from,
          status: "sent",
          sentAt: msg.sentAt,
          conversationId: msg.conversationId,
        },
      ],
    };

    set({
      conversations: updatedConversations,
      messages: updatedMessages,
      // only increment unread if this conversation is NOT currently open
      unreadCounts:
        activeChat === convId
          ? unreadCounts
          : {
              ...unreadCounts,
              [convId]: (unreadCounts[convId] || 0) + 1,
            },
    });
 

    // if this conversation is open — mark as seen immediately
    if (activeChat === convId) {
  socket.emit("message:seen", { conversationId: convId });
}



  

     // ── NOTIFICATIONS ───────────────────────────────────────────────
    if (activeChat !== convId) {
      const preview = msg.message.length > 40
        ? msg.message.slice(0, 40) + "..."
        : msg.message;
 
      useToastStore.getState().addToast(msg.from, preview);
 
      if (document.hidden && Notification.permission === "granted") {
        new Notification(msg.from, { body: preview });
      }
    }
  });



    

 // 2. Sender gets confirmation with real _id from server
  socket.on("message:sent", (msg) => {
    const { messages } = get();
    const convId = msg.conversationId?.toString();
    const conv = messages[convId] || [];
 
    set({
      messages: {
        ...messages,
        [convId]: conv.map((m) =>
          m.message === msg.message && !m._id
            ? { ...m, _id: msg.id, status: "sent", sentAt: msg.sentAt }
            : m
        ),
      },
    });
  });

 // 3. Receiver acked — update sender's message to delivered
  socket.on("message:delivered", ({ id, by }) => {
    const { messages, conversations } = get();
    const updatedMessages = {};
    for (const convId in messages) {
      updatedMessages[convId] = messages[convId].map((m) => {
        if (m._id?.toString() !== id?.toString()) return m;
 
        const alreadyHas = (m.deliveredTo || []).includes(by);
        const deliveredTo = alreadyHas
          ? m.deliveredTo
          : [...(m.deliveredTo || []), by];
 
        const updated = { ...m, deliveredTo };
        return { ...updated, status: computeStatus(updated, conversations) };
      });
    }
    set({ messages: updatedMessages });
  });

  // 4. Sender is told exactly which of their message IDs were just seen,
  // and by whom. Only those specific messages get their seenBy array
  // updated — NOT every message the sender has ever sent in this
  // conversation. Status is then recomputed per-message: for direct
  // chats 1 seenBy entry = seen, for groups it needs ALL other members.
   socket.on("message:seen", ({ by, conversationId, messageIds }) => {
    if (!messageIds || messageIds.length === 0) return;
 
    const { messages, conversations } = get();
    const convId = conversationId?.toString();
    const conv = messages[convId] || [];
    const idSet = new Set(messageIds);
 
    const updatedConv = conv.map((m) => {
      if (!m._id || !idSet.has(m._id.toString())) return m;
 
      const alreadyHas = (m.seenBy || []).some(
        (s) => (s.username || s) === by
      );
      const seenBy = alreadyHas
        ? m.seenBy
        : [...(m.seenBy || []), { username: by, at: new Date() }];
 
      const updated = { ...m, seenBy };
      return { ...updated, status: computeStatus(updated, conversations) };
    });
 
    set({
      messages: { ...messages, [convId]: updatedConv },
    });
  });
  // ── STORE ────────────────────────────────────────────────────────
  return {

    // STATE
    conversations: [],   // [{ conversationId, type, name, lastMessage, time }]
    unreadCounts: {},    // { conversationId: count }
    messages: {},        // { conversationId: [m1, m2, ...] }
    activeChat: null,    // conversationId of currently open chat
    loading: false,


    // ── ACTIONS ──────────────────────────────────────────────────

    // Shared helper — adds a conversation to the list if not already
    // present, deduplicated by conversationId. Used by useContactStore
    // for three cases that all need the same dedupe-and-prepend logic:
    // accepting a contact request (REST response), being notified that
    // someone accepted YOUR request (request:accepted socket event),
    // and being added to a group (group:created socket event).
    addConversationIfMissing: (conversation) => {
      if (!conversation) return;
      set((state) => {
        const exists = state.conversations.find(
          (c) =>
            c.conversationId?.toString() ===
            conversation.conversationId?.toString()
        );
        if (exists) return state;
        return { conversations: [conversation, ...state.conversations] };
      });
    },

    

     // Called when ChatPage mounts — merges DB messages with buffer
     loadMessages: (conversationId, dbMessages) => {
      const { messages, conversations } = get();
      const convId = conversationId?.toString();
      const buffered = messages[convId] || [];



      // DB messages already carry real deliveredTo/seenBy arrays (see
      // migration log Step 6 — the old flat "status" field was removed
      // from the schema). Status is derived from those arrays using the
      // same computeStatus helper the live socket listeners use, so
      // historical and live messages are always evaluated identically —
      // including the "seen by ALL members" rule for groups.
      // Buffered/live messages already have status set via socket
      // events, so they pass through unchanged.
      const dbMessagesWithStatus = dbMessages.map((m) => {
        if (m.status) return m;
        return { ...m, status: computeStatus(m, conversations) };
      });
 


 
      // merge DB + buffer — deduplicate by _id
      const merged = [...dbMessagesWithStatus, ...buffered];
      const seen = new Set();
      const deduplicated = merged.filter((m) => {
        const id = m._id?.toString();
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
 
      // sort by sentAt
      const sorted = deduplicated.sort(
        (a, b) => new Date(a.sentAt) - new Date(b.sentAt)
      );
 
      set({
        activeChat: convId,
        messages: { ...messages, [convId]: sorted },
      });
    },

    // Called when ChatPage unmounts — clears active chat
    clearActiveChat: () => {
       set({ activeChat: null });
    },

    // Called when user sends a message
    // now takes conversationId so we can key the optimistic message correctly
    sendMessage: (text, receiver, conversationId) => {
      const currentUser = localStorage.getItem("username");
      const sentAt = new Date();
      const convId = conversationId?.toString();
 
      const optimisticMessage = {
        _id: null,
        message: text,
        sender: currentUser,
        status: "sent",
        deliveredTo: [],
        seenBy: [],
        sentAt,
        conversationId,
      };
 
      const { messages, conversations } = get();
      const conv = messages[convId] || [];
 
      set({
        messages: { ...messages, [convId]: [...conv, optimisticMessage] },
        // update conversation last message immediately
        conversations: conversations.map((c) =>
          c.conversationId?.toString() === convId
            ? { ...c, lastMessage: text, time: sentAt }
            : c
        ),
      });

      // emit to server
       socket.emit("message:send", { message: text, receiver, conversationId, sentAt });
    },

   // Called when ChatPage opens — marks messages as seen
    // conversationId is all the backend needs now — it figures out
    // exactly which messages/senders are affected server-side
    markSeen: (conversationId) => {
      socket.emit("message:seen", { conversationId });
    },
 
 
    // Called when user opens a chat — clears unread badge
    clearUnread: (conversationId) =>
      set((state) => {
        const next = { ...state.unreadCounts };
        delete next[conversationId?.toString()];
        return { unreadCounts: next };
      }),
 
    // Called on logout
    reset: () =>
      set({
        conversations: [],
        unreadCounts: {},
        messages: {},
        activeChat: null,
        loading: false,
      }),
  };
});

export default useMessageStore;