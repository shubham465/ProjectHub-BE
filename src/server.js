require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const { seedDevUsers } = require('./seeder');
const User = require('./models/User');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  connectRedis();

  // Auto-seed mock users in development when the collection is empty
  if (process.env.NODE_ENV === 'development') {
    await seedDevUsers(User);
  }

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT} with Socket.IO`));
};

start();

