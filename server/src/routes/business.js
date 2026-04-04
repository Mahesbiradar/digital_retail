import express from 'express';
import { pool } from '../lib/postgres.js';
import { auth } from '../middleware/auth.js';
import { roleCheck } from '../middleware/roleCheck.js';

const router = express.Router();

const businessSelect = `
  SELECT
    id,
    name,
    gst_enabled AS "gstEnabled",
    discount_enabled AS "discountEnabled",
    gstin,
    logo_url AS "logoUrl",
    currency_code AS "currencyCode",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM businesses
  WHERE id = $1
`;

router.get('/me', auth, roleCheck('owner'), async (req, res) => {
  const { rows } = await pool.query(businessSelect, [req.user.businessId]);

  if (rows.length === 0) {
    return res.status(404).json({ message: 'Business not found.' });
  }

  return res.json({ business: rows[0] });
});

router.patch('/me', auth, roleCheck('owner'), async (req, res) => {
  const gstEnabled = typeof req.body.gstEnabled === 'boolean' ? req.body.gstEnabled : null;
  const discountEnabled =
    typeof req.body.discountEnabled === 'boolean' ? req.body.discountEnabled : null;

  if (gstEnabled === null && discountEnabled === null) {
    return res.status(400).json({
      message: 'At least one business setting must be provided.'
    });
  }

  const updates = [];
  const values = [];

  if (gstEnabled !== null) {
    values.push(gstEnabled);
    updates.push(`gst_enabled = $${values.length}`);
  }

  if (discountEnabled !== null) {
    values.push(discountEnabled);
    updates.push(`discount_enabled = $${values.length}`);
  }

  values.push(req.user.businessId);

  const { rows } = await pool.query(
    `
      UPDATE businesses
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING
        id,
        name,
        gst_enabled AS "gstEnabled",
        discount_enabled AS "discountEnabled",
        gstin,
        logo_url AS "logoUrl",
        currency_code AS "currencyCode",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    values
  );

  return res.json({ business: rows[0] });
});

export default router;
