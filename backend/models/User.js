const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  contacts: {
    type: [String],
    default: [],
  },
  pendingRequests: {
    type: [String],  // ✅ incoming requests
    default: [],
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("User", userSchema);