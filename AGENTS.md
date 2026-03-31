# Project: Digital Retail System (Kirana POS)

## What we are building
A web-based Point of Sale and Inventory Management System for small Indian
Kirana stores. Business owners sign up, create stores, add employees, manage
inventory, and process transactions. Customers can self-checkout via a
permanent store QR code that opens on their own phone — no app install needed.

## Tech stack
- Frontend: React 18 + Vite + Tailwind CSS + Zustand (state) + Axios
- Backend: Node.js + Express + PostgreSQL + Redis
- Auth: JWT (access token 15min) + refresh token (7d, stored in Redis)
- Payments: Razorpay UPI QR (dynamic order per transaction)
- Barcode: ZXing-js (camera) + USB HID keyboard input (both supported)
- Real-time: Socket.io (owner dashboard watches kiosk orders live)
- Image storage: Cloudinary
- Background jobs: node-cron (nightly expiry checker)
- Local dev: Docker Compose (postgres + redis)

## Roles
- owner: full access to their business and all stores
- manager: inventory + billing for assigned stores
- cashier: billing only for assigned store

## Key business rules — never violate these
1. GST is optional. Controlled by businesses.gst_enabled boolean.
   When false, hide all GST fields everywhere — product form, cart, invoice.
2. Discounts are optional. Controlled by businesses.discount_enabled boolean.
   When false, hide discount input in billing screen.
3. Every stock entry is a batch with quantity + expiry_date (nullable).
   Products with track_expiry = true must have expiry_date on every batch.
4. Expired batches (expiry_status = 'expired') must be hard-blocked from
   sale in both POS and customer kiosk. Show clear error, never silently skip.
5. FIFO batch deduction — always deduct from the oldest non-expired batch first.
6. Self-checkout kiosk (/shop/:store_slug) is fully public, no auth required.
   Cart uses anonymous session token (30min TTL in Redis).
7. One permanent QR code per store, generated at store creation, never changes.
8. transactions.initiated_by enum: 'cashier' | 'owner' | 'customer_kiosk'

## Folder structure
/client   React frontend
/server   Express backend
/server/db/schema.sql   single source of truth for DB
```

Save this as `AGENTS.md` in your repo root. Codex will read it automatically on every task.

---

## The task breakdown — prompt sequence

Here's the exact order and prompts to give Codex, one at a time. Don't move to the next until the current one passes.

---

### Task 1 — Scaffold + Schema
```
Using the stack and rules in AGENTS.md, do the following:

1. Initialize the project:
   - /client: Vite + React 18 + Tailwind CSS. Install zustand, axios,
     react-router-dom, @zxing/browser, socket.io-client
   - /server: Express + pg + redis + jsonwebtoken + bcrypt + cors +
     dotenv + node-cron + socket.io + cloudinary + razorpay. 
     Use ES modules (type: module in package.json).
   - Root: docker-compose.yml with postgres:15 and redis:7 services.
     Postgres port 5432, Redis port 6379. Include a .env.example file.

2. Create /server/db/schema.sql with ALL tables:
   businesses, stores, users, store_employees, catalog, products,
   inventory_batches, transactions, transaction_items, payments,
   expiry_alerts.
   
   Critical columns:
   - businesses: gst_enabled BOOLEAN DEFAULT false, discount_enabled BOOLEAN DEFAULT false
   - stores: store_slug VARCHAR(60) UNIQUE, self_checkout_enabled BOOLEAN DEFAULT true
   - inventory_batches: expiry_date DATE nullable, expiry_status 
     ENUM('fresh','expiring_soon','expired','disposed') DEFAULT 'fresh',
     batch_number VARCHAR(50)
   - transactions: initiated_by ENUM('cashier','owner','customer_kiosk')
   - transaction_items: batch_id UUID references inventory_batches(id)
   
   Add indexes on: barcode columns, store_slug, business_id FKs,
   expiry_date, transaction created_at.
   Add a seed file /server/db/seed_catalog.sql with 30 common Kirana
   products (Tata Salt, Parle-G, Amul Butter, etc.) with real barcodes.

