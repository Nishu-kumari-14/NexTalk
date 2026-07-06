import { useState} from "react";
import { useNavigate } from "react-router-dom";
import ConversationList from "../components/ConversationList";
import ContactList from "../components/ContactList";
import RequestList from "../components/RequestList";
import socket from "../socket";
import useMessageStore from "../store/useMessageStore";
import useContactStore from "../store/useContactStore";
import "./HomePage.css";

function HomePage() {
  const [activeTab, setActiveTab] = useState("chats");// pure UI state — correct to keep local
  const navigate = useNavigate();
  const currentUser = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  // read from message store
  const conversations = useMessageStore((state) => state.conversations);
  const unreadCounts = useMessageStore((state) => state.unreadCounts);
  const loading = useMessageStore((state) => state.loading);
  const clearUnread = useMessageStore((state) => state.clearUnread);
  const resetMessages = useMessageStore((state) => state.reset);

  // read from contact store
  const contacts = useContactStore((state) => state.contacts);
  const pending = useContactStore((state) => state.pending);
  const acceptRequest = useContactStore((state) => state.acceptRequest);
  const rejectRequest = useContactStore((state) => state.rejectRequest);
  const resetContacts = useContactStore((state) => state.reset);

  
 

 // now receives conversationId from ConversationList
  const selectUser = (username, conversationId) => {
    clearUnread(conversationId);
    navigate("/chat", {
      state: { currentUser, selectedUser: username, conversationId },
    });
  };

  const handleLogout = () => {
    socket.disconnect();
    resetMessages(); // wipe store clean for next user
     resetContacts(); // wipe contact store
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/login", { replace: true });
  };

 

  return (
    <div className="home-container">
      <div className="home-box">

        {/* HEADER */}
        <div className="home-header">
          <h2>NexTalk</h2>
          <div className="header-actions">
            <span className="current-user">👤 {currentUser}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>

        {/* TABS */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "chats" ? "active" : ""}`}
            onClick={() => setActiveTab("chats")}
          >
            Chats
          </button>
          <button
            className={`tab ${activeTab === "contacts" ? "active" : ""}`}
            onClick={() => setActiveTab("contacts")}
          >
            Contacts
          </button>
          <button
            className={`tab ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            Requests
            {pending.length > 0 && (
              <span className="badge">{pending.length}</span>
            )}
          </button>
        </div>

        {/* CONTENT */}
        {activeTab === "chats" && (
          <ConversationList
            conversations={conversations}
            loading={loading}
            selectUser={selectUser}
            unreadCounts={unreadCounts}
          />
        )}
        {activeTab === "contacts" && (
          <ContactList
            contacts={contacts}
            selectUser={selectUser}
            token={token}
          />
        )}
        {activeTab === "requests" && (
          <RequestList
            pending={pending}
            onAccept={acceptRequest}
            onReject={rejectRequest}
          />
        )}

      </div>
    </div>
  );
}

export default HomePage;