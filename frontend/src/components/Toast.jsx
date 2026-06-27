import { useNavigate } from "react-router-dom";
import useToastStore from "../store/useToastStore";
import "./Toast.css";

function Toast() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);
  const navigate = useNavigate();
  const currentUser = localStorage.getItem("username");

  const handleClick = (from) => {
    navigate("/chat", {
      state: { currentUser, selectedUser: from },
    });
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast"
          onClick={() => {
            handleClick(toast.from);
            removeToast(toast.id);
          }}
        >
          {/* avatar */}
          <div className="toast-avatar">
            {toast.from.charAt(0).toUpperCase()}
          </div>

          {/* content */}
          <div className="toast-content">
            <span className="toast-sender">{toast.from}</span>
            <span className="toast-message">{toast.message}</span>
          </div>

          {/* close button */}
          <button
            className="toast-close"
            onClick={(e) => {
              e.stopPropagation(); // don't trigger chat navigation
              removeToast(toast.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default Toast;