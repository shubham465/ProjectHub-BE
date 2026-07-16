const mongoose = require('mongoose');

/**
 * Connect to MongoDB via the MONGO_URI environment variable.
 */
const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB connected: ${conn.connection.host}`);
};

module.exports = connectDB;
