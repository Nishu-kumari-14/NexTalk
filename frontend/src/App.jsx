import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // ✅ added Navigate
import { useEffect } from "react";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";
import HomePage from "./pages/HomePage";
import Toast from "./components/Toast";


function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" />;
  }

  return children;
}

function App() {
  return (
    
     <>

      {/* Toast renders on top of every page */}
      <Toast />
        

      <Routes>

        {/* PUBLIC routes — no token needed */}
        <Route path="/" element={<SignupPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* PROTECTED routes — token required */}
        <Route path="/homepage" element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        } />

        <Route path="/chat" element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        } />

      </Routes>

     </>
    
  );
}

export default App;