import express from 'express';
import { pool } from '../lib/postgres.js';
import { auth } from '../middleware/auth.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { storeAccess } from '../middleware/storeAccess.js';
import {
  buildBatchRow,
  buildCatalogRow,
  buildExpiryAlertRow,
  buildProductRow,
  getInputValue,
  getValidUnitTypes,
  normalizeBatchDate,
  toNumberOrNull
} from '../utils/inventory.js';

const router = express.Router();
const writeAccess = roleCheck('owner', 'manager');
const billingAccess = storeAccess(['owner', 'manager', 'cashier']);

const loadStore = async (storeId, businessId) => {
  const { rows } = await pool.query(
    `
      SELECT id, business_id AS "businessId", name, store_slug AS "storeSlug"
      FROM stores
      WHERE id = $1 AND business_id = $2
      LIMIT 1
    `,
    [storeId, businessId]
  );

  return rows[0] ?? null;
};

const validateStoreAccess = async (storeId, businessId) => {
  const store = await loadStore(storeId, businessId);

  if (!store) {
    const error = new Error('Store not found.');
    error.statusCode = 404;
    throw error;
  }

  return store;
};

const loadProduct = async (productId, storeId, businessId) => {
  const { rows } = await pool.query(
    `
      SELECT
        id,
        business_id AS "businessId",
        store_id AS "storeId",
        catalog_id AS "catalogId",
        created_by AS "createdBy",
        name,
        brand,
        sku,
        unit_type AS "unitType",
        unit_value AS "unitValue",
        description,
        mrp,
        selling_price AS "sellingPrice",
        gst_rate AS "gstRate",
        track_expiry AS "trackExpiry",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM products
      WHERE id = $1 AND store_id = $2 AND business_id = $3
      LIMIT 1
    `,
    [productId, storeId, businessId]
  );

  return rows[0] ?? null;
};

const loadBatch = async (batchId, storeId, businessId) => {
  const { rows } = await pool.query(
    `
      SELECT
        id,
        business_id AS "businessId",
        store_id AS "storeId",
        product_id AS "productId",
        created_by AS "createdBy",
        batch_number AS "batchNumber",
        quantity,
        available_quantity AS "availableQuantity",
        purchase_price AS "purchasePrice",
        expiry_date AS "expiryDate",
        expiry_status AS "expiryStatus",
        disposed_at AS "disposedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM inventory_batches
      WHERE id = $1 AND store_id = $2 AND business_id = $3
      LIMIT 1
    `,
    [batchId, storeId, businessId]
  );

  return rows[0] ?? null;
};

const loadCatalogById = async (catalogId) => {
  const { rows } = await pool.query(
    `
      SELECT
        id,
        brand,
        name,
        barcode,
        category,
        unit_type AS "unitType",
        unit_value AS "unitValue",
        mrp,
        gst_rate AS "gstRate",
        image_url AS "imageUrl",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM catalog
      WHERE id = $1
      LIMIT 1
    `,
    [catalogId]
  );

  return rows[0] ?? null;
};

const parseProductPayload = async (body, { catalogRow = null } = {}) => {
  const unitTypeInput = getInputValue(body, 'unit_type', 'unitType');
  const unitValueInput = getInputValue(body, 'unit_value', 'unitValue');
  const sellingPriceInput = getInputValue(body, 'selling_price', 'sellingPrice');

  const unitType = unitTypeInput ? String(unitTypeInput) : catalogRow?.unitType ?? null;
  if (unitType && !getValidUnitTypes().has(String(unitType))) {
    const error = new Error('Invalid unit type.');
    error.statusCode = 400;
    throw error;
  }

  const sellingPrice = toNumberOrNull(sellingPriceInput);
  if (sellingPrice === null) {
    const error = new Error('Selling price is required.');
    error.statusCode = 400;
    throw error;
  }

  return {
    catalogId: (() => {
      const value = getInputValue(body, 'catalog_id', 'catalogId');
      return value ? value : null;
    })(),
    name: String(getInputValue(body, 'name') ?? catalogRow?.name ?? '').trim(),
    brand: String(getInputValue(body, 'brand') ?? catalogRow?.brand ?? '').trim() || null,
    sku: String(getInputValue(body, 'sku') ?? '').trim() || null,
    unitType: unitType ?? null,
    unitValue: toNumberOrNull(unitValueInput ?? catalogRow?.unitValue),
    description: String(getInputValue(body, 'description') ?? '').trim() || null,
    mrp: toNumberOrNull(getInputValue(body, 'mrp') ?? catalogRow?.mrp),
    sellingPrice,
    gstRate: toNumberOrNull(getInputValue(body, 'gst_rate', 'gstRate') ?? catalogRow?.gstRate),
    trackExpiry:
      typeof getInputValue(body, 'track_expiry', 'trackExpiry') === 'boolean'
        ? getInputValue(body, 'track_expiry', 'trackExpiry')
        : String(getInputValue(body, 'track_expiry', 'trackExpiry') ?? '').toLowerCase() ===
          'true',
    isActive:
      getInputValue(body, 'is_active', 'isActive') === undefined
        ? true
        : String(getInputValue(body, 'is_active', 'isActive')).toLowerCase() === 'true'
  };
};

