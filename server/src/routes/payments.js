import express from 'express';
import { env } from '../config/env.js';
import { pool } from '../lib/postgres.js';
import { buildRazorpaySignature, getRazorpayClient, verifyRazorpaySignature } from '../lib/razorpay.js';
import { auth } from '../middleware/auth.js';
import { applyStockDeduction, buildReceiptPayload } from './transactions.js';

const router = express.Router();

router.post('/razorpay/verify', auth, async (req, res) => {
  const transactionId = String(req.body.transactionId ?? '').trim();
  const orderId = String(req.body.razorpay_order_id ?? req.body.orderId ?? '').trim();
  const paymentId = String(req.body.razorpay_payment_id ?? req.body.paymentId ?? '').trim();
  const signature = String(req.body.razorpay_signature ?? req.body.signature ?? '').trim();

  if (!transactionId || !orderId || !paymentId) {
    return res.status(400).json({
      message: 'Transaction, order, and payment identifiers are required.'
    });
  }

  const client = await pool.connect();

  try {
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
        WHERE id = $1
        LIMIT 1
      `,
      [transactionId]
    );

    const transaction = transactionResult.rows[0];
    if (!transaction) {
      const error = new Error('Transaction not found.');
      error.statusCode = 404;
      throw error;
    }

    if (req.user.role !== 'owner') {
      const { rows: accessRows } = await client.query(
        `
          SELECT 1
          FROM store_employees
          WHERE store_id = $1
            AND business_id = $2
            AND user_id = $3
          LIMIT 1
        `,
        [transaction.storeId, req.user.businessId, req.user.userId]
      );

      if (accessRows.length === 0) {
        const error = new Error('You do not have access to this store.');
        error.statusCode = 403;
        throw error;
      }
    }

    if (transaction.paymentStatus === 'paid' || transaction.status === 'completed') {
      await client.query('COMMIT');
      const receipt = await buildReceiptPayload(transactionId);
      return res.json({ transaction: receipt.transaction, payment: receipt.payment, alreadyVerified: true });
    }

    const paymentResult = await client.query(
      `
        SELECT
          id,
          provider_order_id AS "providerOrderId",
          provider_payment_id AS "providerPaymentId",
          provider_signature AS "providerSignature",
          status
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

    const isMockPayment = payment.status === 'pending' && payment.providerOrderId.startsWith('order_mock_');

    if (isMockPayment && env.NODE_ENV === 'production') {
      const error = new Error('Mock payments are not allowed in production.');
      error.statusCode = 400;
      throw error;
    }

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
      io.to(`store:${transaction.storeId}`).emit('pos_transaction', {
        event: 'pos_transaction',
        transaction: receipt.transaction
      });
    }

    return res.json({
      transaction: receipt.transaction,
      payment: receipt.payment,
      items: receipt.items
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(error.statusCode ?? 500).json({
      message: error.message ?? 'Unable to verify payment.'
    });
  } finally {
    client.release();
  }
});

export default router;
