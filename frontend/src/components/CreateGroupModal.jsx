import { useState } from "react";
import useContactStore from "../store/useContactStore";
import "./CreateGroupModal.css";

function CreateGroupModal({ contacts, onClose, onCreated }) {
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const createGroup = useContactStore((state) => state.createGroup);

  const toggleMember = (username) => {
    setSelected((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username]
    );
  };

  const handleCreate = async () => {
    setError("");

    if (!groupName.trim()) {
      setError("Group name is required");
      return;
    }
    if (selected.length < 1) {
      setError("Select at least one contact");
      return;
    }

    setCreating(true);
    const result = await createGroup(groupName.trim(), selected);
    setCreating(false);

    if (result.success) {
      onCreated?.(result.conversation);
      onClose();
    } else {
      setError(result.error || "Failed to create group");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Group</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <input
          type="text"
          className="group-name-input"
          placeholder="Group name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />

        {error && <p className="search-error">{error}</p>}

        {contacts.length === 0 ? (
          <p className="list-status">You need contacts before creating a group</p>
        ) : (
          <div className="list">
            {contacts.map((contact) => (
              <div
                key={contact}
                className="list-item"
                onClick={() => toggleMember(contact)}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(contact)}
                  onChange={() => toggleMember(contact)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="avatar-wrapper">
                  <div className="avatar">
                    {contact.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="item-info">
                  <span className="item-name">{contact}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          className="create-group-btn"
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? "Creating..." : `Create Group${selected.length ? ` (${selected.length})` : ""}`}
        </button>
      </div>
    </div>
  );
}

export default CreateGroupModal;