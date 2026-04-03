CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'manager', 'cashier');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE inventory_batch_expiry_status AS ENUM ('fresh', 'expiring_soon', 'expired', 'disposed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE transaction_initiated_by AS ENUM ('cashier', 'owner', 'customer_kiosk');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE transaction_payment_method AS ENUM ('cash', 'upi');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE payment_provider AS ENUM ('cash', 'razorpay');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'paid', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE unit_type_enum AS ENUM ('weight', 'piece', 'volume');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    gst_enabled BOOLEAN NOT NULL DEFAULT false,
    discount_enabled BOOLEAN NOT NULL DEFAULT false,
    gstin VARCHAR(20),
    logo_url TEXT,
    currency_code CHAR(3) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    store_slug VARCHAR(60) NOT NULL UNIQUE,
    phone VARCHAR(20),
    address_line1 VARCHAR(160),
    address_line2 VARCHAR(160),
    city VARCHAR(80),
    state VARCHAR(80),
    pincode VARCHAR(12),
    logo_url TEXT,
    qr_code_url TEXT,
    qr_code_public_id TEXT,
    self_checkout_enabled BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    password_hash TEXT,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, user_id)
);

CREATE TABLE IF NOT EXISTS catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand VARCHAR(120),
    name VARCHAR(160) NOT NULL,
    barcode VARCHAR(50) UNIQUE,
    category VARCHAR(80),
    unit_type unit_type_enum,
    unit_value NUMERIC(10, 2),
    mrp NUMERIC(12, 2),
    gst_rate NUMERIC(5, 2),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    catalog_id UUID REFERENCES catalog(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(160) NOT NULL,
    brand VARCHAR(120),
    sku VARCHAR(60),
    unit_type unit_type_enum,
    unit_value NUMERIC(10, 2),
    description TEXT,
    mrp NUMERIC(12, 2),
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    gst_rate NUMERIC(5, 2),
    track_expiry BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    batch_number VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
    purchase_price NUMERIC(12, 2) NOT NULL CHECK (purchase_price >= 0),
    expiry_date DATE,
    expiry_status inventory_batch_expiry_status NOT NULL DEFAULT 'fresh',
    disposed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (available_quantity <= quantity)
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    transaction_number VARCHAR(40) NOT NULL UNIQUE,
    initiated_by transaction_initiated_by NOT NULL,
    status transaction_status NOT NULL DEFAULT 'pending',
    payment_method transaction_payment_method NOT NULL,
    payment_status payment_status NOT NULL DEFAULT 'pending',
    currency_code CHAR(3) NOT NULL DEFAULT 'INR',
    subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (discount_amount <= subtotal_amount)
);

CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
    product_name_snapshot VARCHAR(160) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (line_discount_amount >= 0),
    line_tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (line_tax_amount >= 0),
    line_total_amount NUMERIC(12, 2) NOT NULL CHECK (line_total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    method transaction_payment_method NOT NULL,
    provider payment_provider NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency_code CHAR(3) NOT NULL DEFAULT 'INR',
    provider_order_id TEXT,
    provider_payment_id TEXT,
    provider_signature TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expiry_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE CASCADE,
    alert_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_status inventory_batch_expiry_status NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (batch_id, alert_date),
    CHECK (expiry_status IN ('expiring_soon', 'expired'))
);

CREATE OR REPLACE VIEW product_stock AS
SELECT
    product_id,
    store_id,
    SUM(available_quantity) AS total_stock
FROM inventory_batches
GROUP BY product_id, store_id;

CREATE INDEX IF NOT EXISTS idx_stores_business_id
    ON stores (business_id);

CREATE INDEX IF NOT EXISTS idx_stores_store_slug
    ON stores (store_slug);

CREATE INDEX IF NOT EXISTS idx_users_business_id
    ON users (business_id);

CREATE INDEX IF NOT EXISTS idx_store_employees_business_id
    ON store_employees (business_id);

CREATE INDEX IF NOT EXISTS idx_store_employees_store_id
    ON store_employees (store_id);

CREATE INDEX IF NOT EXISTS idx_store_employees_user_id
    ON store_employees (user_id);

CREATE INDEX IF NOT EXISTS idx_products_business_id
    ON products (business_id);

CREATE INDEX IF NOT EXISTS idx_products_store_id
    ON products (store_id);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_business_id
    ON inventory_batches (business_id);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_store_id
    ON inventory_batches (store_id);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_id
    ON inventory_batches (product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry_date
    ON inventory_batches (expiry_date);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_fifo_lookup
    ON inventory_batches (product_id, store_id, expiry_status, expiry_date, created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_business_id
    ON transactions (business_id);

CREATE INDEX IF NOT EXISTS idx_transactions_store_id
    ON transactions (store_id);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at
    ON transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_items_business_id
    ON transaction_items (business_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id
    ON transaction_items (transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id
    ON transaction_items (product_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_batch_id
    ON transaction_items (batch_id);

CREATE INDEX IF NOT EXISTS idx_payments_business_id
    ON payments (business_id);

CREATE INDEX IF NOT EXISTS idx_payments_store_id
    ON payments (store_id);

CREATE INDEX IF NOT EXISTS idx_payments_transaction_id
    ON payments (transaction_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order_id_unique
    ON payments (provider_order_id)
    WHERE provider_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_payment_id_unique
    ON payments (provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expiry_alerts_business_id
    ON expiry_alerts (business_id);

CREATE INDEX IF NOT EXISTS idx_expiry_alerts_store_id
    ON expiry_alerts (store_id);

CREATE INDEX IF NOT EXISTS idx_expiry_alerts_alert_date
    ON expiry_alerts (alert_date DESC);

DROP TRIGGER IF EXISTS trg_businesses_set_updated_at ON businesses;
CREATE TRIGGER trg_businesses_set_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_stores_set_updated_at ON stores;
CREATE TRIGGER trg_stores_set_updated_at
BEFORE UPDATE ON stores
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_catalog_set_updated_at ON catalog;
CREATE TRIGGER trg_catalog_set_updated_at
BEFORE UPDATE ON catalog
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_set_updated_at ON products;
CREATE TRIGGER trg_products_set_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_batches_set_updated_at ON inventory_batches;
CREATE TRIGGER trg_inventory_batches_set_updated_at
BEFORE UPDATE ON inventory_batches
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_set_updated_at ON transactions;
CREATE TRIGGER trg_transactions_set_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_set_updated_at ON payments;
CREATE TRIGGER trg_payments_set_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
