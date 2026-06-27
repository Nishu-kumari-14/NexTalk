const verifyToken = require(
   "../utils/verifyToken"
);

function authMiddleware(req, res, next) {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "No token provided",
    });
  }

  const token = authHeader.split(" ")[1];

  try {

    const decoded = verifyToken(token);

    req.user = decoded;

    next();

  } catch (err) {

    return res.status(401).json({
      error: "Invalid token",
    });
  }
}

module.exports = authMiddleware;