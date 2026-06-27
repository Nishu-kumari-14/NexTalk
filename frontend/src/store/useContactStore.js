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
  socket.on("request:accepted", ({ by  }) => {
    set((state) => ({
      contacts: [...(state.contacts || []), by ],
    }));

    


    // tell messageStore — new conversation starts
    useMessageStore.setState((state) => {
       const exists = state.conversations.find((c) => c.username === by );
       if (exists) return state; // already there — don't add duplicate
      
      
      return {
      conversations: [
        { username: by , lastMessage: "", time: new Date() },
        ...state.conversations,
      ],
    };
   });



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
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          // remove from pending, add to contacts
          set((state) => ({
            pending: state.pending.filter((u) => u !== username),
            contacts: [...(state.contacts || []), username],
          }));

          // tell messageStore — new conversation starts
          useMessageStore.setState((state) => {
             const exists = state.conversations.find((c) => c.username === username);
             if (exists) return state; // already there — don't add duplicate
             return {
               conversations: [
                   { username, lastMessage: "", time: new Date() },
                   ...state.conversations,
               ],
             };
      });

          // notify the other user via socket
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

    // Called on logout — wipes clean
    reset: () => set({ contacts: [], pending: [] }),
  };
});

export default useContactStore;