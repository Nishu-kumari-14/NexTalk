import { useState,useRef} from "react";
import socket from "../socket";

function MessageInput({ sendMessage,conversationId}) {
  const [text, setText] = useState("");
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);


  const handleChange = (e) => {
    setText(e.target.value);
 
    // emit typing:start only once per burst
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("typing:start", { conversationId });
    }
 
    // reset the stop timer on every keystroke
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("typing:stop", { conversationId });
    }, 1500);
  };

  const handleSend = () => {
    if (!text.trim()) return;

    // stop typing indicator immediately on send
    clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit("typing:stop", { conversationId });
    }
 

    sendMessage(text);
    
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="message-input-container">

      <input
        type="text"
        placeholder="Type message..."
        value={text}
        
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <button onClick={handleSend}>
        Send
      </button>

    </div>
  );
}

export default MessageInput;