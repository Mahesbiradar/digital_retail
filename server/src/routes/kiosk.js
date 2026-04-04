import crypto from 'node:crypto';
import express from 'express';
import { pool } from '../lib/postgres.js';
import { redisClient } from '../lib/redis.js';
import { buildRazorpaySignature, getRazorpayClient, verifyRazorpaySignature } from '../lib/razorpay.js';
import { applyStockDeduction, buildReceiptPayload, createPaymentOrder } from './transactions.js';

const router = express.Router();

const kioskSessionTtlSeconds = 60 * 30;

const kioskSessionKey = (sessionId) => `kioskSession:${sessionId}`;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const serializeSession = (session) => JSON.stringify(session);

const parseSession = (value) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const getSessionId = (req) =>
  String(req.get('x-kiosk-session-id') ?? req.body?.sessionId ?? req.query?.sessionId ?? '').trim();

const loadPublicStore = async (storeSlug) => {
  const { rows } = await pool.query(
    `
      SELECT
        s.id,
        s.business_id AS "businessId",
        s.name,
        s.store_slug AS "storeSlug",
        s.is_active AS "isActive",
        s.self_checkout_enabled AS "selfCheckoutEnabled",
        b.name AS "businessName",
        b.gst_enabled AS "gstEnabled",
        b.discount_enabled AS "discountEnabled",
        b.currency_code AS "currencyCode"
      FROM stores s
      INNER JOIN businesses b ON b.id = s.business_id
      WHERE s.store_slug = $1
      LIMIT 1
    `,
    [storeSlug]
  );

  const row = rows[0] ?? null;
  if (!row) {
    return null;
  }

  if (!row.isActive || !row.selfCheckoutEnabled) {
    const error = new Error('Self checkout is disabled for this store.');
    error.statusCode = 403;
    throw error;
  }

  return {
    store: {
      id: row.id,
      businessId: row.businessId,
      name: row.name,
      storeSlug: row.storeSlug,
      isActive: row.isActive,
      selfCheckoutEnabled: row.selfCheckoutEnabled
    },
    business: {
      id: row.businessId,
      name: row.businessName,
      gstEnabled: row.gstEnabled,
      discountEnabled: row.discountEnabled,
      currencyCode: row.currencyCode
    }
  };
};

const loadCartSession = async (sessionId) => {
  const rawSession = await redisClient.get(kioskSessionKey(sessionId));
  return parseSession(rawSession);
};

const saveCartSession = async (session) => {
  const updatedSession = {
    ...session,
    updatedAt: new Date().toISOString()
  };

  await redisClient.set(kioskSessionKey(updatedSession.sessionId), serializeSession(updatedSession), {
    EX: kioskSessionTtlSeconds
  });

  return updatedSession;
};

const sanitizePublicKioskProduct = (row) => ({
  id: row.id,
  name: row.name,
  brand: row.brand,
  sellingPrice: row.sellingPrice,
  imageUrl: row.imageUrl ?? null
});

const sanitizePublicCatalogProduct = (row) => ({
  id: row.id,
  brand: row.brand,
  name: row.name,
  barcode: row.barcode,
  category: row.category,
  unitType: row.unitType,
  unitValue: row.unitValue,
  mrp: row.mrp,
  gstRate: row.gstRate,
  imageUrl: row.imageUrl ?? null
});

