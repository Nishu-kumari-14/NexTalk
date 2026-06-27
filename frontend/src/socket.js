import { io } from "socket.io-client";
console.log("socket file");

const socket = io("http://localhost:8080", {

  auth: {
    token: localStorage.getItem("token"),
  },
  autoConnect: false,  // ✅ don't connect until we say so

});

export default socket;