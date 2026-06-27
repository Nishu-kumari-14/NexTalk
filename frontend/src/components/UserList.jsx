function UserList({ users, selectUser }) {
  return (
    <div className="user-list">
      {users.map((user) => (
        <div
          key={user}
          className="user-item"
          onClick={() => selectUser(user)}
        >
          {/* AVATAR */}
          <div className="user-avatar">
            {user.charAt(0).toUpperCase()}
          </div>

          {/* INFO */}
          <div className="user-info">
            <span className="user-name">{user}</span>
          </div>

        </div>
      ))}
    </div>
  );
}

export default UserList;