import express from 'express';
import { pool } from '../lib/postgres.js';
import { auth } from '../middleware/auth.js';
import { roleCheck } from '../middleware/roleCheck.js';

const router = express.Router();

const lowStockThreshold = 5;

const buildProductStatsQuery = `
  SELECT
    p.id,
    p.name,
    p.brand,
    p.sku,
    p.unit_type AS "unitType",
    p.unit_value AS "unitValue",
    p.mrp,
    p.selling_price AS "sellingPrice",
    p.gst_rate AS "gstRate",
    p.track_expiry AS "trackExpiry",
    p.is_active AS "isActive",
    p.created_at AS "createdAt",
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
  WHERE p.business_id = $1
`;

const buildSalesSeries = async (businessId, days) => {
  const { rows } = await pool.query(
    `
      WITH day_series AS (
        SELECT generate_series(
          (CURRENT_DATE - ($2 - 1) * INTERVAL '1 day')::date,
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT
        day_series.day AS "day",
        COALESCE(SUM(t.total_amount), 0) AS "salesAmount",
        COALESCE(COUNT(t.id), 0) AS "transactionCount"
      FROM day_series
      LEFT JOIN transactions t
        ON t.business_id = $1
       AND t.status = 'completed'
       AND t.completed_at::date = day_series.day
      GROUP BY day_series.day
      ORDER BY day_series.day ASC
    `,
    [businessId, days]
  );

  return rows;
};

router.get('/dashboard-summary', auth, roleCheck('owner'), async (req, res) => {
  const businessId = req.user.businessId;

  const [summaryResult, activeResult, lowStockResult] = await Promise.all([
    pool.query(
      `
        SELECT
          (SELECT COUNT(*) FROM stores WHERE business_id = $1) AS "storeCount",
          (SELECT COUNT(*) FROM products WHERE business_id = $1) AS "productCount",
          (SELECT COUNT(*) FROM products WHERE business_id = $1 AND is_active = true) AS "activeProductCount",
          COALESCE((SELECT COUNT(*) FROM transactions WHERE business_id = $1 AND status = 'completed' AND completed_at::date = CURRENT_DATE), 0) AS "transactionsToday",
          COALESCE((SELECT SUM(total_amount) FROM transactions WHERE business_id = $1 AND status = 'completed' AND completed_at::date = CURRENT_DATE), 0) AS "salesToday",
          COALESCE((SELECT COUNT(*) FROM transactions WHERE business_id = $1 AND status = 'completed' AND initiated_by = 'customer_kiosk' AND completed_at::date = CURRENT_DATE), 0) AS "kioskTransactionsToday",
          COALESCE((SELECT COUNT(*) FROM inventory_batches WHERE business_id = $1 AND expiry_status = 'expiring_soon'), 0) AS "expiringSoonBatches",
          COALESCE((SELECT COUNT(*) FROM inventory_batches WHERE business_id = $1 AND expiry_status = 'expired'), 0) AS "expiredBatches"
      `,
      [businessId]
    ),
    pool.query(
      `
        SELECT
          COALESCE(SUM(t.total_amount), 0) AS "salesLast30Days",
          COALESCE(COUNT(t.id), 0) AS "transactionsLast30Days"
        FROM transactions t
        WHERE t.business_id = $1
          AND t.status = 'completed'
          AND t.completed_at >= CURRENT_DATE - INTERVAL '30 days'
      `,
      [businessId]
    ),
    pool.query(
      `
        SELECT COUNT(*) AS "lowStockProductCount"
        FROM (
          ${buildProductStatsQuery}
        ) product_stats
        WHERE product_stats."sellableStock" <= $2
      `,
      [businessId, lowStockThreshold]
    )
  ]);

  return res.json({
    summary: {
      ...summaryResult.rows[0],
      ...activeResult.rows[0],
      ...lowStockResult.rows[0]
    },
    salesSeries: await buildSalesSeries(businessId, 14),
    lowStockThreshold
  });
});

router.get('/sales', auth, roleCheck('owner'), async (req, res) => {
  const businessId = req.user.businessId;
  const days = Math.max(7, Math.min(90, Number(req.query.days ?? 30) || 30));

  const [series, totals] = await Promise.all([
    buildSalesSeries(businessId, days),
    pool.query(
      `
        SELECT
          COALESCE(SUM(total_amount), 0) AS "salesTotal",
          COALESCE(COUNT(id), 0) AS "transactionCount",
          COALESCE(AVG(total_amount), 0) AS "averageTicket"
        FROM transactions
        WHERE business_id = $1
          AND status = 'completed'
          AND completed_at >= CURRENT_DATE - ($2 - 1) * INTERVAL '1 day'
      `,
      [businessId, days]
    )
  ]);

  return res.json({
    days,
    totals: totals.rows[0],
    series
  });
});

