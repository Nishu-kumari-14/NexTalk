import { useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";
import "../App.css"; // ✅ import your css file

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setMessage("Username and password required");
      return;
    }

    try {
      const response = await fetch("http://localhost:8080/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Login failed");
        localStorage.removeItem("token");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("username", username);

      socket.auth = { token: data.token };
      socket.connect();

      // request notification permission on login (user-triggered event)
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

      navigate("/homepage");

    } catch (err) {
      console.error("Login failed", err);
      setMessage("Server error");
    }
  };

  return (
    <div className="join-container">
      <div className="join-box">

        <h1>Login</h1>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleLogin}>Login</button>

        {message && <p>{message}</p>}

        <p style={{ color: "white", textAlign: "center" }}>
          Don't have an account?
        </p>
        <button onClick={() => navigate("/signup")}>Signup</button>

      </div>
    </div>
  );
}

export default LoginPage;