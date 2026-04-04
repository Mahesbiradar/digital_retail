import express from 'express';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { pool } from '../lib/postgres.js';
import { uploadQrCodeImage } from '../lib/cloudinary.js';
import { auth } from '../middleware/auth.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { storeAccess } from '../middleware/storeAccess.js';
import { generateStoreSlug, isValidStoreSlug } from '../utils/store.js';

const router = express.Router();

const storeSelect = `
  SELECT
    s.id,
    s.business_id AS "businessId",
    s.name,
    s.store_slug AS "storeSlug",
    s.phone,
    s.address_line1 AS "addressLine1",
    s.address_line2 AS "addressLine2",
    s.city,
    s.state,
    s.pincode,
    s.logo_url AS "logoUrl",
    s.qr_code_url AS "qrCodeUrl",
    s.qr_code_public_id AS "qrCodePublicId",
    s.self_checkout_enabled AS "selfCheckoutEnabled",
    s.is_active AS "isActive",
    s.created_at AS "createdAt",
    s.updated_at AS "updatedAt"
  FROM stores s
`;

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

const loadStoreById = async (storeId, businessId) => {
  const { rows } = await pool.query(
    `${storeSelect}
     WHERE s.id = $1 AND s.business_id = $2
     LIMIT 1`,
    [storeId, businessId]
  );

  return rows[0] ?? null;
};

const loadStoreEmployees = async (storeId, businessId) => {
  const { rows } = await pool.query(
    `
      SELECT
        se.user_id AS "userId",
        u.name,
        u.phone,
        u.role,
        se.created_at AS "createdAt"
      FROM store_employees se
      INNER JOIN users u ON u.id = se.user_id
      WHERE se.store_id = $1 AND se.business_id = $2
      ORDER BY se.created_at DESC
    `,
    [storeId, businessId]
  );

  return rows;
};

const assertStoreAccess = async (storeId, businessId) => {
  const store = await loadStoreById(storeId, businessId);

  if (!store) {
    const error = new Error('Store not found.');
    error.statusCode = 404;
    throw error;
  }

  return store;
};

const createQrCode = async (storeSlug) => {
  const url = `${env.FRONTEND_URL}/shop/${storeSlug}`;
  return QRCode.toDataURL(url, {
    type: 'image/png',
    margin: 1,
    width: 512,
    errorCorrectionLevel: 'M'
  });
};

const buildStorePayload = async (store) => ({
  ...store,
  business: (await pool.query(businessSelect, [store.businessId])).rows[0] ?? null
});

router.post('/', auth, roleCheck('owner'), async (req, res) => {
  const name = String(req.body.name ?? '').trim();

  if (!name) {
    return res.status(400).json({ message: 'Store name is required.' });
  }

  const client = await pool.connect();

  try {
    let attempt = 0;
    let createdStore = null;

    await client.query('BEGIN');

    while (attempt < 5 && !createdStore) {
      const storeSlug = generateStoreSlug(name);
      const qrCodeDataUrl = await createQrCode(storeSlug);
      const qrCodeUpload = await uploadQrCodeImage({
        storeSlug,
        dataUrl: qrCodeDataUrl
      });

      try {
        const { rows } = await client.query(
          `
            INSERT INTO stores (
              business_id,
              name,
              store_slug,
              phone,
              address_line1,
              address_line2,
              city,
              state,
              pincode,
              logo_url,
              qr_code_url,
              qr_code_public_id,
              self_checkout_enabled
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, true))
            RETURNING
              id,
              business_id AS "businessId",
              name,
              store_slug AS "storeSlug",
              phone,
              address_line1 AS "addressLine1",
              address_line2 AS "addressLine2",
              city,
              state,
              pincode,
              logo_url AS "logoUrl",
              qr_code_url AS "qrCodeUrl",
              qr_code_public_id AS "qrCodePublicId",
              self_checkout_enabled AS "selfCheckoutEnabled",
              is_active AS "isActive",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
          `,
          [
            req.user.businessId,
            name,
            storeSlug,
            req.body.phone ?? null,
            req.body.addressLine1 ?? null,
            req.body.addressLine2 ?? null,
            req.body.city ?? null,
            req.body.state ?? null,
            req.body.pincode ?? null,
            req.body.logoUrl ?? null,
            qrCodeUpload.url,
            qrCodeUpload.publicId,
            req.body.selfCheckoutEnabled ?? true
          ]
        );

        createdStore = rows[0];
      } catch (error) {
        if (error.code !== '23505') {
          throw error;
        }
      }

      attempt += 1;
    }

    if (!createdStore) {
      throw new Error('Unable to generate a unique store slug.');
    }

    await client.query('COMMIT');

    return res.status(201).json({
      store: createdStore,
      qrCodeDataUrl: await createQrCode(createdStore.storeSlug),
      qrCodeUrl: createdStore.qrCodeUrl
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Store creation failed:', error);
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to create store.'
    });
  } finally {
    client.release();
  }
});

router.get('/', auth, roleCheck('owner'), async (req, res) => {
  const { rows } = await pool.query(
    `${storeSelect}
     WHERE s.business_id = $1
     ORDER BY s.created_at DESC`,
    [req.user.businessId]
  );

  return res.json({
    stores: rows
  });
});

