# Current project status
Last updated: 2026-04-04

## Last completed task
Task #: 32 - Receipt display
What was done: The POS billing module is complete. The server now supports POS checkout transactions for cash and UPI, Razorpay order creation with local mock fallback, payment verification, and receipt fetches. The client now has a dedicated /pos/:storeId cashier screen with barcode scan, product search, cart management, cash checkout, UPI QR display, mock payment confirmation, and receipt rendering.

## Current state
- Server: not started - auth, store, inventory, and POS routes are implemented and syntax-checked, but the app was not left running
- Client: not started - auth, store, inventory, and POS pages are implemented and npm run build passes
- Database: migrated - Postgres and Redis are running via Docker, schema applied successfully, and seed data loaded successfully
- Last passing test: an in-process server test successfully completed signup, store create/summary, catalog search, barcode lookup, product create, batch create, cash POS checkout, UPI POS checkout, mock Razorpay verification, receipt fetches, and stock deductions; client npm run build also passed

## Next task to run
Task #: 33
Prompt to use: Build the public self-checkout experience at /shop/:store_slug. No auth. Mobile-first. Works entirely in the customer's phone browser.

Backend endpoints:
POST /api/kiosk/:storeSlug/session
GET  /api/kiosk/:storeSlug/search?q=...
GET  /api/kiosk/:storeSlug/barcode/:code
POST /api/kiosk/:storeSlug/cart/add
POST /api/kiosk/:storeSlug/cart/remove
GET  /api/kiosk/:storeSlug/cart
POST /api/kiosk/:storeSlug/checkout
POST /api/kiosk/:storeSlug/confirm

Frontend:
- /src/pages/kiosk/KioskHome.jsx
- /src/pages/kiosk/KioskCart.jsx
- /src/pages/kiosk/KioskPayment.jsx
- /src/pages/kiosk/KioskSuccess.jsx

Acceptance: Open /shop/test-store on mobile browser, scan a product, add to cart, complete Razorpay UPI payment, owner dashboard shows the order within 2 seconds via socket.

## Known issues / blockers
- Server dependency install reports 2 high severity vulnerabilities in npm audit; not addressed in Task 1
- Several seed barcodes are intentionally marked for later physical-packaging verification
- Docker commands from this environment require elevated access to reach the local Docker daemon
- ai_prompt/auth_module.txt is present but empty; Task 2 was implemented from AGENTS.md and ai_prompt/TASKS.md
- Store QR generation falls back to a local data URL when Cloudinary credentials are not available in the dev environment

## Environment variables needed before next task
- POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD or DATABASE_URL
- REDIS_URL
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- FRONTEND_URL
- BACKEND_URL
- VITE_API_BASE_URL
- VITE_SOCKET_URL
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

## Files changed in last session
- server/src/app.js
- server/src/index.js
- server/src/jobs/expiryCron.js
- server/src/lib/razorpay.js
- server/src/routes/inventory.js
- server/src/routes/payments.js
- server/src/routes/transactions.js
- server/src/utils/inventory.js
- client/src/App.jsx
- client/src/pages/inventory/AddBatch.jsx
- client/src/pages/inventory/AddProduct.jsx
- client/src/pages/inventory/ExpiryAlerts.jsx
- client/src/pages/inventory/ProductList.jsx
- client/src/pages/pos/PosScreen.jsx
- client/src/pages/stores/StoreList.jsx
- client/src/pages/stores/StoreSettings.jsx
- client/src/store/posStore.js