router.get('/:storeId/catalog/search', auth, billingAccess, async (req, res) => {
  try {
    await validateStoreAccess(req.params.storeId, req.user.businessId);

    const q = String(req.query.q ?? '').trim();
    if (!q) {
      return res.json({ items: [] });
    }

    const { rows } = await pool.query(
      `
        SELECT
          id,
          brand,
          name,
          barcode,
          category,
          unit_type AS "unitType",
          unit_value AS "unitValue",
          mrp,
          gst_rate AS "gstRate",
          image_url AS "imageUrl",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM catalog
        WHERE name ILIKE $1 OR barcode = $2
        ORDER BY CASE WHEN barcode = $2 THEN 0 ELSE 1 END, name ASC
        LIMIT 15
      `,
      [`%${q}%`, q]
    );

    return res.json({ items: rows.map(buildCatalogRow) });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to search catalog.'
    });
  }
});

router.get('/:storeId/catalog/barcode/:barcode', auth, billingAccess, async (req, res) => {
  try {
    await validateStoreAccess(req.params.storeId, req.user.businessId);

    const { rows } = await pool.query(
      `
        SELECT
          id,
          brand,
          name,
          barcode,
          category,
          unit_type AS "unitType",
          unit_value AS "unitValue",
          mrp,
          gst_rate AS "gstRate",
          image_url AS "imageUrl",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM catalog
        WHERE barcode = $1
        LIMIT 1
      `,
      [String(req.params.barcode ?? '').trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'NOT_FOUND' });
    }

    return res.json({ product: buildCatalogRow(rows[0]) });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to look up barcode.'
    });
  }
});

