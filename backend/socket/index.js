const setupSocketHandlers = require("./handlers");

module.exports = (io) => {
  setupSocketHandlers(io);
};