const loadProductForKiosk = async (storeId, businessId, productId) => {
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
      WHERE p.id = $1 AND p.store_id = $2 AND p.business_id = $3
      LIMIT 1
    `,
    [productId, storeId, businessId]
  );

  return rows[0] ?? null;
};

const loadCatalogProductByBarcode = async (storeId, businessId, barcode) => {
  const { rows } = await pool.query(
    `
      SELECT
        c.id,
        c.brand,
        c.name,
        c.barcode,
        c.category,
        c.unit_type AS "unitType",
        c.unit_value AS "unitValue",
        c.mrp,
        c.gst_rate AS "gstRate",
        c.image_url AS "imageUrl",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt",
        p.id AS "productId"
      FROM catalog c
      INNER JOIN products p
        ON p.catalog_id = c.id
      WHERE c.barcode = $1
        AND p.store_id = $2
        AND p.business_id = $3
        AND p.is_active = true
      LIMIT 1
    `,
    [barcode, storeId, businessId]
  );

  const catalog = rows[0] ?? null;
  if (!catalog) {
    return null;
  }

  const product = await loadProductForKiosk(storeId, businessId, catalog.productId);

  return product ? { catalog, product } : null;
};

const searchProducts = async (storeId, businessId, q) => {
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
      WHERE p.store_id = $1
        AND p.business_id = $2
        AND p.is_active = true
        AND COALESCE(bs.sellable_stock, 0) > 0
        AND (
          p.name ILIKE $3
          OR COALESCE(p.brand, '') ILIKE $3
          OR COALESCE(p.sku, '') ILIKE $3
        )
      ORDER BY p.name ASC
      LIMIT 12
    `,
    [storeId, businessId, `%${q}%`]
  );

  return rows.map((row) => sanitizePublicKioskProduct(row));
};

const loadBatchRows = async (client, productId, storeId) => {
  const { rows } = await client.query(
    `
      SELECT
        id,
        product_id AS "productId",
        store_id AS "storeId",
        batch_number AS "batchNumber",
        quantity,
        available_quantity AS "availableQuantity",
        purchase_price AS "purchasePrice",
        expiry_date AS "expiryDate",
        expiry_status AS "expiryStatus",
        created_at AS "createdAt"
      FROM inventory_batches
      WHERE product_id = $1
        AND store_id = $2
        AND available_quantity > 0
        AND expiry_status <> 'disposed'
        AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
      ORDER BY expiry_date ASC NULLS LAST, created_at ASC, id ASC
      FOR UPDATE
    `,
    [productId, storeId]
  );

  return rows;
};

const allocateQuantityFromBatches = (batchRows, requestedQuantity) => {
  let remaining = requestedQuantity;
  const allocations = [];

  for (const batch of batchRows) {
    if (remaining <= 0) {
      break;
    }

    const available = toNumber(batch.availableQuantity);
    const quantity = Math.min(available, remaining);

    if (quantity > 0) {
      allocations.push({
        batchId: batch.id,
        quantity,
        batchNumber: batch.batchNumber
      });
      remaining -= quantity;
    }
  }

  if (remaining > 0) {
    const error = new Error('This item is currently unavailable.');
    error.statusCode = 400;
    throw error;
  }

  return allocations;
};

const buildTotals = ({ items, gstEnabled }) => {
  const subtotal = items.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const tax = gstEnabled ? items.reduce((sum, item) => sum + item.lineTaxAmount, 0) : 0;

  return {
    subtotal,
    discount: 0,
    tax,
    total: subtotal + tax
  };
};

const buildCartTotals = (cart, business) => {
  const subtotal = cart.reduce((sum, item) => sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0), 0);
  const tax = business?.gstEnabled
    ? cart.reduce(
        (sum, item) => sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0) * (Number(item.gstRate ?? 0) / 100),
        0
      )
    : 0;

  return {
    subtotal,
    tax,
    total: subtotal + tax
  };
};

const getCartResponse = (session, store, business) => {
  const cart = Array.isArray(session?.cart) ? session.cart : [];
  const totals = buildCartTotals(cart, business);
  const publicCart = cart.map((item) => ({
    productId: item.productId,
    name: item.name,
    brand: item.brand ?? null,
    quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unitPrice ?? 0)
  }));

  return {
    sessionId: session?.sessionId ?? null,
    store,
    business,
    cart: publicCart,
    totals
  };
};

