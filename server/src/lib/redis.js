import { createClient } from 'redis';
import { env } from '../config/env.js';

export const redisClient = createClient({
  url: env.REDIS_URL
});

redisClient.on('error', (error) => {
  console.error('Redis error:', error.message);
});

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
};

export const closeRedisConnection = async () => {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
};

