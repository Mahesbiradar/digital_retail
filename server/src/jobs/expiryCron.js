import cron from 'node-cron';
import { pool } from '../lib/postgres.js';

const insertAlertsSql = `
  INSERT INTO expiry_alerts (
    business_id,
    store_id,
    product_id,
    batch_id,
    alert_date,
    expiry_status,
    message
  )
  SELECT
    b.business_id,
    b.store_id,
    b.product_id,
    b.id,
    CURRENT_DATE,
    b.expiry_status,
    CASE
      WHEN b.expiry_status = 'expired' THEN CONCAT('Batch ', b.batch_number, ' is expired.')
      ELSE CONCAT('Batch ', b.batch_number, ' is expiring soon.')
    END
  FROM inventory_batches b
  WHERE b.expiry_date IS NOT NULL
    AND b.expiry_status IN ('expiring_soon', 'expired')
    AND b.expiry_status <> 'disposed'
  ON CONFLICT (batch_id, alert_date) DO NOTHING
`;

export const runExpirySweep = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        UPDATE inventory_batches
        SET expiry_status = CASE
              WHEN expiry_date < CURRENT_DATE THEN 'expired'::inventory_batch_expiry_status
              WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'::inventory_batch_expiry_status
              ELSE 'fresh'::inventory_batch_expiry_status
            END,
            updated_at = NOW()
        WHERE expiry_date IS NOT NULL
          AND expiry_status <> 'disposed'
      `
    );

    await client.query(insertAlertsSql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const startExpiryCron = () =>
  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        await runExpirySweep();
      } catch (error) {
        console.error('Expiry cron failed:', error);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );
