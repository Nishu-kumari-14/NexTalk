
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
  const conversationId = location?.state?.conversationId; 
  const conversationType = location?.state?.type; // "direct" | "group"
  const isGroup = conversationType === "group";
  const navigate = useNavigate(); 
 
const { isTypingInConversation } = useTyping();
const { onlineUsers } = useOnlineUsers(); 
const isOnline = onlineUsers.includes(selectedUser); 
const isPeerTyping = isTypingInConversation(conversationId, currentUser);

// group conversations don't have a single "online" concept — show
// member count instead of a misleading Online/Offline label
const conversations = useMessageStore((state) => state.conversations);
const currentConversation = conversations.find(
  (c) => c.conversationId?.toString() === conversationId?.toString()
);
const memberCount = currentConversation?.members?.length;
 
const headerStatusText = isGroup
  ? isPeerTyping
    ? "typing..."
    : `${memberCount || 0} members`
  : isPeerTyping
  ? "typing..."
  : isOnline
  ? "Online"
  : "Offline";

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
 
        // mark all unseen messages in this conversation as seen
        markSeen(conversationId);
 
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
    {headerStatusText}
  </span>
</div>
  </div>

  <button className="logout-btn" onClick={handleLogout}>Logout</button>

</div>
       
     
      

      <MessageList messages={messages || []} currentUser={currentUser} isGroup={isGroup} />
      <MessageInput
        sendMessage={(text) => sendMessage(text, selectedUser, conversationId)}
        conversationId={conversationId}
      />

    </div>
  );
}

export default ChatPage;