router.post('/:storeId/products', auth, writeAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    await validateStoreAccess(req.params.storeId, req.user.businessId);

    const catalogId = (() => {
      const value = getInputValue(req.body, 'catalog_id', 'catalogId');
      return value ? value : null;
    })();
    const catalogRow = catalogId ? await loadCatalogById(catalogId) : null;

    if (catalogId && !catalogRow) {
      return res.status(404).json({ message: 'Catalog item not found.' });
    }

    const payload = await parseProductPayload(req.body, { catalogRow });

    if (!payload.name) {
      return res.status(400).json({ message: 'Product name is required.' });
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `
        INSERT INTO products (
          business_id,
          store_id,
          catalog_id,
          created_by,
          name,
          brand,
          sku,
          unit_type,
          unit_value,
          description,
          mrp,
          selling_price,
          gst_rate,
          track_expiry,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING
          id,
          business_id AS "businessId",
          store_id AS "storeId",
          catalog_id AS "catalogId",
          created_by AS "createdBy",
          name,
          brand,
          sku,
          unit_type AS "unitType",
          unit_value AS "unitValue",
          description,
          mrp,
          selling_price AS "sellingPrice",
          gst_rate AS "gstRate",
          track_expiry AS "trackExpiry",
          is_active AS "isActive",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        req.user.businessId,
        req.params.storeId,
        payload.catalogId,
        req.user.userId,
        payload.name,
        payload.brand,
        payload.sku,
        payload.unitType,
        payload.unitValue,
        payload.description,
        payload.mrp,
        payload.sellingPrice,
        payload.gstRate,
        payload.trackExpiry,
        payload.isActive
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      product: buildProductRow({
        ...rows[0],
        totalStock: 0,
        sellableStock: 0,
        expiringSoonBatches: 0,
        expiredBatches: 0
      })
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to create product.'
    });
  } finally {
    client.release();
  }
});

router.get('/:storeId/products', auth, billingAccess, async (req, res) => {
  try {
    await validateStoreAccess(req.params.storeId, req.user.businessId);

    const { rows } = await pool.query(
      `
        SELECT
          p.id,
          p.business_id AS "businessId",
          p.store_id AS "storeId",
          p.catalog_id AS "catalogId",
          p.created_by AS "createdBy",
          p.name,
          p.brand,
          p.sku,
          p.unit_type AS "unitType",
          p.unit_value AS "unitValue",
          p.description,
          p.mrp,
          p.selling_price AS "sellingPrice",
          p.gst_rate AS "gstRate",
          p.track_expiry AS "trackExpiry",
          p.is_active AS "isActive",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          COALESCE(ps.total_stock, 0) AS "totalStock",
          COALESCE(bs.sellable_stock, 0) AS "sellableStock",
          COALESCE(bs.expiring_soon_batches, 0) AS "expiringSoonBatches",
          COALESCE(bs.expired_batches, 0) AS "expiredBatches"
        FROM products p
        LEFT JOIN product_stock ps
          ON ps.product_id = p.id AND ps.store_id = p.store_id
        LEFT JOIN (
          SELECT
            product_id,
            store_id,
            SUM(available_quantity) FILTER (
              WHERE expiry_status <> 'expired'
                AND expiry_status <> 'disposed'
                AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
            ) AS sellable_stock,
            COUNT(*) FILTER (WHERE expiry_status = 'expiring_soon') AS expiring_soon_batches,
            COUNT(*) FILTER (WHERE expiry_status = 'expired') AS expired_batches
          FROM inventory_batches
          GROUP BY product_id, store_id
        ) bs
          ON bs.product_id = p.id AND bs.store_id = p.store_id
        WHERE p.store_id = $1 AND p.business_id = $2
        ORDER BY p.created_at DESC
      `,
      [req.params.storeId, req.user.businessId]
    );

    return res.json({ products: rows.map(buildProductRow) });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to load products.'
    });
  }
});

router.get('/:storeId/products/:productId', auth, billingAccess, async (req, res) => {
  try {
    await validateStoreAccess(req.params.storeId, req.user.businessId);

    const product = await loadProduct(req.params.productId, req.params.storeId, req.user.businessId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const { rows: batchRows } = await pool.query(
      `
        SELECT
          id,
          business_id AS "businessId",
          store_id AS "storeId",
          product_id AS "productId",
          created_by AS "createdBy",
          batch_number AS "batchNumber",
          quantity,
          available_quantity AS "availableQuantity",
          purchase_price AS "purchasePrice",
          expiry_date AS "expiryDate",
          expiry_status AS "expiryStatus",
          disposed_at AS "disposedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM inventory_batches
        WHERE product_id = $1 AND store_id = $2 AND business_id = $3
        ORDER BY expiry_date ASC NULLS LAST, created_at ASC, id ASC
      `,
      [req.params.productId, req.params.storeId, req.user.businessId]
    );

    const today = new Date().toISOString().slice(0, 10);
    const serializedBatches = batchRows.map(buildBatchRow);

    return res.json({
      product: buildProductRow({
        ...product,
        totalStock: serializedBatches.reduce((total, batch) => total + Number(batch.availableQuantity ?? 0), 0),
        sellableStock: serializedBatches.reduce(
          (total, batch) =>
            total +
            (batch.expiryStatus !== 'expired' &&
            batch.expiryStatus !== 'disposed' &&
            (!batch.expiryDate || batch.expiryDate >= today)
              ? Number(batch.availableQuantity ?? 0)
              : 0),
          0
        ),
        expiringSoonBatches: serializedBatches.filter((batch) => batch.expiryStatus === 'expiring_soon').length,
        expiredBatches: serializedBatches.filter((batch) => batch.expiryStatus === 'expired').length
      }),
      batches: serializedBatches
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to load product.'
    });
  }
});

router.patch('/:storeId/products/:productId', auth, writeAccess, async (req, res) => {
  try {
    await validateStoreAccess(req.params.storeId, req.user.businessId);

    const existingProduct = await loadProduct(req.params.productId, req.params.storeId, req.user.businessId);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const fields = [];
    const values = [];
    const addField = (column, value) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };

    const name = getInputValue(req.body, 'name');
    if (name !== undefined) {
      addField('name', String(name).trim() || null);
    }

    const brand = getInputValue(req.body, 'brand');
    if (brand !== undefined) {
      addField('brand', String(brand).trim() || null);
    }

    const sku = getInputValue(req.body, 'sku');
    if (sku !== undefined) {
      addField('sku', String(sku).trim() || null);
    }

    const description = getInputValue(req.body, 'description');
    if (description !== undefined) {
      addField('description', String(description).trim() || null);
    }

    const unitTypeInput = getInputValue(req.body, 'unit_type', 'unitType');
    if (unitTypeInput !== undefined) {
      if (unitTypeInput !== null && !getValidUnitTypes().has(String(unitTypeInput))) {
        return res.status(400).json({ message: 'Invalid unit type.' });
      }
      addField('unit_type', unitTypeInput);
    }

    const unitValueInput = getInputValue(req.body, 'unit_value', 'unitValue');
    if (unitValueInput !== undefined) {
      addField('unit_value', toNumberOrNull(unitValueInput));
    }

    const mrp = getInputValue(req.body, 'mrp');
    if (mrp !== undefined) {
      addField('mrp', toNumberOrNull(mrp));
    }

    const sellingPriceInput = getInputValue(req.body, 'selling_price', 'sellingPrice');
    if (sellingPriceInput !== undefined) {
      const value = toNumberOrNull(sellingPriceInput);
      if (value === null) {
        return res.status(400).json({ message: 'Selling price must be numeric.' });
      }
      addField('selling_price', value);
    }

    const gstRate = getInputValue(req.body, 'gst_rate', 'gstRate');
    if (gstRate !== undefined) {
      addField('gst_rate', toNumberOrNull(gstRate));
    }

    const catalogId = (() => {
      const value = getInputValue(req.body, 'catalog_id', 'catalogId');
      return value ? value : null;
    })();
    if (catalogId !== undefined) {
      if (catalogId && !(await loadCatalogById(catalogId))) {
        return res.status(404).json({ message: 'Catalog item not found.' });
      }
      addField('catalog_id', catalogId);
    }

    const trackExpiry = getInputValue(req.body, 'track_expiry', 'trackExpiry');
    if (trackExpiry !== undefined) {
      addField('track_expiry', typeof trackExpiry === 'boolean' ? trackExpiry : String(trackExpiry).toLowerCase() === 'true');
    }

    const isActive = getInputValue(req.body, 'is_active', 'isActive');
    if (isActive !== undefined) {
      addField('is_active', typeof isActive === 'boolean' ? isActive : String(isActive).toLowerCase() === 'true');
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'At least one field must be provided.' });
    }

    values.push(req.params.productId, req.params.storeId, req.user.businessId);

    const { rows } = await pool.query(
      `
        UPDATE products
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length - 2}
          AND store_id = $${values.length - 1}
          AND business_id = $${values.length}
        RETURNING
          id,
          business_id AS "businessId",
          store_id AS "storeId",
          catalog_id AS "catalogId",
          created_by AS "createdBy",
          name,
          brand,
          sku,
          unit_type AS "unitType",
          unit_value AS "unitValue",
          description,
          mrp,
          selling_price AS "sellingPrice",
          gst_rate AS "gstRate",
          track_expiry AS "trackExpiry",
          is_active AS "isActive",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      values
    );

    return res.json({
      product: buildProductRow({
        ...rows[0],
        totalStock: 0,
        sellableStock: 0,
        expiringSoonBatches: 0,
        expiredBatches: 0
      })
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to update product.'
    });
  }
});

