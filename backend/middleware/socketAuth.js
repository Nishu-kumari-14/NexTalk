const verifyToken = require(
   "../utils/verifyToken"
);

function socketAuth(socket, next) {

   // Get token
   const token = socket.handshake.auth.token;

   // No token
   if (!token) {

      return next(
         new Error("Authentication error")
      );
   }

   try {

      // Verify JWT
      const decoded = verifyToken(token);

      // Attach user to socket
      socket.user = decoded;

      next();

   } catch (err) {

      return next(
         new Error("Invalid token")
      );
   }
}

module.exports = socketAuth;