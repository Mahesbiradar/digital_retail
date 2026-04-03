-- Best-known common GTIN seed data for popular Kirana products.
-- Rows with "Barcode needs verification" should be checked against live packaging later.

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Tata', 'Tata Salt', '8901058006684', 'Staples', 'weight', 1.00, 28.00, 0.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Aashirvaad', 'Whole Wheat Atta', '8901725119020', 'Staples', 'weight', 5.00, 289.00, 5.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Fortune', 'Sunlite Refined Sunflower Oil', '8906002486043', 'Oil', 'volume', 1.00, 165.00, 5.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Parle', 'Parle-G Original Gluco Biscuits', '8901719124122', 'Biscuits', 'weight', 0.08, 10.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Britannia', 'Marie Gold Biscuits', '8901063162443', 'Biscuits', 'weight', 0.25, 40.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Amul', 'Butter Pasteurised', '8901262010011', 'Dairy', 'weight', 0.10, 62.00, 12.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Amul', 'Taaza Toned Milk', '8901262030088', 'Dairy', 'volume', 1.00, 58.00, 5.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Maggi', '2-Minute Noodles Masala', '8901058005076', 'Instant Food', 'weight', 0.07, 15.00, 12.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Surf Excel', 'Easy Wash Detergent Powder', '8901030924302', 'Home Care', 'weight', 1.00, 72.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Rin', 'Advanced Detergent Bar', '8901030865704', 'Home Care', 'weight', 0.25, 10.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Dove', 'Cream Beauty Bathing Bar', '8901030975625', 'Personal Care', 'weight', 0.10, 55.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Lux', 'International Creamy Perfection Soap', '8901030760955', 'Personal Care', 'weight', 0.10, 38.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Clinic Plus', 'Strong and Long Health Shampoo', '8901030899594', 'Personal Care', 'volume', 0.18, 78.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Colgate', 'Strong Teeth Toothpaste', '8901314012840', 'Personal Care', 'weight', 0.20, 122.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Coca-Cola', 'Coca-Cola Soft Drink', '8901764031215', 'Beverages', 'volume', 0.75, 40.00, 28.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Pepsi', 'Pepsi Soft Drink', '8901491100736', 'Beverages', 'volume', 0.75, 40.00, 28.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Bisleri', 'Natural Mineral Water', '8901262000029', 'Beverages', 'volume', 1.00, 20.00, 0.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Tata Tea', 'Gold Tea', '8901058007551', 'Beverages', 'weight', 0.50, 320.00, 5.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Brooke Bond', 'Red Label Tea', '8901030875680', 'Beverages', 'weight', 0.50, 310.00, 5.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Nescafe', 'Classic Coffee', '8901058006400', 'Beverages', 'weight', 0.10, 375.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Bru', 'Instant Coffee', '8901030895015', 'Beverages', 'weight', 0.10, 360.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Haldirams', 'Aloo Bhujia', '8904063200126', 'Snacks', 'weight', 0.20, 58.00, 12.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Lays', 'Magic Masala Potato Chips', '8901491100910', 'Snacks', 'weight', 0.05, 20.00, 12.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Kurkure', 'Masala Munch', '8901491101375', 'Snacks', 'weight', 0.09, 20.00, 12.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Britannia', 'Good Day Butter Cookies', '8901063162368', 'Biscuits', 'weight', 0.10, 20.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Kelloggs', 'Corn Flakes Original', '8901491001798', 'Breakfast', 'weight', 0.475, 195.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

-- Barcode needs verification.
INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Patanjali', 'Cow Ghee', '8904109450281', 'Staples', 'volume', 1.00, 710.00, 12.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Cadbury', 'Dairy Milk Chocolate', '8901233020536', 'Confectionery', 'weight', 0.05, 40.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Sunfeast', 'Dark Fantasy Choco Fills', '8901725135617', 'Biscuits', 'weight', 0.075, 35.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;

INSERT INTO catalog (brand, name, barcode, category, unit_type, unit_value, mrp, gst_rate)
VALUES ('Dettol', 'Original Germ Protection Bathing Soap', '8901396600225', 'Personal Care', 'weight', 0.125, 42.00, 18.00)
ON CONFLICT (barcode) DO UPDATE
SET
    brand = EXCLUDED.brand,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_type = EXCLUDED.unit_type,
    unit_value = EXCLUDED.unit_value,
    mrp = EXCLUDED.mrp,
    gst_rate = EXCLUDED.gst_rate;
