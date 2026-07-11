import { createContext, useContext, useEffect, useState } from "react";
import socket from "../socket";

// { alice: true, bob: true } — present means actively typing
const TypingContext = createContext();

export function TypingProvider({ children }) {
  const [typingUsers, setTypingUsers] = useState({});

  useEffect(() => {
    socket.on("typing:start", ({ from, conversationId }) => {
      const convId = conversationId?.toString();
      if (!convId) return;
      setTypingUsers((prev) => ({
        ...prev,
        [convId]: { ...(prev[convId] || {}), [from]: true },
      }));
    });

     socket.on("typing:stop", ({ from, conversationId }) => {
      const convId = conversationId?.toString();
      if (!convId) return;
      setTypingUsers((prev) => {
        const convTyping = { ...(prev[convId] || {}) };
        delete convTyping[from];
        return { ...prev, [convId]: convTyping };
      });
    });

    return () => {
      socket.off("typing:start");
      socket.off("typing:stop");
    };
  }, []);

  // is anyone (other than excludeUser) currently typing in this conversation?
  const isTypingInConversation = (conversationId, excludeUser) => {
    const convId = conversationId?.toString();
    const convTyping = typingUsers[convId];
    if (!convTyping) return false;
    return Object.keys(convTyping).some(
      (u) => u !== excludeUser && convTyping[u]
    );
  };
 
  // usernames currently typing in this conversation (excluding excludeUser)
  const getTypingUsernames = (conversationId, excludeUser) => {
    const convId = conversationId?.toString();
    const convTyping = typingUsers[convId];
    if (!convTyping) return [];
    return Object.keys(convTyping).filter(
      (u) => u !== excludeUser && convTyping[u]
    );
  };

  return (
    <TypingContext.Provider value={{ typingUsers, isTypingInConversation, getTypingUsernames }}>
      {children}
    </TypingContext.Provider>
  );
}

// custom hook — any component uses this
export function useTyping() {
  return useContext(TypingContext);
}