router.post('/:storeSlug/session', async (req, res) => {
  try {
    const publicStore = await loadPublicStore(req.params.storeSlug);
    if (!publicStore) {
      return res.status(404).json({ message: 'Store not found.' });
    }
    const { store, business } = publicStore;

    const existingSessionId = getSessionId(req);
    const existingSession = existingSessionId ? await loadCartSession(existingSessionId) : null;
    const session =
      existingSession && existingSession.storeSlug === store.storeSlug
        ? existingSession
        : {
            sessionId: crypto.randomUUID(),
            storeSlug: store.storeSlug,
            storeId: store.id,
            businessId: store.businessId,
            cart: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

    const savedSession = await saveCartSession(session);

    return res.json({
      ...getCartResponse(savedSession, store, business),
      sessionId: savedSession.sessionId
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to create kiosk session.'
    });
  }
});

router.get('/:storeSlug/search', async (req, res) => {
  try {
    const publicStore = await loadPublicStore(req.params.storeSlug);
    if (!publicStore) {
      return res.status(404).json({ message: 'Store not found.' });
    }
    const { store, business } = publicStore;

    const q = String(req.query.q ?? '').trim();
    if (!q) {
      return res.json({ products: [] });
    }

    const products = await searchProducts(store.id, store.businessId, q);
    return res.json({ products });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to search products.'
    });
  }
});

router.get('/:storeSlug/barcode/:code', async (req, res) => {
  try {
    const publicStore = await loadPublicStore(req.params.storeSlug);
    if (!publicStore) {
      return res.status(404).json({ message: 'Store not found.' });
    }
    const { store } = publicStore;

    const code = String(req.params.code ?? '').trim();
    if (!code) {
      return res.status(404).json({ status: 'NOT_FOUND' });
    }

    const match = await loadCatalogProductByBarcode(store.id, store.businessId, code);
    if (!match) {
      return res.status(404).json({ status: 'NOT_FOUND' });
    }

    return res.json({
      catalog: sanitizePublicCatalogProduct(match.catalog),
      product: sanitizePublicKioskProduct(match.product)
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to look up barcode.'
    });
  }
});

router.get('/:storeSlug/cart', async (req, res) => {
  try {
    const publicStore = await loadPublicStore(req.params.storeSlug);
    if (!publicStore) {
      return res.status(404).json({ message: 'Store not found.' });
    }
    const { store, business } = publicStore;

    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(400).json({ message: 'Session is required.' });
    }

    const session = await loadCartSession(sessionId);
    if (!session || session.storeSlug !== store.storeSlug) {
      return res.status(404).json({ message: 'Kiosk session not found.' });
    }

    return res.json(getCartResponse(session, store, business));
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to load cart.'
    });
  }
});

router.post('/:storeSlug/cart/add', async (req, res) => {
  try {
    const publicStore = await loadPublicStore(req.params.storeSlug);
    if (!publicStore) {
      return res.status(404).json({ message: 'Store not found.' });
    }
    const { store, business } = publicStore;

    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(400).json({ message: 'Session is required.' });
    }

    const session = await loadCartSession(sessionId);
    if (!session || session.storeSlug !== store.storeSlug) {
      return res.status(404).json({ message: 'Kiosk session not found.' });
    }

    const productId = String(req.body.productId ?? '').trim();
    const quantity = Math.max(1, Math.floor(Number(req.body.quantity ?? 1)));

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Product and quantity are required.' });
    }

    const product = await loadProductForKiosk(store.id, store.businessId, productId);
    if (!product || !product.isActive || Number(product.sellableStock ?? 0) <= 0) {
      return res.status(400).json({ message: 'This item is currently unavailable.' });
    }

    const cart = Array.isArray(session.cart) ? [...session.cart] : [];
    const existingItem = cart.find((item) => item.productId === product.id);
    const existingQuantity = Number(existingItem?.quantity ?? 0);
    const nextQuantity = existingQuantity + quantity;

    if (nextQuantity > Number(product.sellableStock ?? 0)) {
      return res.status(400).json({ message: 'Not enough stock available.' });
    }

    if (existingItem) {
      existingItem.quantity = nextQuantity;
    } else {
        cart.push({
          productId: product.id,
          name: product.name,
          brand: product.brand,
          sku: product.sku,
          catalogId: product.catalogId,
          unitPrice: Number(product.sellingPrice ?? 0),
          quantity,
          imageUrl: product.imageUrl ?? null
        });
      }

    const savedSession = await saveCartSession({
      ...session,
      cart
    });

    return res.json({
      ...getCartResponse(savedSession, store, business)
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to add item to cart.'
    });
  }
});