router.post('/:storeId/products/:productId/batches', auth, writeAccess, async (req, res) => {
  try {
    await validateStoreAccess(req.params.storeId, req.user.businessId);

    const product = await loadProduct(req.params.productId, req.params.storeId, req.user.businessId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const quantity = Number(req.body.quantity);
    const purchasePrice = toNumberOrNull(req.body.purchase_price ?? req.body.purchasePrice);
    const batchNumber = String(getInputValue(req.body, 'batch_number', 'batchNumber') ?? '').trim();
    const expiryDate = normalizeBatchDate(getInputValue(req.body, 'expiry_date', 'expiryDate'));

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be a positive integer.' });
    }

    if (purchasePrice === null) {
      return res.status(400).json({ message: 'Purchase price is required.' });
    }

    if (!batchNumber) {
      return res.status(400).json({ message: 'Batch number is required.' });
    }

    if (product.trackExpiry && !expiryDate) {
      return res.status(400).json({
        message: 'Expiry date is required for products that track expiry.'
      });
    }

    const statusResult = await pool.query(
      `
        SELECT CASE
          WHEN $1::date IS NULL THEN 'fresh'
          WHEN $1::date < CURRENT_DATE THEN 'expired'
          WHEN $1::date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          ELSE 'fresh'
        END AS "expiryStatus"
      `,
      [expiryDate]
    );

    const { rows } = await pool.query(
      `
        INSERT INTO inventory_batches (
          business_id,
          store_id,
          product_id,
          created_by,
          batch_number,
          quantity,
          available_quantity,
          purchase_price,
          expiry_date,
          expiry_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9)
        RETURNING
          id,
          business_id AS "businessId",
          store_id AS "storeId",
          product_id AS "productId",
          created_by AS "createdBy",
          batch_number AS "batchNumber",
          quantity,
          available_quantity AS "availableQuantity",
          purchase_price AS "purchasePrice",
          expiry_date AS "expiryDate",
          expiry_status AS "expiryStatus",
          disposed_at AS "disposedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        req.user.businessId,
        req.params.storeId,
        req.params.productId,
        req.user.userId,
        batchNumber,
        quantity,
        purchasePrice,
        expiryDate,
        statusResult.rows[0].expiryStatus
      ]
    );

    return res.status(201).json({
      batch: buildBatchRow(rows[0])
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to add batch.'
    });
  }
});

router.patch('/:storeId/batches/:batchId/dispose', auth, writeAccess, async (req, res) => {
  try {
    await validateStoreAccess(req.params.storeId, req.user.businessId);

    const batch = await loadBatch(req.params.batchId, req.params.storeId, req.user.businessId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found.' });
    }

    const { rows } = await pool.query(
      `
        UPDATE inventory_batches
        SET expiry_status = 'disposed',
            available_quantity = 0,
            disposed_at = COALESCE(disposed_at, NOW()),
            updated_at = NOW()
        WHERE id = $1 AND store_id = $2 AND business_id = $3
        RETURNING
          id,
          business_id AS "businessId",
          store_id AS "storeId",
          product_id AS "productId",
          created_by AS "createdBy",
          batch_number AS "batchNumber",
          quantity,
          available_quantity AS "availableQuantity",
          purchase_price AS "purchasePrice",
          expiry_date AS "expiryDate",
          expiry_status AS "expiryStatus",
          disposed_at AS "disposedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [req.params.batchId, req.params.storeId, req.user.businessId]
    );

    return res.json({ batch: buildBatchRow(rows[0]) });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to dispose batch.'
    });
  }
});

router.get('/:storeId/expiry-alerts', auth, writeAccess, async (req, res) => {
  try {
    await validateStoreAccess(req.params.storeId, req.user.businessId);

    const { rows } = await pool.query(
      `
        SELECT
          ea.id,
          ea.business_id AS "businessId",
          ea.store_id AS "storeId",
          ea.product_id AS "productId",
          ea.batch_id AS "batchId",
          p.name AS "productName",
          b.batch_number AS "batchNumber",
          ea.alert_date AS "alertDate",
          b.expiry_date AS "expiryDate",
          ea.expiry_status AS "expiryStatus",
          ea.message,
          ea.created_at AS "createdAt"
        FROM expiry_alerts ea
        INNER JOIN inventory_batches b ON b.id = ea.batch_id
        INNER JOIN products p ON p.id = ea.product_id
        WHERE ea.store_id = $1 AND ea.business_id = $2
        ORDER BY ea.alert_date DESC, ea.created_at DESC
      `,
      [req.params.storeId, req.user.businessId]
    );

    return res.json({ alerts: rows.map(buildExpiryAlertRow) });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to load expiry alerts.'
    });
  }
});

export default router;
