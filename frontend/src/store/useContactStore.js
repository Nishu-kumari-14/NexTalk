import { create } from "zustand";
import socket from "../socket";
import useMessageStore from "./useMessageStore";

const useContactStore = create((set, get) => {

  // ── SOCKET LISTENERS ─────────────────────────────────────────────

  // 0. Socket connects — fetch contacts + pending from DB
  socket.on("connect", async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      // fetch contacts
      const contactsRes = await fetch("http://localhost:8080/contacts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contactsData = await contactsRes.json();

      // fetch pending requests
      const pendingRes = await fetch("http://localhost:8080/contacts/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pendingData = await pendingRes.json();

      set({
        contacts: contactsData.contacts || [],
        pending: pendingData.pending || [],
      });
    } catch (err) {
      console.error("Failed to fetch contacts on connect", err);
    }
  });

  // 1. Someone sent me a contact request
  socket.on("request:received", ({ from }) => {
    set((state) => ({
      pending: [...state.pending, from],
    }));
  });

  // 2. Someone accepted MY contact request
  // contactStore updates contacts
  // tells messageStore to add a conversation
  socket.on("request:accepted", ({ by, conversation }) => {
  set((state) => ({
    contacts: [...(state.contacts || []), by],
  }));

 useMessageStore.getState().addConversationIfMissing(conversation);
});

 // 3. Someone added me to a group — conversation already exists in DB,
  // this just pushes it into the store instantly for online members
  // (offline members get it naturally via the join-all-conversations-on-connect
  // logic in handlers.js, no listener needed for that case)
  socket.on("group:created", ({ conversation }) => {
    useMessageStore.getState().addConversationIfMissing(conversation);
  });

  // ── STORE ────────────────────────────────────────────────────────
  return {

    // STATE
    contacts: [],  // list of accepted contacts
    pending: [],   // list of incoming request usernames

    // ── ACTIONS ──────────────────────────────────────────────────

    // Accept a contact request
    acceptRequest: async (username) => {
  const token = localStorage.getItem("token");
  try {
    const response = await fetch(
      `http://localhost:8080/contacts/accept/${username}`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.ok) {
      const data = await response.json();

      set((state) => ({
        pending: state.pending.filter((u) => u !== username),
        contacts: [...(state.contacts || []), username],
      }));

      // add conversation with CORRECT new shape
      useMessageStore.getState().addConversationIfMissing(data.conversation);

      socket.emit("request:accept", { to: username });
    }
  } catch (err) {
    console.error("Failed to accept request", err);
  }
},

    // Reject a contact request
    rejectRequest: async (username) => {
      const token = localStorage.getItem("token");
      try {
        const response = await fetch(
          `http://localhost:8080/contacts/reject/${username}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          set((state) => ({
            pending: state.pending.filter((u) => u !== username),
          }));
        }
      } catch (err) {
        console.error("Failed to reject request", err);
      }
    },


    // Send a contact request
sendRequest: async (username) => {
  const token = localStorage.getItem("token");
  try {
    const response = await fetch(
      `http://localhost:8080/contacts/request/${username}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error };
    }

    socket.emit("request:send", { to: username });
    return { success: true };

  } catch (err) {
    console.error("Failed to send request", err);
    return { success: false, error: "Failed to send request" };
  }
},

   // Create a group — REST creates the Conversation + notifies invited
    // members over socket (see groupRoutes.js); this just adds it to
    // the CREATOR's own store from the REST response
    createGroup: async (name, members) => {
      const token = localStorage.getItem("token");
      try {
        const response = await fetch("http://localhost:8080/groups/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name, members }),
        });
 
        const data = await response.json();
 
        if (!response.ok) {
          return { success: false, error: data.error };
        }
 
        useMessageStore.getState().addConversationIfMissing(data.conversation);
 
        return { success: true, conversation: data.conversation };
      } catch (err) {
        console.error("Failed to create group", err);
        return { success: false, error: "Failed to create group" };
      }
    },


    // Called on logout — wipes clean
    reset: () => set({ contacts: [], pending: [] }),
  };
});

export default useContactStore;