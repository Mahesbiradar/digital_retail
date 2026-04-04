import crypto from 'node:crypto';
import QRCode from 'qrcode';
import express from 'express';
import { env } from '../config/env.js';
import { pool } from '../lib/postgres.js';
import { getRazorpayClient } from '../lib/razorpay.js';
import { auth } from '../middleware/auth.js';
import { storeAccess } from '../middleware/storeAccess.js';

const router = express.Router();
const billingAccess = storeAccess(['owner', 'manager', 'cashier']);

const transactionSelect = `
  SELECT
    t.id,
    t.business_id AS "businessId",
    t.store_id AS "storeId",
    t.created_by AS "createdBy",
    t.transaction_number AS "transactionNumber",
    t.initiated_by AS "initiatedBy",
    t.status,
    t.payment_method AS "paymentMethod",
    t.payment_status AS "paymentStatus",
    t.currency_code AS "currencyCode",
    t.subtotal_amount AS "subtotalAmount",
    t.discount_amount AS "discountAmount",
    t.tax_amount AS "taxAmount",
    t.total_amount AS "totalAmount",
    t.notes,
    t.completed_at AS "completedAt",
    t.created_at AS "createdAt",
    t.updated_at AS "updatedAt",
    b.name AS "businessName",
    b.gst_enabled AS "gstEnabled",
    b.discount_enabled AS "discountEnabled"
  FROM transactions t
  INNER JOIN businesses b ON b.id = t.business_id
`;

const transactionItemSelect = `
  SELECT
    ti.id,
    ti.transaction_id AS "transactionId",
    ti.business_id AS "businessId",
    ti.store_id AS "storeId",
    ti.product_id AS "productId",
    ti.batch_id AS "batchId",
    ti.product_name_snapshot AS "productNameSnapshot",
    ti.quantity,
    ti.unit_price AS "unitPrice",
    ti.line_discount_amount AS "lineDiscountAmount",
    ti.line_tax_amount AS "lineTaxAmount",
    ti.line_total_amount AS "lineTotalAmount",
    ti.created_at AS "createdAt"
  FROM transaction_items ti
`;

