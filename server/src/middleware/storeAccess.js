import { pool } from '../lib/postgres.js';

const storeAccessQuery = `
  SELECT 1
  FROM store_employees
  WHERE store_id = $1
    AND business_id = $2
    AND user_id = $3
  LIMIT 1
`;

export const storeAccess = (allowedRoles = ['owner', 'manager', 'cashier']) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.', code: 401 });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource.',
        code: 403
      });
    }

    if (req.user.role === 'owner') {
      return next();
    }

    const storeId = req.params.storeId ?? req.body.storeId ?? req.query.storeId;

    if (!storeId) {
      return res.status(400).json({ success: false, message: 'Store ID is required.', code: 400 });
    }

    const { rows } = await pool.query(storeAccessQuery, [
      storeId,
      req.user.businessId,
      req.user.userId
    ]);

    if (rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this store.',
        code: 403
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message ?? 'Unable to verify store access.',
      code: 500
    });
  }
};
