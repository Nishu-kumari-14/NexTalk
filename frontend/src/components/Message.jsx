function Message({ message, sender, currentUser,status ,timestamp, isGroup }) {

  // only show ticks on your own messages
  const showTicks = sender === currentUser;

  // show sender name on incoming group messages only —
  // direct chats don't need it (always "them"), and you never need
  // to see your own name on your own bubble
  const showSenderName = isGroup && !showTicks;

  const renderTicks = () => {
    if (!showTicks) return null;

    if (status === "seen") {
      return <span className="ticks seen">✓✓</span>;
    } else if (status === "delivered") {
      return <span className="ticks delivered">✓✓</span>;
    } else {
      return <span className="ticks sent">✓</span>;
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={`message ${sender === currentUser ? "my-message" : "other-message"}`}>
      {showSenderName && <span className="msg-sender-name">{sender}</span>}
      <div className="msg-bubble-row">
        <span className="msg-text">{message}</span>
        <span className="msg-meta">
          <span className="msg-time">{formatTime(timestamp)}</span>
          {renderTicks()}
        </span>
      </div>
    </div>
  );
}

export default Message;

