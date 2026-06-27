import { useOnlineUsers } from "../context/OnlineUsersContext";
import { useTyping } from "../context/TypingContext";

function ConversationList({ conversations, loading, selectUser, unreadCounts = {} }) {
  const { onlineUsers } = useOnlineUsers();
  const { typingUsers } = useTyping();

  const formatTime = (time) => {
    if (!time) return "";
    const date = new Date(time);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isOnline = (username) => onlineUsers.includes(username);

  if (loading) return <p className="list-status">Loading...</p>;
  if (conversations.length === 0) return <p className="list-status">No conversations yet</p>;

  return (
    <div className="list">
      {conversations.map((convo) => {
        const unread = unreadCounts[convo.username] || 0;
        return (
          <div
            key={convo.username}
            className="list-item"
            onClick={() => selectUser(convo.username)}
          >
            {/* AVATAR WITH DOT + UNREAD BADGE */}
            <div className="avatar-wrapper">
              <div className="avatar">
                {convo.username.charAt(0).toUpperCase()}
              </div>
              {isOnline(convo.username) && (
                <span className="online-dot" />
              )}
              {unread > 0 && (
                <span className="unread-badge">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>

            {/* INFO */}
            <div className="item-info">
              <div className="item-top">
                <span className={`item-name ${unread > 0 ? "item-name--unread" : ""}`}>
                  {convo.username}
                </span>
                <span className={`item-time ${unread > 0 ? "item-time--unread" : ""}`}>
                  {formatTime(convo.time)}
                </span>
              </div>
              <div className="item-bottom">
                {typingUsers[convo.username] ? (
                  <span className="item-last typing-preview">typing...</span>
                ) : (
                  <span className={`item-last ${unread > 0 ? "item-last--unread" : ""}`}>
                    {convo.lastMessage}
                  </span>
                )}
                <span className={`online-text ${isOnline(convo.username) ? "online" : "offline"}`}>
                  {isOnline(convo.username) ? "Online" : "Offline"}
                </span>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}

export default ConversationList;