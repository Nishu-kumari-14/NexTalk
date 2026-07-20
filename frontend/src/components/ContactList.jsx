import { useState } from "react";
import socket from "../socket";
import { useOnlineUsers } from "../context/OnlineUsersContext"; // ✅
import useContactStore from "../store/useContactStore";
import {API_URL} from "../config"

function ContactList({ contacts, selectUser, token}) {
  const { onlineUsers } = useOnlineUsers(); // ✅ read here directly
  const [searchText, setSearchText] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [requesting, setRequesting] = useState(false);

  const isOnline = (username) => onlineUsers.includes(username);
  const sendRequest = useContactStore((state) => state.sendRequest);

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setSearchResult(null);
    setSearchError("");

    try {
      const response = await fetch(
        `${API_URL}/contacts/search?username=${searchText}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();

      if (!response.ok) {
        setSearchError(data.error);
        return;
      }

      setSearchResult(data);

    } catch (err) {
      setSearchError("Search failed");
    }
  };

  const handleRequest = async () => {
    setRequesting(true);

    const result = await sendRequest(searchResult.username);

    if (result.success) {
    setSearchResult((prev) => ({ ...prev, status: "pending" }));
  } else {
    setSearchError(result.error);
  }
  setRequesting(false);
    
  };

  const renderActionButton = () => {
    if (!searchResult) return null;
    if (searchResult.status === "contact") {
      return <span className="status-label">✓ Contact</span>;
    } else if (searchResult.status === "pending") {
      return <span className="status-label pending">Pending...</span>;
    } else if (searchResult.status === "incoming") {
      return <span className="status-label incoming">Sent you a request</span>;
    } else {
      return (
        <button className="add-btn" onClick={handleRequest} disabled={requesting}>
          {requesting ? "Sending..." : "Add"}
        </button>
      );
    }
  };

  return (
    <div className="contact-container">

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search username..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      {searchError && <p className="search-error">{searchError}</p>}

      {searchResult && (
        <div className="search-result">
          <div className="avatar-wrapper">
            <div className="avatar">
              {searchResult.username.charAt(0).toUpperCase()}
            </div>
            {isOnline(searchResult.username) && (
              <span className="online-dot" />
            )}
          </div>
          <span className="item-name">{searchResult.username}</span>
          {renderActionButton()}
        </div>
      )}

      {contacts.length === 0 ? (
        <p className="list-status">No contacts yet</p>
      ) : (
        <div className="list">
          {contacts.map((contact) => (
            <div
              key={contact}
              className="list-item"
              onClick={() => selectUser(contact)}
            >
              {/* AVATAR WITH DOT */}
              <div className="avatar-wrapper">
                <div className="avatar">
                  {contact.charAt(0).toUpperCase()}
                </div>
                {isOnline(contact) && (
                  <span className="online-dot" />
                )}
              </div>

              <div className="item-info">
                <span className="item-name">{contact}</span>
                <span className={`online-text ${isOnline(contact) ? "online" : "offline"}`}>
                  {isOnline(contact) ? "Online" : "Offline"}
                </span>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default ContactList;