3. Create /server/db/migrate.js — runs schema.sql then seed_catalog.sql.
   Run it with: node server/db/migrate.js

Acceptance: docker-compose up starts cleanly, node server/db/migrate.js
runs without errors, all tables exist with correct columns.
```

---

### Task 2 — Auth module
```
Build the complete auth system in /server. Rules from AGENTS.md apply.

Endpoints needed:
POST /api/auth/signup
  Body: { name, phone, password, businessName }
  Creates: business record + owner user record
  Returns: { accessToken, refreshToken, user, business }

POST /api/auth/login
  Body: { phone, password }
  Returns: { accessToken, refreshToken, user, business }

POST /api/auth/refresh
  Body: { refreshToken }
  Returns: { accessToken }

POST /api/auth/logout
  Invalidates refresh token in Redis

Middleware to create:
- /server/middleware/auth.js — verifies JWT, attaches req.user
- /server/middleware/roleCheck.js — roleCheck('owner'), roleCheck('owner','manager'), etc.

Access token: 15 min expiry, payload { userId, businessId, role }
Refresh token: 7 days, stored as key refreshToken:{userId} in Redis

On the frontend /client:
- /src/api/axios.js — Axios instance with base URL from env,
  request interceptor attaches Authorization header,
  response interceptor handles 401 by calling /refresh and retrying
- /src/store/authStore.js — Zustand store: { user, business, accessToken,
  login(), logout(), setTokens() }
- Pages: /src/pages/auth/Login.jsx and Signup.jsx
  Simple, clean forms. Tailwind styled. On success redirect to /dashboard.
- Protected route wrapper: /src/components/ProtectedRoute.jsx

Acceptance: Can sign up a new business owner, log in, access a protected
test route, refresh token works, logout invalidates session.
```

---

### Task 3 — Store + Employee management
```
Build store and employee management. Auth middleware applies to all routes.

Backend endpoints:
POST   /api/stores              (owner only) create store, auto-generate
                                 store_slug from name, generate QR code URL
GET    /api/stores              (owner) list all stores for their business
GET    /api/stores/:storeId     store detail
PATCH  /api/stores/:storeId     update store settings (gst, discount toggles
                                 live on business level — update /api/business)
POST   /api/stores/:storeId/employees    invite employee by phone + role
GET    /api/stores/:storeId/employees    list employees
DELETE /api/stores/:storeId/employees/:userId   remove employee

Store slug: auto-generated as kebab-case of store name + 4 random chars.
Example: "Ram General Store" → "ram-general-store-k7x2"

QR code: use the qrcode npm package to generate a PNG data URL for
https://[FRONTEND_URL]/shop/[store_slug] and save to Cloudinary.

Frontend pages:
- /src/pages/stores/StoreList.jsx  — cards showing each store
- /src/pages/stores/CreateStore.jsx — form
- /src/pages/stores/StoreSettings.jsx — edit store, toggle GST/discount,
  show QR code with a download button
- /src/pages/stores/Employees.jsx — list + invite form

Acceptance: Owner can create a store, see its QR code, download it,
invite an employee by phone number with a role.
```

---

### Task 4 — Inventory + Expiry
```
Build the inventory module. This is the most complex module — read carefully.

Backend endpoints:
GET    /api/stores/:storeId/catalog/search?q=tata+salt   search global catalog
GET    /api/stores/:storeId/catalog/barcode/:barcode      lookup by barcode

POST   /api/stores/:storeId/products        add product to store (can reference
                                             catalog_id or be fully manual)
GET    /api/stores/:storeId/products        list all products with current stock
GET    /api/stores/:storeId/products/:id    product detail with all batches
PATCH  /api/stores/:storeId/products/:id    update product details

