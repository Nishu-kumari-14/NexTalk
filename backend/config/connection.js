
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI, {
  dbName: "myDB",
});
  console.log("Connected database:", mongoose.connection.name);
}

module.exports = main;