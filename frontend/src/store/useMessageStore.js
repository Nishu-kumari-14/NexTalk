import { create } from "zustand";
import socket from "../socket";
import useToastStore from "./useToastStore";

const useMessageStore = create((set, get) => {

  // ── SOCKET LISTENERS ─────────────────────────────────────────────
  // All registered ONCE at store creation — never duplicated across pages


  // 0. Socket connects — fetch initial data from DB automatically
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

    // always ack delivery — message reached this device
    socket.emit("message:ack", { id: msg.id });

    // update conversation list — move to top with latest message
    const exists = conversations.find((c) => c.username === msg.from);
    const updatedConversations = exists
      ? conversations.map((c) =>
          c.username === msg.from
            ? { ...c, lastMessage: msg.message, time: msg.sentAt }
            : c
        )
      : [
          { username: msg.from, lastMessage: msg.message, time: msg.sentAt },
          ...conversations,
        ];

    // store message in messages buffer regardless of active chat
    // this way when user opens that chat, messages are already there
    const existing = messages[msg.from] || [];
    const updatedMessages = {
      ...messages,
      [msg.from]: [
        ...existing,
        {
          _id: msg.id,
          message: msg.message,
          sender: msg.from,
          receiver: localStorage.getItem("username"),
          status: "sent",
          sentAt: msg.sentAt,
        },
      ],
    };

    set({
      conversations: updatedConversations,
      messages: updatedMessages,
      // only increment unread if this chat is NOT currently open
      unreadCounts:
        activeChat === msg.from
          ? unreadCounts // chat is open — no badge needed
          : {
              ...unreadCounts,
              [msg.from]: (unreadCounts[msg.from] || 0) + 1,
            },
    });

    // if this chat is open — mark as seen immediately
    if (activeChat === msg.from) {
      socket.emit("message:seen", { from: msg.from });
    }



  

      // ── NOTIFICATIONS ─────────────────────────────────────────────
    // only notify if NOT currently viewing this person's chat
    if (activeChat !== msg.from) {
  const preview = msg.message.length > 40
    ? msg.message.slice(0, 40) + "..."
    : msg.message;

  // always show in-app toast (if app is open on any page)
  useToastStore.getState().addToast(msg.from, preview);

  // also show browser notification if tab is hidden
  if (document.hidden && Notification.permission === "granted") {
   
    new Notification(msg.from, {
      body: preview,
      // icon: "/icon.png",
    });
  }
}




  });



    


  // 2. Sender gets confirmation with real _id from server
  socket.on("message:sent", (msg) => {
    const { messages } = get();
    const conv = messages[msg.receiver] || [];
    set({
      messages: {
        ...messages,
        [msg.receiver]: conv.map((m) =>
          // match by message text + no _id yet (optimistic message)
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
    // find which conversation this message belongs to
    const updatedMessages = {};
    for (const username in messages) {
      updatedMessages[username] = messages[username].map((m) =>
        m._id?.toString() === id?.toString()
          ? { ...m, status: "delivered" }
          : m
      );
    }
    set({ messages: updatedMessages });
  });

  // 4. Receiver opened chat — update all messages to seen
  socket.on("message:seen", ({ by }) => {
    const { messages } = get();
    const currentUser = localStorage.getItem("username");
    const conv = messages[by] || [];
    set({
      messages: {
        ...messages,
        [by]: conv.map((m) =>
          m.sender === currentUser && m.receiver === by
            ? { ...m, status: "seen" }
            : m
        ),
      },
    });
  });

  // ── STORE ────────────────────────────────────────────────────────
  return {

    // STATE
    conversations: [],   // [{ username, lastMessage, time }]
    unreadCounts: {},    // { alice: 2, bob: 1 }
    messages: {},        // { alice: [m1,m2], bob: [m3] }
    activeChat: null,    // username of currently open chat
    loading: false,      // true while fetching on connect

    // ── ACTIONS ──────────────────────────────────────────────────

    

    // Called when ChatPage mounts — sets active chat
    // Also merges DB fetched messages with any buffered messages
    loadMessages: (username, dbMessages) => {
      const { messages } = get();
      const buffered = messages[username] || [];

      // merge DB messages with buffer — deduplicate by _id
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
        activeChat: username,
        messages: { ...messages, [username]: sorted },
      });
    },

    // Called when ChatPage unmounts — clears active chat
    clearActiveChat: () => set({ activeChat: null }),

    // Called when user sends a message
    sendMessage: (text, receiver) => {
      const currentUser = localStorage.getItem("username");
      const sentAt = new Date();

      const optimisticMessage = {
        _id: null, // no _id yet — server will confirm
        message: text,
        sender: currentUser,
        receiver,
        status: "sent",
        sentAt,
      };

      // add optimistic bubble immediately
      const { messages, conversations } = get();
      const conv = messages[receiver] || [];
      set({
        messages: { ...messages, [receiver]: [...conv, optimisticMessage] },
        // update conversation last message immediately
        conversations: conversations.map((c) =>
          c.username === receiver
            ? { ...c, lastMessage: text, time: sentAt }
            : c
        ),
      });

      // emit to server
      socket.emit("message:send", { message: text, receiver, sentAt });
    },

    // Called when ChatPage opens — marks all messages from this user as seen
    markSeen: (username) => {
      socket.emit("message:seen", { from: username });
    },

    // Called when user opens a chat — clears unread badge
    clearUnread: (username) =>
      set((state) => {
        const next = { ...state.unreadCounts };
        delete next[username];
        return { unreadCounts: next };
      }),

    // Called on logout — wipes everything clean
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