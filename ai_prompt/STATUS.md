# Current project status
Last updated: 2026-04-04

## Last completed task
Task #: 43 - GST report (gst_enabled guard)
What was done: The dashboard and reporting layer is complete. The server now exposes owner-only dashboard summary, sales trend, stock/expiry, and GST report endpoints, and the client dashboard renders summary cards, a sales chart, stock/expiry cards, GST tax breakdown, and the live kiosk feed.

## Current state
- Server: not started - auth, store, inventory, POS, kiosk, and report routes are implemented and syntax-checked, but the app was not left running
- Client: not started - auth, store, inventory, POS, kiosk, and dashboard/report pages are implemented and npm run build passes
- Database: migrated - Postgres and Redis are running via Docker, schema applied successfully, and seed data loaded successfully
- Last passing test: an in-process server test successfully completed signup, store create, GST enablement, product create, batch create, public kiosk session creation, kiosk search, kiosk barcode lookup, kiosk cart add/retrieve, kiosk checkout, mock Razorpay confirmation, socket emission, dashboard report fetches, GST report fetches, and stock deductions; client npm run build also passed

## Next task to run
Task #: 44
Prompt to use: Continue with the next prompt or maintenance task after the dashboard/reporting phase.

## Known issues / blockers
- Server dependency install reports 2 high severity vulnerabilities in npm audit; not addressed in Task 1
- Several seed barcodes are intentionally marked for later physical-packaging verification
- Docker commands from this environment require elevated access to reach the local Docker daemon
- ai_prompt/auth_module.txt is present but empty; Task 2 was implemented from AGENTS.md and ai_prompt/TASKS.md
- Store QR generation falls back to a local data URL when Cloudinary credentials are not available in the dev environment
- Existing Node deprecation warning about `url.parse()` still appears during live tests but does not block execution
- GST report is intentionally blocked when `gst_enabled` is false, which is the expected guard behavior

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
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET

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
