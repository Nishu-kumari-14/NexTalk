import { io } from "socket.io-client";
import { API_URL } from "./config";



const socket = io(API_URL, {

  auth: {
    token: localStorage.getItem("token"),
  },
  autoConnect: false,  // ✅ don't connect until we say so

});


export default socket;