router.post('/:storeSlug/cart/remove', async (req, res) => {
  try {
    const publicStore = await loadPublicStore(req.params.storeSlug);
    if (!publicStore) {
      return res.status(404).json({ message: 'Store not found.' });
    }
    const { store, business } = publicStore;

    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(400).json({ message: 'Session is required.' });
    }

    const session = await loadCartSession(sessionId);
    if (!session || session.storeSlug !== store.storeSlug) {
      return res.status(404).json({ message: 'Kiosk session not found.' });
    }

    const productId = String(req.body.productId ?? '').trim();
    const quantity = Math.max(1, Math.floor(Number(req.body.quantity ?? 1)));

    if (!productId) {
      return res.status(400).json({ message: 'Product is required.' });
    }

    const cart = Array.isArray(session.cart) ? [...session.cart] : [];
    const index = cart.findIndex((item) => item.productId === productId);

    if (index >= 0) {
      const item = { ...cart[index] };
      const nextQuantity = Number(item.quantity ?? 0) - quantity;

      if (nextQuantity > 0) {
        cart[index] = { ...item, quantity: nextQuantity };
      } else {
        cart.splice(index, 1);
      }
    }

    const savedSession = await saveCartSession({
      ...session,
      cart
    });

    return res.json({
      ...getCartResponse(savedSession, store, business)
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to remove item from cart.'
    });
  }
});

