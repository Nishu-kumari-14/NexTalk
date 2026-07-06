
import {useEffect } from "react";
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
  const conversationId = location?.state?.conversationId; // ← new
  const navigate = useNavigate(); 
 
const { typingUsers } = useTyping(); 
const { onlineUsers } = useOnlineUsers(); // ✅ read from context
const isOnline = onlineUsers.includes(selectedUser); // ✅ always fresh
const isPeerTyping = !!typingUsers[selectedUser];
  

// read from store — keyed by conversationId now
  const messages = useMessageStore((state) => state.messages[conversationId] ?? null);
  const loadMessages = useMessageStore((state) => state.loadMessages);
  const clearActiveChat = useMessageStore((state) => state.clearActiveChat);
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const markSeen = useMessageStore((state) => state.markSeen);
  const clearUnread = useMessageStore((state) => state.clearUnread);


useEffect(() => {
    if (!selectedUser || !conversationId) return;
 
    // clear unread badge for this conversation
    clearUnread(conversationId);
 
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem("token");
 
        // new route — GET /messages/:conversationId with pagination
        const response = await fetch(
          `http://localhost:8080/messages/${conversationId}?limit=50`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
 
        const data = await response.json();
 
        // new response shape: { messages, hasMore, nextCursor }
        loadMessages(conversationId, data.messages || []);
 
        // mark all messages from selectedUser as seen
        markSeen(selectedUser, conversationId);
 
      } catch (err) {
        console.error("Failed to fetch messages", err);
      }
    };
 
    fetchMessages();
 
    return () => clearActiveChat();
 
  }, [selectedUser, conversationId]);









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
        sendMessage={(text) => sendMessage(text, selectedUser, conversationId)}
        receiver={selectedUser}
      />

    </div>
  );
}

export default ChatPage;