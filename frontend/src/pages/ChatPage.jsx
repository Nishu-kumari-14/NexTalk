
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom"; 
import { useOnlineUsers } from "../context/OnlineUsersContext"; // 
import MessageList from "../components/MessageList";
import MessageInput from "../components/MessageInput";
import useMessageStore from "../store/useMessageStore";
import socket from "../socket";
import "./ChatPage.css";
import { useTyping } from "../context/TypingContext";



function ChatPage() {
  
  
  const location = useLocation();
  const currentUser = localStorage.getItem("username");
  const selectedUser = location?.state?.selectedUser;
  const navigate = useNavigate(); 
 
const { typingUsers } = useTyping(); 
const { onlineUsers } = useOnlineUsers(); // ✅ read from context
const isOnline = onlineUsers.includes(selectedUser); // ✅ always fresh
const isPeerTyping = !!typingUsers[selectedUser];
  

// read from store
  const messages = useMessageStore((state) => state.messages[selectedUser] ?? null);
  const loadMessages = useMessageStore((state) => state.loadMessages);
  const clearActiveChat = useMessageStore((state) => state.clearActiveChat);
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const markSeen = useMessageStore((state) => state.markSeen);
  const clearUnread = useMessageStore((state) => state.clearUnread);


//Fetch Old messages

useEffect(() => {

  if (!selectedUser) return;

  clearUnread(selectedUser);

  const fetchMessages = async () => {


    try {
       const token = localStorage.getItem("token");
 
      const response = await fetch(
   `http://localhost:8080/messages/${selectedUser}`,
          {
            headers: {
                   Authorization: `Bearer ${token}`,
               },
        }
   ); 

      const dbMessages = await response.json();

      // loadMessages merges DB data with any buffered messages + sets activeChat
        loadMessages(selectedUser, dbMessages);

      // mark all messages from this user as seen
        markSeen(selectedUser);
     
     
      
    } catch (err) {

      console.error("Failed to fetch messages", err);

    }
  };

  fetchMessages();

  // when leaving this chat — clear activeChat so incoming messages
    // go to buffer instead of being appended to the visible list
    return () => clearActiveChat();

}, [selectedUser]);










  const handleLogout = () => {
  // 1. disconnect socket
  socket.disconnect();

  // 2. remove token
  localStorage.removeItem("token");
  localStorage.removeItem("username");

  // 3. redirect to login
 navigate("/login", { replace: true });
};

  return (
    <div className="chat-container">

      {/* add this to the header in return*/}
<div className="chat-header">

  {/* ✅ back arrow */}
  <button className="back-btn" onClick={() => navigate("/homepage")}>
    ←
  </button>

  <div className="chat-header-info">
    <div className="chat-avatar">
      {selectedUser?.charAt(0).toUpperCase()}
    </div>
    <div className="chat-header-text">
  <h2>{selectedUser ?? ""}</h2>
  <span className={`online-text ${isPeerTyping ? "online" : isOnline ? "online" : "offline"}`}>
    {isPeerTyping ? "typing..." : isOnline ? "Online" : "Offline"}
  </span>
</div>
  </div>

  <button className="logout-btn" onClick={handleLogout}>Logout</button>

</div>
       
     
      

      <MessageList messages={messages || []} currentUser={currentUser} />
      <MessageInput
        sendMessage={(text) => sendMessage(text, selectedUser)}
        receiver={selectedUser}
      />

    </div>
  );
}

export default ChatPage;