POST   /api/stores/:storeId/products/:id/batches    add stock batch
  Body: { quantity, purchase_price, expiry_date (nullable), batch_number }
  Auto-sets expiry_status based on expiry_date vs today.
PATCH  /api/stores/:storeId/batches/:batchId/dispose   mark batch disposed

GET    /api/stores/:storeId/expiry-alerts   list all expiring/expired batches

Background job (node-cron, runs at midnight):
  For every active batch where expiry_date is not null:
  - If expiry_date < today: set expiry_status = 'expired'
  - If expiry_date between today and today+30d: set expiry_status = 'expiring_soon'
  - Insert into expiry_alerts if not already alerted today

Helper function (used by POS and kiosk):
  getAvailableBatch(productId, storeId) — returns oldest non-expired batch
  with quantity > 0. Returns null if none available. This is the FIFO logic.

Frontend:
- /src/pages/inventory/ProductList.jsx — table with stock levels,
  red badge for out-of-stock, amber for expiring soon, search bar
- /src/pages/inventory/AddProduct.jsx — search catalog first,
  prefill form if found, manual entry if not, barcode scan button
- /src/pages/inventory/AddBatch.jsx — add stock to existing product,
  expiry date picker (show only if product.track_expiry = true)
- /src/pages/inventory/ExpiryAlerts.jsx — list of batches needing attention

Acceptance: Can add a product via catalog search and via barcode scan,
add a batch with expiry, nightly job correctly updates statuses,
expired products show correctly.
```

---

### Task 5 — POS billing screen
```
Build the cashier POS screen at /pos/:storeId. This is a full-screen
dedicated billing interface.

Layout (two-column desktop):
  Left panel (60%): barcode input + product search + item list in cart
  Right panel (40%): order summary, totals, payment button

Barcode input behavior:
  USB scanner: fires as rapid keystrokes ending in Enter — listen on a
  hidden input that's always focused. On Enter, call lookup API.
  Camera scan: button opens ZXing camera modal, on decode call lookup API.
  Both paths call: GET /api/stores/:storeId/catalog/barcode/:barcode

Cart logic (frontend Zustand store /src/store/posStore.js):
  - addItem(product, batch): adds to cart or increments qty
  - removeItem(productId)
  - updateQty(productId, qty): validate against available stock
  - applyDiscount(amount): only if business.discount_enabled
  - computeTotals(): subtotal, discount, tax (only if gst_enabled), total

Backend endpoint:
POST /api/stores/:storeId/transactions
  Body: { items: [{productId, batchId, quantity, unitPrice}],
          paymentMethod, discountAmount, initiatedBy }
  Server-side: re-validate stock, re-validate no expired batches,
  deduct from inventory_batches, create transaction + transaction_items,
  if paymentMethod = 'cash' mark transaction complete immediately,
  if paymentMethod = 'upi' create Razorpay order and return orderId+amount

POST /api/payments/razorpay/verify
  Verify Razorpay signature, mark transaction complete, deduct stock.

GET /api/stores/:storeId/transactions/:txId  fetch completed transaction
  for receipt display.

Display rules:
  If business.gst_enabled = false: hide tax column and tax line entirely.
  If business.discount_enabled = false: hide discount button entirely.

Acceptance: Full billing flow works — scan item, add to cart, pay cash
(immediate), pay UPI (QR shown, webhook confirms), receipt displayed.
```

---

### Task 6 — Customer kiosk (self-checkout)
```
Build the public self-checkout experience at /shop/:store_slug.
No auth. Mobile-first. Works entirely in the customer's phone browser.

Anonymous session:
  On page load, check localStorage for sessionToken.
  If none, call POST /api/kiosk/:storeSlug/session → returns sessionToken.
  Store in localStorage. All subsequent kiosk API calls send this token
  as X-Session-Token header. Session TTL = 30 minutes, reset on activity.
  Redis key: kiosk_session:{sessionToken} = { storeId, cart: [] }

