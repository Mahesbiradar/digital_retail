const validUnitTypes = new Set(['weight', 'piece', 'volume']);

const pickValue = (body, ...keys) => {
  for (const key of keys) {
    if (body[key] !== undefined) {
      return body[key];
    }
  }

  return undefined;
};

const coerceNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDateInput = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const formatDate = (value) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value ?? null;
};

export const buildCatalogRow = (row) => ({
  id: row.id,
  brand: row.brand,
  name: row.name,
  barcode: row.barcode,
  category: row.category,
  unitType: row.unitType,
  unitValue: row.unitValue,
  mrp: row.mrp,
  gstRate: row.gstRate,
  imageUrl: row.imageUrl,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export const buildProductRow = (row) => ({
  id: row.id,
  businessId: row.businessId,
  storeId: row.storeId,
  catalogId: row.catalogId,
  createdBy: row.createdBy,
  name: row.name,
  brand: row.brand,
  sku: row.sku,
  unitType: row.unitType,
  unitValue: row.unitValue,
  description: row.description,
  mrp: row.mrp,
  sellingPrice: row.sellingPrice,
  gstRate: row.gstRate,
  trackExpiry: row.trackExpiry,
  isActive: row.isActive,
  totalStock: row.totalStock ?? 0,
  sellableStock: row.sellableStock ?? row.totalStock ?? 0,
  expiringSoonBatches: row.expiringSoonBatches ?? 0,
  expiredBatches: row.expiredBatches ?? 0,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export const buildBatchRow = (row) => ({
  id: row.id,
  businessId: row.businessId,
  storeId: row.storeId,
  productId: row.productId,
  createdBy: row.createdBy,
  batchNumber: row.batchNumber,
  quantity: row.quantity,
  availableQuantity: row.availableQuantity,
  purchasePrice: row.purchasePrice,
  expiryDate: formatDate(row.expiryDate),
  expiryStatus: row.expiryStatus,
  disposedAt: row.disposedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export const buildExpiryAlertRow = (row) => ({
  id: row.id,
  businessId: row.businessId,
  storeId: row.storeId,
  productId: row.productId,
  batchId: row.batchId,
  productName: row.productName,
  batchNumber: row.batchNumber,
  alertDate: formatDate(row.alertDate),
  expiryDate: formatDate(row.expiryDate),
  expiryStatus: row.expiryStatus,
  message: row.message,
  createdAt: row.createdAt
});

export const getAvailableBatch = async (pool, productId, storeId) => {
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
      WHERE product_id = $1
        AND store_id = $2
        AND available_quantity > 0
        AND expiry_status <> 'disposed'
        AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
      ORDER BY expiry_date ASC NULLS LAST, created_at ASC, id ASC
      LIMIT 1
    `,
    [productId, storeId]
  );

  return rows[0] ?? null;
};

export const getValidUnitTypes = () => validUnitTypes;
export const getInputValue = pickValue;
export const toNumberOrNull = coerceNumber;
export const normalizeBatchDate = normalizeDateInput;
