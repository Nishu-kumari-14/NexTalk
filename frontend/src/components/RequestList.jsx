function RequestList({ pending, onAccept, onReject }) {

  if (pending.length === 0) {
    return <p className="list-status">No pending requests</p>;
  }

  return (
    <div className="list">
      {pending.map((username) => (
        <div key={username} className="list-item">

          {/* AVATAR */}
          <div className="avatar">
            {username.charAt(0).toUpperCase()}
          </div>

          {/* NAME */}
          <div className="item-info">
            <span className="item-name">{username}</span>
            <span className="item-last">wants to connect</span>
          </div>

          {/* BUTTONS */}
          <div className="request-actions">
            <button
              className="accept-btn"
              onClick={() => onAccept(username)}
            >
              Accept
            </button>
            <button
              className="reject-btn"
              onClick={() => onReject(username)}
            >
              Reject
            </button>
          </div>

        </div>
      ))}
    </div>
  );
}

export default RequestList;