Backend endpoints:
POST /api/kiosk/:storeSlug/session          create anonymous session
GET  /api/kiosk/:storeSlug/search?q=...     search products (public)
GET  /api/kiosk/:storeSlug/barcode/:code    lookup product (public)
POST /api/kiosk/:storeSlug/cart/add         add item to session cart
POST /api/kiosk/:storeSlug/cart/remove      remove item
GET  /api/kiosk/:storeSlug/cart             get current cart
POST /api/kiosk/:storeSlug/checkout         create Razorpay order,
                                             returns { orderId, amount, currency }
POST /api/kiosk/:storeSlug/confirm          called after payment success,
                                             creates transaction with
                                             initiated_by = 'customer_kiosk',
                                             deducts stock, emits socket event

Socket.io event on confirm:
  Emit to room `store:{storeId}`: { event: 'kiosk_order', transaction }
  Owner dashboard listens and shows live notification.

Frontend pages:
- /src/pages/kiosk/KioskHome.jsx — store name + logo, search bar,
  camera scan button. Clean, large touch targets, mobile-first design.
- /src/pages/kiosk/KioskCart.jsx — cart items, total, "Pay now" button
- /src/pages/kiosk/KioskPayment.jsx — Razorpay checkout flow
- /src/pages/kiosk/KioskSuccess.jsx — order confirmed screen

Blocked items: if getAvailableBatch returns null or batch is expired,
return 400 with message "This item is currently unavailable."
Never expose internal batch or pricing details beyond name + price.

Acceptance: Open /shop/test-store on mobile browser, scan a product,
add to cart, complete Razorpay UPI payment, owner dashboard shows the
order within 2 seconds via socket.
```

---

### Task 7 — Owner dashboard + Reports
```
Build the owner dashboard at /dashboard.

Dashboard home (/dashboard):
  - Summary cards: today's sales, total transactions, low stock count,
    expiry alerts count
  - Live kiosk feed: Socket.io listener on room store:{storeId},
    shows last 10 kiosk orders in real time with a "new order" animation
  - Quick links to each store's POS

Reports page (/dashboard/reports):
  GET /api/stores/:storeId/reports/sales?from=&to=   daily sales breakdown
  GET /api/stores/:storeId/reports/top-products      top 10 by qty sold
  GET /api/stores/:storeId/reports/stock             current stock levels
  GET /api/stores/:storeId/reports/expiry            expiry watchlist
  GET /api/stores/:storeId/reports/gst               GST summary
    (only if gst_enabled — endpoint returns 403 otherwise)

Charts: use recharts library for sales trend line chart and
top products bar chart.

Acceptance: Dashboard loads with correct counts, live kiosk orders
appear within 2 seconds of a kiosk purchase, all report endpoints
return correct data.
```

---

## Tips for working with Codex effectively

**Always start a new task with:** "Read AGENTS.md first, then do the following task." This ensures it never forgets the business rules.

**When Codex drifts** (starts making up its own decisions), say: "Stop. Re-read rule #4 in AGENTS.md. Your implementation violates it because [reason]. Fix only that part."

**Ask for a plan before code** on complex tasks: "Before writing any code, explain how you will implement the FIFO batch deduction. List the steps." Review the plan, correct if needed, then say "Good. Now implement it."

**After each task, ask Codex to self-review:** "Review what you just built. List any edge cases not handled, any business rules from AGENTS.md that may be violated, and any missing error handling." It often catches its own bugs this way.

**For the database schema specifically:** "Do not run any migration until I confirm the schema. Show me the complete schema.sql first." Always review before it executes.

---

## The one-shot summary prompt

If you want to give Codex the full picture in a single message to orient it before task 1:
```
I am building a Digital Retail / Kirana POS system. Before we write any
code, read the full context below and confirm you understand the business
rules, stack, and constraints. Ask me any clarifying questions before
we start Task 1.

[paste the AGENTS.md content here]