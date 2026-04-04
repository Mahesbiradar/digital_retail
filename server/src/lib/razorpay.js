import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

let client = null;

export const getRazorpayClient = () => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return null;
  }

  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET
    });
  }

  return client;
};

export const buildRazorpaySignature = (orderId, paymentId) =>
  crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET || 'dev-razorpay-secret')
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  if (!signature) {
    return false;
  }

  const expected = Buffer.from(buildRazorpaySignature(orderId, paymentId));
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
};
