import { createContext, useContext, useEffect, useState } from "react";
import socket from "../socket";

// { alice: true, bob: true } — present means actively typing
const TypingContext = createContext();

export function TypingProvider({ children }) {
  const [typingUsers, setTypingUsers] = useState({});

  useEffect(() => {
    socket.on("typing:start", ({ from }) => {
      setTypingUsers((prev) => ({ ...prev, [from]: true }));
    });

    socket.on("typing:stop", ({ from }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[from];
        return next;
      });
    });

    return () => {
      socket.off("typing:start");
      socket.off("typing:stop");
    };
  }, []);

  return (
    <TypingContext.Provider value={{ typingUsers }}>
      {children}
    </TypingContext.Provider>
  );
}

// custom hook — any component uses this
export function useTyping() {
  return useContext(TypingContext);
}