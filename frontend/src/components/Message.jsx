function Message({ message, sender, currentUser,status ,timestamp }) {

  // only show ticks on your own messages
  const showTicks = sender === currentUser;

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
      <span className="msg-text">{message}</span>
      <span className="msg-meta">
        <span className="msg-time">{formatTime(timestamp)}</span>
        {renderTicks()}
      </span>
    </div>
  );
}

export default Message;