router.post('/:storeSlug/checkout', async (req, res) => {
  const client = await pool.connect();

  try {
    const publicStore = await loadPublicStore(req.params.storeSlug);
    if (!publicStore) {
      return res.status(404).json({ message: 'Store not found.' });
    }
    const { store, business } = publicStore;

    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(400).json({ message: 'Session is required.' });
    }

    const session = await loadCartSession(sessionId);
    if (!session || session.storeSlug !== store.storeSlug) {
      return res.status(404).json({ message: 'Kiosk session not found.' });
    }

    const cart = Array.isArray(session.cart) ? session.cart : [];
    if (cart.length === 0) {
      return res.status(400).json({ message: 'Add at least one item before checkout.' });
    }

    const processedItems = [];
    const allocationsByBatchId = new Map();
    const allocationRows = [];

    await client.query('BEGIN');

    for (const item of cart) {
      const product = await loadProductForKiosk(store.id, store.businessId, item.productId);
      const quantity = Math.max(1, Math.floor(Number(item.quantity ?? 0)));
      const unitPrice = Number(product?.sellingPrice ?? 0);

      if (!product || !product.isActive || quantity <= 0 || Number(product.sellableStock ?? 0) <= 0) {
        const error = new Error('This item is currently unavailable.');
        error.statusCode = 400;
        throw error;
      }

      const batchRows = await loadBatchRows(client, product.id, store.id);
      const allocations = allocateQuantityFromBatches(batchRows, quantity);

      const lineSubtotal = quantity * unitPrice;
      const lineTaxAmount =
        business.gstEnabled && Number(product.gstRate ?? 0) > 0
          ? Number(((lineSubtotal * Number(product.gstRate)) / 100).toFixed(2))
          : 0;

      processedItems.push({
        product,
        quantity,
        unitPrice,
        lineSubtotal,
        lineTaxAmount,
        allocations
      });

      for (const allocation of allocations) {
        allocationRows.push({
          productId: product.id,
          productNameSnapshot: product.name,
          batchId: allocation.batchId,
          quantity: allocation.quantity,
          unitPrice,
          lineDiscountAmount: 0,
          lineTaxAmount: lineTaxAmount * (allocation.quantity / quantity),
          lineTotalAmount: allocation.quantity * unitPrice + lineTaxAmount * (allocation.quantity / quantity)
        });

        allocationsByBatchId.set(
          allocation.batchId,
          (allocationsByBatchId.get(allocation.batchId) ?? 0) + allocation.quantity
        );
      }
    }

    const totals = buildTotals({
      items: processedItems,
      gstEnabled: business.gstEnabled
    });

    const transactionNumber = `KIOSK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;
    const paymentOrder = await createPaymentOrder({
      amount: totals.total,
      transactionNumber,
      businessName: business.name,
      storeName: store.name
    });

    const { rows: transactionRows } = await client.query(
      `
        INSERT INTO transactions (
          business_id,
          store_id,
          created_by,
          transaction_number,
          initiated_by,
          status,
          payment_method,
          payment_status,
          currency_code,
          subtotal_amount,
          discount_amount,
          tax_amount,
          total_amount,
          notes
        )
        VALUES (
          $1, $2, NULL, $3, 'customer_kiosk', 'pending', 'upi', 'pending', $4,
          $5, 0, $6, $7, $8
        )
        RETURNING
          id,
          business_id AS "businessId",
          store_id AS "storeId",
          created_by AS "createdBy",
          transaction_number AS "transactionNumber",
          initiated_by AS "initiatedBy",
          status,
          payment_method AS "paymentMethod",
          payment_status AS "paymentStatus",
          currency_code AS "currencyCode",
          subtotal_amount AS "subtotalAmount",
          discount_amount AS "discountAmount",
          tax_amount AS "taxAmount",
          total_amount AS "totalAmount",
          notes,
          completed_at AS "completedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        store.businessId,
        store.id,
        transactionNumber,
        business.currencyCode,
        totals.subtotal,
        totals.tax,
        totals.total,
        JSON.stringify({ kioskSessionId: sessionId, source: 'kiosk' })
      ]
    );

    const transaction = transactionRows[0];

    for (const row of allocationRows) {
      await client.query(
        `
          INSERT INTO transaction_items (
            transaction_id,
            business_id,
            store_id,
            product_id,
            batch_id,
            product_name_snapshot,
            quantity,
            unit_price,
            line_discount_amount,
            line_tax_amount,
            line_total_amount
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          transaction.id,
          store.businessId,
          store.id,
          row.productId,
          row.batchId,
          row.productNameSnapshot,
          row.quantity,
          row.unitPrice,
          row.lineDiscountAmount,
          row.lineTaxAmount,
          row.lineTotalAmount
        ]
      );
    }

    const payment = (
      await client.query(
        `
          INSERT INTO payments (
            business_id,
            store_id,
            transaction_id,
            method,
            provider,
            status,
            amount,
            currency_code,
            provider_order_id,
            metadata
          )
          VALUES ($1, $2, $3, 'upi', $4, 'pending', $5, $6, $7, $8::jsonb)
          RETURNING
            id,
            business_id AS "businessId",
            store_id AS "storeId",
            transaction_id AS "transactionId",
            method,
            provider,
            status,
            amount,
            currency_code AS "currencyCode",
            provider_order_id AS "providerOrderId",
            provider_payment_id AS "providerPaymentId",
            provider_signature AS "providerSignature",
            metadata,
            paid_at AS "paidAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          store.businessId,
          store.id,
          transaction.id,
          paymentOrder.provider,
          totals.total,
          business.currencyCode,
          paymentOrder.orderId,
          JSON.stringify({ provider: paymentOrder.provider, mode: paymentOrder.mode ?? 'live', source: 'kiosk' })
        ]
      )
    ).rows[0];

    await client.query('COMMIT');

    return res.status(201).json({
      transaction,
      items: allocationRows,
      payment,
      paymentOrder,
      sessionId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to create kiosk checkout.'
    });
  } finally {
    client.release();
  }
});

