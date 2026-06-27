import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { OnlineUsersProvider } from "./context/OnlineUsersContext";
import { TypingProvider } from "./context/TypingContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <OnlineUsersProvider>
      <TypingProvider>
        <App />
      </TypingProvider>
    </OnlineUsersProvider>
  </BrowserRouter>
);