router.get('/:storeId', auth, roleCheck('owner'), async (req, res) => {
  try {
    const store = await assertStoreAccess(req.params.storeId, req.user.businessId);
    const business = (await pool.query(businessSelect, [req.user.businessId])).rows[0] ?? null;
    const employees = await loadStoreEmployees(store.id, req.user.businessId);

    return res.json({
      store,
      business,
      employees
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to fetch store.'
    });
  }
});

router.get('/:storeId/summary', auth, storeAccess(['owner', 'manager', 'cashier']), async (req, res) => {
  try {
    const store = await assertStoreAccess(req.params.storeId, req.user.businessId);
    const business = (await pool.query(businessSelect, [req.user.businessId])).rows[0] ?? null;

    return res.json({
      store,
      business
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to fetch store summary.'
    });
  }
});

router.patch('/:storeId', auth, roleCheck('owner'), async (req, res) => {
  try {
    await assertStoreAccess(req.params.storeId, req.user.businessId);

    const updates = [];
    const values = [];

    const allowedFields = [
      ['name', 'name'],
      ['phone', 'phone'],
      ['addressLine1', 'address_line1'],
      ['addressLine2', 'address_line2'],
      ['city', 'city'],
      ['state', 'state'],
      ['pincode', 'pincode'],
      ['logoUrl', 'logo_url'],
      ['selfCheckoutEnabled', 'self_checkout_enabled'],
      ['isActive', 'is_active']
    ];

    allowedFields.forEach(([bodyField, dbField]) => {
      if (req.body[bodyField] !== undefined) {
        values.push(req.body[bodyField]);
        updates.push(`${dbField} = $${values.length}`);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        message: 'At least one store field must be provided.'
      });
    }

    values.push(req.params.storeId, req.user.businessId);

    const { rows } = await pool.query(
      `
        UPDATE stores
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length - 1} AND business_id = $${values.length}
        RETURNING
          id,
          business_id AS "businessId",
          name,
          store_slug AS "storeSlug",
          phone,
          address_line1 AS "addressLine1",
          address_line2 AS "addressLine2",
          city,
          state,
          pincode,
          logo_url AS "logoUrl",
          qr_code_url AS "qrCodeUrl",
          qr_code_public_id AS "qrCodePublicId",
          self_checkout_enabled AS "selfCheckoutEnabled",
          is_active AS "isActive",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      values
    );

    return res.json({ store: rows[0] });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to update store.'
    });
  }
});

router.post('/:storeId/employees', auth, roleCheck('owner'), async (req, res) => {
  const phone = String(req.body.phone ?? '').trim();
  const role = String(req.body.role ?? '').trim();

  if (!phone || !['manager', 'cashier'].includes(role)) {
    return res.status(400).json({
      message: 'Phone and a valid role (manager or cashier) are required.'
    });
  }

  try {
    await assertStoreAccess(req.params.storeId, req.user.businessId);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `
          SELECT id, business_id AS "businessId", name, phone, role
          FROM users
          WHERE phone = $1
          LIMIT 1
        `,
        [phone]
      );

      let user = userResult.rows[0] ?? null;

      if (!user) {
        const placeholderUser = await client.query(
          `
            INSERT INTO users (business_id, name, phone, password_hash, role, is_active)
            VALUES ($1, $2, $3, NULL, $4, false)
            RETURNING id, business_id AS "businessId", name, phone, role
          `,
          [req.user.businessId, phone, phone, role]
        );

        user = placeholderUser.rows[0];
      } else if (user.businessId !== req.user.businessId) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          message: 'This phone number already belongs to a different business.'
        });
      } else if (user.role === 'owner') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          message: 'Owner accounts cannot be invited as store employees.'
        });
      } else {
        await client.query('UPDATE users SET role = $1 WHERE id = $2', [role, user.id]);
      }

      await client.query(
        `
          INSERT INTO store_employees (business_id, store_id, user_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (store_id, user_id) DO NOTHING
        `,
        [req.user.businessId, req.params.storeId, user.id]
      );

      await client.query('COMMIT');

      return res.status(201).json({
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to invite employee.'
    });
  }
});

router.get('/:storeId/employees', auth, roleCheck('owner'), async (req, res) => {
  try {
    await assertStoreAccess(req.params.storeId, req.user.businessId);
    const employees = await loadStoreEmployees(req.params.storeId, req.user.businessId);

    return res.json({ employees });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to load employees.'
    });
  }
});

router.delete('/:storeId/employees/:userId', auth, roleCheck('owner'), async (req, res) => {
  try {
    await assertStoreAccess(req.params.storeId, req.user.businessId);

    const { rowCount } = await pool.query(
      `
        DELETE FROM store_employees
        WHERE store_id = $1 AND user_id = $2 AND business_id = $3
      `,
      [req.params.storeId, req.params.userId, req.user.businessId]
    );

    return res.json({
      success: true,
      removed: rowCount > 0
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to remove employee.'
    });
  }
});

router.get('/:storeId/qr', auth, roleCheck('owner'), async (req, res) => {
  try {
    const store = await assertStoreAccess(req.params.storeId, req.user.businessId);

    return res.json({
      storeId: store.id,
      storeSlug: store.storeSlug,
      qrCodeUrl: store.qrCodeUrl
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to load QR code.'
    });
  }
});

export default router;