router.get('/stock-expiry', auth, roleCheck('owner'), async (req, res) => {
  const businessId = req.user.businessId;

  const [productsResult, batchesResult] = await Promise.all([
    pool.query(
      `
        SELECT
          *
        FROM (
          ${buildProductStatsQuery}
        ) product_stats
        ORDER BY product_stats."sellableStock" ASC, product_stats.name ASC
        LIMIT 25
      `,
      [businessId]
    ),
    pool.query(
      `
        SELECT
          b.id,
          b.product_id AS "productId",
          p.name AS "productName",
          p.brand AS "brand",
          b.batch_number AS "batchNumber",
          b.quantity,
          b.available_quantity AS "availableQuantity",
          b.purchase_price AS "purchasePrice",
          b.expiry_date AS "expiryDate",
          b.expiry_status AS "expiryStatus",
          b.created_at AS "createdAt"
        FROM inventory_batches b
        INNER JOIN products p ON p.id = b.product_id
        WHERE b.business_id = $1
          AND b.expiry_status IN ('expiring_soon', 'expired')
        ORDER BY b.expiry_status DESC, b.expiry_date ASC NULLS LAST, b.created_at DESC
        LIMIT 25
      `,
      [businessId]
    )
  ]);

  return res.json({
    products: productsResult.rows.map((row) => ({
      ...row,
      status:
        Number(row.sellableStock) <= 0
          ? 'out_of_stock'
          : Number(row.sellableStock) <= lowStockThreshold
            ? 'low_stock'
            : Number(row.expiringSoonBatches) > 0
              ? 'expiring_soon'
              : 'healthy'
    })),
    batches: batchesResult.rows
  });
});

router.get('/gst', auth, roleCheck('owner'), async (req, res) => {
  const businessId = req.user.businessId;

  const businessResult = await pool.query(
    `
      SELECT id, name, gst_enabled AS "gstEnabled"
      FROM businesses
      WHERE id = $1
      LIMIT 1
    `,
    [businessId]
  );

  const business = businessResult.rows[0] ?? null;
  if (!business) {
    return res.status(404).json({ message: 'Business not found.' });
  }

  if (!business.gstEnabled) {
    return res.status(403).json({
      message: 'GST reporting is disabled until GST is enabled for this business.'
    });
  }

  const [summaryResult, rateRows, itemRows] = await Promise.all([
    pool.query(
      `
        SELECT
          COALESCE(SUM(t.total_amount), 0) AS "grossSales",
          COALESCE(SUM(t.tax_amount), 0) AS "gstCollected",
          COALESCE(SUM(t.total_amount - t.tax_amount), 0) AS "taxableSales",
          COALESCE(COUNT(t.id), 0) AS "completedTransactions"
        FROM transactions t
        WHERE t.business_id = $1
          AND t.status = 'completed'
      `,
      [businessId]
    ),
    pool.query(
      `
        SELECT
          COALESCE(p.gst_rate, 0) AS "gstRate",
          COALESCE(SUM(ti.quantity), 0) AS "unitsSold",
          COALESCE(SUM(ti.line_total_amount - ti.line_tax_amount), 0) AS "taxableAmount",
          COALESCE(SUM(ti.line_tax_amount), 0) AS "gstAmount",
          COALESCE(SUM(ti.line_total_amount), 0) AS "grossAmount"
        FROM transaction_items ti
        INNER JOIN transactions t ON t.id = ti.transaction_id
        INNER JOIN products p ON p.id = ti.product_id
        WHERE t.business_id = $1
          AND t.status = 'completed'
        GROUP BY COALESCE(p.gst_rate, 0)
        ORDER BY "gstRate" ASC
      `,
      [businessId]
    ),
    pool.query(
      `
        SELECT
          t.transaction_number AS "transactionNumber",
          t.completed_at AS "completedAt",
          p.gst_rate AS "gstRate",
          SUM(ti.line_tax_amount) AS "gstAmount",
          SUM(ti.line_total_amount - ti.line_tax_amount) AS "taxableAmount",
          SUM(ti.line_total_amount) AS "grossAmount"
        FROM transaction_items ti
        INNER JOIN transactions t ON t.id = ti.transaction_id
        INNER JOIN products p ON p.id = ti.product_id
        WHERE t.business_id = $1
          AND t.status = 'completed'
        GROUP BY t.transaction_number, t.completed_at, p.gst_rate
        ORDER BY t.completed_at DESC
        LIMIT 25
      `,
      [businessId]
    )
  ]);

  return res.json({
    business,
    summary: summaryResult.rows[0],
    rates: rateRows.rows,
    transactions: itemRows.rows
  });
});

export default router;
