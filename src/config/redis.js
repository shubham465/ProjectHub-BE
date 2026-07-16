const Redis = require('ioredis');

let client;

/**
 * Initialise and return the ioredis singleton.
 * In test environments, the caller is expected to swap this out with ioredis-mock
 * via Jest's module mock (jest.mock('ioredis')).
 */
const connectRedis = () => {
  client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  client.on('connect', () => console.log('Redis connected'));
  client.on('error', (err) => console.error('Redis error:', err.message));

  return client;
};

/**
 * Return the already-initialised client.
 * Throws if connectRedis() was never called.
 */
const getRedisClient = () => {
  if (!client) throw new Error('Redis client not initialised. Call connectRedis() first.');
  return client;
};

module.exports = { connectRedis, getRedisClient };
