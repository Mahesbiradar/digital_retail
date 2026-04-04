import bcrypt from 'bcrypt';
import express from 'express';
import { env } from '../config/env.js';
import {
  decodeToken,
  getStoredRefreshToken,
  revokeRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from '../lib/jwt.js';
import { pool } from '../lib/postgres.js';
import { auth } from '../middleware/auth.js';
import { normalizePhone } from '../utils/phone.js';
import { safeCompare, toPublicBusiness, toPublicUser } from '../utils/serialize.js';

const router = express.Router();

const authSelect = `
  SELECT
    u.id AS "userId",
    u.name AS "userName",
    u.phone AS "userPhone",
    u.password_hash AS "passwordHash",
    u.role AS "userRole",
    u.is_active AS "userActive",
    b.id AS "businessId",
    b.name AS "businessName",
    b.gst_enabled AS "gstEnabled",
    b.discount_enabled AS "discountEnabled",
    b.logo_url AS "logoUrl",
    b.currency_code AS "currencyCode"
  FROM users u
  INNER JOIN businesses b
    ON b.id = u.business_id
`;

const getAuthRecordByPhone = async (phone) => {
  const { rows } = await pool.query(
    `${authSelect}
     WHERE u.phone = $1
     LIMIT 1`,
    [phone]
  );

  return rows[0] ?? null;
};

const getAuthRecordByUserId = async (userId) => {
  const { rows } = await pool.query(
    `${authSelect}
     WHERE u.id = $1
     LIMIT 1`,
    [userId]
  );

  return rows[0] ?? null;
};

const validateSignupPayload = ({ name, phone, password, businessName }) => {
  if (!name?.trim() || !phone?.trim() || !password || !businessName?.trim()) {
    return 'Name, phone, password, and business name are required.';
  }

  if (password.length < 6) {
    return 'Password must be at least 6 characters long.';
  }

  return null;
};

const validateLoginPayload = ({ phone, password }) => {
  if (!phone?.trim() || !password) {
    return 'Phone and password are required.';
  }

  return null;
};

const buildAuthResponse = async (authRecord) => {
  const tokenPayload = {
    userId: authRecord.userId,
    businessId: authRecord.businessId,
    role: authRecord.userRole
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = await signRefreshToken(tokenPayload);

  return {
    accessToken,
    refreshToken,
    user: toPublicUser(authRecord),
    business: toPublicBusiness(authRecord)
  };
};

router.post('/signup', async (req, res) => {
  const validationError = validateSignupPayload(req.body);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const name = req.body.name.trim();
  const businessName = req.body.businessName.trim();
  const phone = normalizePhone(req.body.phone);
  const passwordHash = await bcrypt.hash(req.body.password, env.BCRYPT_SALT_ROUNDS);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingUser = await client.query(
      'SELECT id FROM users WHERE phone = $1 LIMIT 1',
      [phone]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: 'An account with this phone number already exists.'
      });
    }

    const businessResult = await client.query(
      `
        INSERT INTO businesses (name)
        VALUES ($1)
        RETURNING
          id AS "businessId",
          name AS "businessName",
          gst_enabled AS "gstEnabled",
          discount_enabled AS "discountEnabled",
          logo_url AS "logoUrl",
          currency_code AS "currencyCode"
      `,
      [businessName]
    );

    const userResult = await client.query(
      `
        INSERT INTO users (business_id, name, phone, password_hash, role, last_login_at)
        VALUES ($1, $2, $3, $4, 'owner', NOW())
        RETURNING
          id AS "userId",
          business_id AS "businessId",
          name AS "userName",
          phone AS "userPhone",
          role AS "userRole"
      `,
      [businessResult.rows[0].businessId, name, phone, passwordHash]
    );

    await client.query('COMMIT');

    const authRecord = {
      ...businessResult.rows[0],
      ...userResult.rows[0]
    };

    const response = await buildAuthResponse(authRecord);

    return res.status(201).json(response);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({
        message: 'An account with this phone number already exists.'
      });
    }

    console.error('Signup failed:', error);
    return res.status(500).json({
      message: 'Unable to sign up right now.'
    });
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const validationError = validateLoginPayload(req.body);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const phone = normalizePhone(req.body.phone);
    const authRecord = await getAuthRecordByPhone(phone);

    if (!authRecord?.passwordHash || !authRecord.userActive) {
      return res.status(401).json({
        message: 'Invalid phone or password.'
      });
    }

    const isPasswordValid = await bcrypt.compare(req.body.password, authRecord.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid phone or password.'
      });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [authRecord.userId]);

    const response = await buildAuthResponse(authRecord);

    return res.json(response);
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({
      message: 'Unable to log in right now.'
    });
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.body.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({
      message: 'Refresh token is required.'
    });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const storedToken = await getStoredRefreshToken(payload.userId);

    if (!storedToken || !safeCompare(storedToken, refreshToken)) {
      return res.status(401).json({
        message: 'Invalid refresh token.'
      });
    }

    const authRecord = await getAuthRecordByUserId(payload.userId);

    if (!authRecord?.userActive) {
      await revokeRefreshToken(payload.userId);
      return res.status(401).json({
        message: 'User account is inactive.'
      });
    }

    const accessToken = signAccessToken({
      userId: authRecord.userId,
      businessId: authRecord.businessId,
      role: authRecord.userRole
    });

    return res.json({ accessToken });
  } catch (_error) {
    return res.status(401).json({
      message: 'Invalid or expired refresh token.'
    });
  }
});

router.post('/logout', async (req, res) => {
  const refreshToken = req.body.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({
      message: 'Refresh token is required.'
    });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    await revokeRefreshToken(payload.userId);
    return res.json({ success: true });
  } catch (_error) {
    const decoded = decodeToken(refreshToken);

    if (decoded?.userId) {
      await revokeRefreshToken(decoded.userId);
    }

    return res.json({ success: true });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const authRecord = await getAuthRecordByUserId(req.user.userId);

    if (!authRecord?.userActive) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    return res.json({
      user: toPublicUser(authRecord),
      business: toPublicBusiness(authRecord)
    });
  } catch (error) {
    console.error('Failed to fetch current user:', error);
    return res.status(500).json({
      message: 'Unable to load the current user.'
    });
  }
});

export default router;