const paymentSelect = `
  SELECT
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
  FROM payments
`;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const generateTransactionNumber = () =>
  `TX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export const getStoreBusinessAndAccess = async (storeId, businessId) => {
  const { rows } = await pool.query(
    `
      SELECT s.id, s.business_id AS "businessId", s.name, s.store_slug AS "storeSlug",
             b.name AS "businessName", b.gst_enabled AS "gstEnabled",
             b.discount_enabled AS "discountEnabled", b.currency_code AS "currencyCode"
      FROM stores s
      INNER JOIN businesses b ON b.id = s.business_id
      WHERE s.id = $1 AND s.business_id = $2
      LIMIT 1
    `,
    [storeId, businessId]
  );

  return rows[0] ?? null;
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

const loadBatchRowSet = async (client, productId, storeId) => {
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

const buildTotals = ({ items, discountAmount, gstEnabled, discountEnabled }) => {
  const subtotal = items.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const discount = discountEnabled ? discountAmount : 0;
  const taxableBase = Math.max(subtotal - discount, 0);
  const tax = gstEnabled ? items.reduce((sum, item) => sum + item.lineTaxAmount, 0) : 0;
  const total = taxableBase + tax;

  return {
    subtotal,
    discount,
    tax,
    total
  };
};

export const buildReceiptPayload = async (transactionId) => {
  const transaction = await pool.query(
    `${transactionSelect} WHERE t.id = $1 LIMIT 1`,
    [transactionId]
  );

  if (transaction.rows.length === 0) {
    return null;
  }

  const items = await pool.query(
    `${transactionItemSelect} WHERE ti.transaction_id = $1 ORDER BY ti.created_at ASC, ti.id ASC`,
    [transactionId]
  );

  const payment = await pool.query(`${paymentSelect} WHERE transaction_id = $1 LIMIT 1`, [transactionId]);

  return {
    transaction: transaction.rows[0],
    items: items.rows,
    payment: payment.rows[0] ?? null
  };
};

export const applyStockDeduction = async (client, allocationsByBatchId) => {
  for (const [batchId, quantity] of allocationsByBatchId.entries()) {
    const { rowCount } = await client.query(
      `
        UPDATE inventory_batches
        SET available_quantity = available_quantity - $2,
            updated_at = NOW()
        WHERE id = $1
          AND available_quantity >= $2
          AND expiry_status <> 'disposed'
      `,
      [batchId, quantity]
    );

    if (rowCount === 0) {
      const error = new Error('This item is currently unavailable.');
      error.statusCode = 400;
      throw error;
    }
  }
};

export const createPaymentOrder = async ({ amount, transactionNumber, businessName, storeName }) => {
  const razorpay = getRazorpayClient();
  const amountPaise = Math.round(amount * 100);

  if (razorpay) {
    try {
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: transactionNumber,
        notes: {
          businessName,
          storeName,
          source: 'pos'
        }
      });

      return {
        provider: 'razorpay',
        mode: 'live',
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        upiQrDataUrl: await QRCode.toDataURL(
          `upi://pay?pa=${encodeURIComponent(env.RAZORPAY_KEY_ID || 'merchant@upi')}&pn=${encodeURIComponent(
            businessName
          )}&am=${(order.amount / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNumber)}`,
          {
            type: 'image/png',
            margin: 1,
            width: 384
          }
        )
      };
    } catch (error) {
      if (env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('Razorpay is required in production.');
  }

  const mockOrderId = `order_mock_${crypto.randomBytes(6).toString('hex')}`;
  return {
    provider: 'razorpay',
    mode: 'mock',
    orderId: mockOrderId,
    amount: amountPaise,
    currency: 'INR',
    upiQrDataUrl: await QRCode.toDataURL(
      `upi://pay?pa=${encodeURIComponent(env.RAZORPAY_KEY_ID || 'merchant@upi')}&pn=${encodeURIComponent(
        businessName
      )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNumber)}`,
      {
        type: 'image/png',
        margin: 1,
        width: 384
      }
    )
  };
};

router.post('/:storeId/transactions', auth, billingAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    const store = await getStoreBusinessAndAccess(req.params.storeId, req.user.businessId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found.' });
    }

    const paymentMethod = String(req.body.paymentMethod ?? '').trim().toLowerCase();
    const initiatedByInput = String(req.body.initiatedBy ?? '').trim().toLowerCase();
    const requestedDiscount = toNumber(req.body.discountAmount, 0);
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!['cash', 'upi'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Payment method must be cash or upi.' });
    }

    if (items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required.' });
    }

    if (requestedDiscount < 0) {
      return res.status(400).json({ message: 'Discount amount cannot be negative.' });
    }

    if (!store.discountEnabled && requestedDiscount > 0) {
      return res.status(400).json({ message: 'Discounts are disabled for this business.' });
    }

    const initiatedBy =
      req.user.role === 'owner'
        ? initiatedByInput === 'cashier'
          ? 'cashier'
          : 'owner'
        : 'cashier';

    if (!['owner', 'cashier'].includes(initiatedBy)) {
      return res.status(400).json({ message: 'Invalid initiatedBy value.' });
    }

    const processedItems = [];
    const allocationsByBatchId = new Map();
    const allocationRows = [];

    await client.query('BEGIN');

    for (const rawItem of items) {
      const productId = String(rawItem.productId ?? '').trim();
      const quantity = Number(rawItem.quantity);

      if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
        const error = new Error('Invalid transaction item.');
        error.statusCode = 400;
        throw error;
      }

      const product = await loadProduct(productId, req.params.storeId, req.user.businessId);
      if (!product || !product.isActive) {
        const error = new Error('This item is currently unavailable.');
        error.statusCode = 400;
        throw error;
      }

      const unitPrice = Number(product.sellingPrice ?? 0);

      const batchRows = await loadBatchRowSet(client, productId, req.params.storeId);
      const allocations = allocateQuantityFromBatches(batchRows, quantity);

      const lineSubtotal = quantity * unitPrice;
      const lineTaxAmount = store.gstEnabled && Number(product.gstRate ?? 0) > 0
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
          productId,
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
      discountAmount: requestedDiscount,
      gstEnabled: store.gstEnabled,
      discountEnabled: store.discountEnabled
    });

    if (requestedDiscount > totals.subtotal) {
      const error = new Error('Discount cannot exceed the subtotal.');
      error.statusCode = 400;
      throw error;
    }

    const transactionNumber = generateTransactionNumber();
    const transactionStatus = paymentMethod === 'cash' ? 'completed' : 'pending';
    const paymentStatus = paymentMethod === 'cash' ? 'paid' : 'pending';

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
          completed_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          CASE WHEN $6::transaction_status = 'completed' THEN NOW() ELSE NULL END
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
        req.user.businessId,
        req.params.storeId,
        req.user.userId,
        transactionNumber,
        initiatedBy,
        transactionStatus,
        paymentMethod,
        paymentStatus,
        store.currencyCode,
        totals.subtotal,
        totals.discount,
        totals.tax,
        totals.total
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
          req.user.businessId,
          req.params.storeId,
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

    let payment = null;
    let paymentOrder = null;

    if (paymentMethod === 'cash') {
      await applyStockDeduction(client, allocationsByBatchId);

      payment = (
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
              metadata,
              paid_at
            )
            VALUES ($1, $2, $3, 'cash', 'cash', 'paid', $4, $5, '{}'::jsonb, NOW())
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
          [req.user.businessId, req.params.storeId, transaction.id, totals.total, store.currencyCode]
        )
      ).rows[0];
    } else {
      paymentOrder = await createPaymentOrder({
        amount: totals.total,
        transactionNumber,
        businessName: store.businessName,
        storeName: store.name
      });

      payment = (
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
            req.user.businessId,
            req.params.storeId,
            transaction.id,
            paymentOrder.provider,
            totals.total,
            store.currencyCode,
            paymentOrder.orderId,
            JSON.stringify({ provider: paymentOrder.provider, mode: paymentOrder.mode ?? 'live' })
          ]
        )
      ).rows[0];
    }

    await client.query('COMMIT');

    const payload = {
      transaction,
      items: allocationRows,
      payment
    };

    if (paymentOrder) {
      payload.paymentOrder = paymentOrder;
    }

    const io = req.app.get('io');
    if (io && transactionStatus === 'completed') {
      io.to(`store:${req.params.storeId}`).emit('pos_transaction', {
        event: 'pos_transaction',
        transaction
      });
    }

    return res.status(201).json(payload);
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to create transaction.'
    });
  } finally {
    client.release();
  }
});

router.get('/:storeId/transactions/:txId', auth, billingAccess, async (req, res) => {
  try {
    const store = await getStoreBusinessAndAccess(req.params.storeId, req.user.businessId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found.' });
    }

    const receipt = await buildReceiptPayload(req.params.txId);
    if (!receipt || receipt.transaction.storeId !== req.params.storeId) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    return res.json({
      ...receipt,
      store
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to load receipt.'
    });
  }
});

export default router;
