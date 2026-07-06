import { create } from "zustand";
import socket from "../socket";
import useToastStore from "./useToastStore";

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
      const convRes = await fetch("http://localhost:8080/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const convData = await convRes.json();
 
      // fetch unread counts
      const unreadRes = await fetch("http://localhost:8080/messages/unread", {
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


  
  console.log("=== message:receive ===");
  console.log("activeChat:", activeChat);
  console.log("convId:", msg.conversationId?.toString());
  console.log("match:", activeChat === msg.conversationId?.toString());


    

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
          receiver: localStorage.getItem("username"),
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
      socket.emit("message:seen", { from: msg.from, conversationId: convId });
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
  socket.on("message:delivered", ({ id }) => {
    const { messages } = get();
    const updatedMessages = {};
    for (const convId in messages) {
      updatedMessages[convId] = messages[convId].map((m) =>
        m._id?.toString() === id?.toString()
          ? { ...m, status: "delivered" }
          : m
      );
    }
    set({ messages: updatedMessages });
  });

  // 4. Receiver opened chat — update all messages to seen
  // now includes conversationId from server
  socket.on("message:seen", ({ by, conversationId }) => {
    const { messages } = get();

    console.log("message:seen — convId:", conversationId?.toString());
   console.log("messages keys:", Object.keys(messages));
   
    const currentUser = localStorage.getItem("username");
    const convId = conversationId?.toString();
    const conv = messages[convId] || [];
 
    set({
      messages: {
        ...messages,
        [convId]: conv.map((m) =>
          m.sender === currentUser
            ? { ...m, status: "seen" }
            : m
        ),
      },
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

    

     // Called when ChatPage mounts — merges DB messages with buffer
     loadMessages: (conversationId, dbMessages) => {
      const { messages } = get();
      const convId = conversationId?.toString();
      const buffered = messages[convId] || [];
 
      // merge DB + buffer — deduplicate by _id
      const merged = [...dbMessages, ...buffered];
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
      console.log("Clearing activeChat");
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
        receiver,
        status: "sent",
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
    // now sends conversationId to backend
    markSeen: (from, conversationId) => {
      console.log("markSeen called — from:", from, "conversationId:", conversationId);
      socket.emit("message:seen", { from, conversationId });
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