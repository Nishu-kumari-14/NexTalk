
import { createContext, useContext, useEffect, useState } from "react";
import socket from "../socket";

// create context
const OnlineUsersContext = createContext();

// provider — wraps entire app
export function OnlineUsersProvider({ children }) {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    // get full list when socket connects
    socket.on("online:list", ({ users }) => {
      setOnlineUsers(users);
    });

    // someone came online
    socket.on("user:online", ({ username }) => {
      setOnlineUsers((prev) =>
        prev.includes(username) ? prev : [...prev, username]
      );
    });

    // someone went offline
    socket.on("user:offline", ({ username }) => {
      setOnlineUsers((prev) => prev.filter((u) => u !== username));
    });

    return () => {
      socket.off("online:list");
      socket.off("user:online");
      socket.off("user:offline");
    };
  }, []);

  return (
    <OnlineUsersContext.Provider value={{ onlineUsers }}>
      {children}
    </OnlineUsersContext.Provider>
  );
}

// custom hook — any component uses this
export function useOnlineUsers() {
  return useContext(OnlineUsersContext);
}