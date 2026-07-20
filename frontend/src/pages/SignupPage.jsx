import { useState } from "react";

import { useNavigate } from "react-router-dom";
import {API_URL} from "../config"

function SignupPage() {

  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");

  const navigate = useNavigate();


  const handleSignup = async () => {

    // Prevent empty input
    if (!username.trim() || !password.trim()) {
      setMessage("Username and password required");
      return;
    }

    try {

      const response = await fetch(
        `${API_URL}/auth/signup`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      const data = await response.json();

      // Backend error
      if (!response.ok) {
        setMessage(data.error || "Signup failed");
        return;
      }

      setMessage("Signup successful");

      // Go to login page
      navigate("/login");

    } catch (err) {

      console.log(err);

      setMessage("Server error");

    }
  };


  return (
    <div
      style={{
        width: "300px",
        margin: "100px auto",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >

      <h2>Signup</h2>

      <input
        type="text"
        placeholder="Enter username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <input
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleSignup}>
        Signup
      </button>

      {message && (
        <p>{message}</p>
      )}

       <p>
      Already have an account?
    </p>

    <button onClick={() => navigate("/login")}>
      Login
    </button>

    </div>
  );
}

export default SignupPage;