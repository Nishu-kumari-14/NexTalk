import Message from "./Message";
import { useEffect, useRef } from "react";

function MessageList({ messages, currentUser }) {

  const bottomRef = useRef(null);

  // scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  return (
    <div className="message-list">
      {messages.map((msg, index) => (
        <Message
          key={msg._id || index}
          message={msg.message}
          sender={msg.sender}
          currentUser={currentUser}
          status={msg.status}   // ✅ pass status
          timestamp={msg.sentAt}
        />
      ))}

      {/* invisible div at the bottom — scroll target */}
      <div ref={bottomRef} />
      
    </div>
  );
}

export default MessageList;
