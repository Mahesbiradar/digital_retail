import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { redisClient } from './redis.js';
import { parseDurationToSeconds } from '../utils/time.js';

const refreshTokenTtlSeconds = parseDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN);

const getRefreshTokenKey = (userId) => `refreshToken:${userId}`;

export const signAccessToken = ({ userId, businessId, role }) =>
  jwt.sign({ userId, businessId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN
  });

export const signRefreshToken = async ({ userId, businessId, role }) => {
  const token = jwt.sign({ userId, businessId, role }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN
  });

  await redisClient.set(getRefreshTokenKey(userId), token, {
    EX: refreshTokenTtlSeconds
  });

  return token;
};

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

export const decodeToken = (token) => jwt.decode(token);

export const getStoredRefreshToken = async (userId) =>
  redisClient.get(getRefreshTokenKey(userId));

export const revokeRefreshToken = async (userId) =>
  redisClient.del(getRefreshTokenKey(userId));