router.post('/:storeSlug/confirm', async (req, res) => {
  const transactionId = String(req.body.transactionId ?? '').trim();
  const orderId = String(req.body.razorpay_order_id ?? req.body.orderId ?? '').trim();
  const paymentId = String(req.body.razorpay_payment_id ?? req.body.paymentId ?? '').trim();
  const signature = String(req.body.razorpay_signature ?? req.body.signature ?? '').trim();
  const sessionId = getSessionId(req);

  if (!transactionId || !orderId || !paymentId) {
    return res.status(400).json({
      message: 'Transaction, order, and payment identifiers are required.'
    });
  }

  const client = await pool.connect();

  try {
    const publicStore = await loadPublicStore(req.params.storeSlug);
    if (!publicStore) {
      return res.status(404).json({ message: 'Store not found.' });
    }
    const { store, business } = publicStore;

    await client.query('BEGIN');

    const transactionResult = await client.query(
      `
        SELECT
          id,
          business_id AS "businessId",
          store_id AS "storeId",
          status,
          payment_status AS "paymentStatus",
          payment_method AS "paymentMethod",
          total_amount AS "totalAmount"
        FROM transactions
        WHERE id = $1 AND store_id = $2 AND business_id = $3
        LIMIT 1
      `,
      [transactionId, store.id, store.businessId]
    );

    const transaction = transactionResult.rows[0];
    if (!transaction) {
      const error = new Error('Transaction not found.');
      error.statusCode = 404;
      throw error;
    }

    if (transaction.paymentStatus === 'paid' || transaction.status === 'completed') {
      await client.query('COMMIT');
      const receipt = await buildReceiptPayload(transactionId);
      if (sessionId) {
        await redisClient.del(kioskSessionKey(sessionId));
      }
      return res.json({ transaction: receipt.transaction, payment: receipt.payment, alreadyVerified: true });
    }

    const paymentResult = await client.query(
      `
        SELECT
          id,
          provider_order_id AS "providerOrderId",
          provider_payment_id AS "providerPaymentId",
          provider_signature AS "providerSignature",
          status,
          metadata
        FROM payments
        WHERE transaction_id = $1
        LIMIT 1
      `,
      [transactionId]
    );

    const payment = paymentResult.rows[0];
    if (!payment) {
      const error = new Error('Payment not found.');
      error.statusCode = 404;
      throw error;
    }

    if (payment.providerOrderId !== orderId) {
      const error = new Error('Order ID does not match the pending payment.');
      error.statusCode = 400;
      throw error;
    }

    const isMockPayment = payment.providerOrderId.startsWith('order_mock_');

    if (!isMockPayment) {
      const signatureValid = verifyRazorpaySignature({
        orderId,
        paymentId,
        signature: signature || undefined
      });

      if (!signatureValid && getRazorpayClient()) {
        const error = new Error('Invalid Razorpay signature.');
        error.statusCode = 400;
        throw error;
      }
    }

    const itemsResult = await client.query(
      `
        SELECT
          id,
          product_id AS "productId",
          batch_id AS "batchId",
          quantity
        FROM transaction_items
        WHERE transaction_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [transactionId]
    );

    const allocationsByBatchId = new Map();
    for (const item of itemsResult.rows) {
      allocationsByBatchId.set(
        item.batchId,
        (allocationsByBatchId.get(item.batchId) ?? 0) + Number(item.quantity)
      );
    }

    await applyStockDeduction(client, allocationsByBatchId);

    await client.query(
      `
        UPDATE transactions
        SET status = 'completed',
            payment_status = 'paid',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [transactionId]
    );

    await client.query(
      `
        UPDATE payments
        SET status = 'paid',
            provider_payment_id = $2,
            provider_signature = $3,
            paid_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        payment.id,
        paymentId,
        signature || (isMockPayment ? `mock_signature_${paymentId}` : buildRazorpaySignature(orderId, paymentId))
      ]
    );

    await client.query('COMMIT');

    const receipt = await buildReceiptPayload(transactionId);
    const io = req.app.get('io');
    if (io) {
      io.to(`store:${transaction.storeId}`).emit('kiosk_transaction', {
        event: 'kiosk_transaction',
        storeName: store.name,
        businessName: business.name,
        transaction: receipt.transaction,
        payment: receipt.payment,
        items: receipt.items
      });
    }

    if (sessionId) {
      await redisClient.del(kioskSessionKey(sessionId));
    }

    return res.json({
      transaction: receipt.transaction,
      payment: receipt.payment,
      items: receipt.items
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to verify kiosk payment.'
    });
  } finally {
    client.release();
  }
});

export default router;
