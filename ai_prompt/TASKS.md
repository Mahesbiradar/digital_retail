# Task tracker

## Rules for Codex
- Mark a task DONE only when it fully works and is tested
- Mark PARTIAL if started but incomplete
- Mark BLOCKED if something is missing or broken
- Always update this file at the END of every task before stopping
- Never mark a task DONE if the acceptance criteria are not met

---

## Phase 1 - Foundation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Project scaffold (client + server + docker) | DONE | React 18 + Vite + Tailwind scaffolded, Express server scaffolded, Docker Compose added, npm deps installed, client build passes |
| 2 | schema.sql + seed_catalog.sql | DONE | Schema approved with unit enum + product_stock view; seed contains 30 Kirana products with uncertain barcodes flagged in SQL comments |
| 3 | migrate.js + DB connects cleanly | DONE | docker compose services are healthy, node server/db/migrate.js succeeded, and catalog seed count verified at 30 |

## Phase 2 - Auth

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4 | POST /api/auth/signup | DONE | Creates business + owner in one transaction and returns access/refresh tokens with public user and business payloads |
| 5 | POST /api/auth/login | DONE | Validates owner credentials, updates last_login_at, and returns fresh access/refresh tokens |
| 6 | POST /api/auth/refresh | DONE | Verifies JWT refresh token against Redis key refreshToken:{userId} and issues a new access token |
| 7 | JWT middleware + roleCheck | DONE | Added access-token auth middleware and reusable roleCheck middleware; protected test route verified |
| 8 | Axios instance + interceptors (client) | DONE | Request interceptor attaches bearer token, 401 handler refreshes once and retries original request |
| 9 | Zustand authStore | DONE | Persisted auth store added with login, signup, logout, clearAuth, and setTokens/session helpers |
| 10 | Login + Signup pages | DONE | Tailwind auth pages added with form submission, inline errors, and dashboard redirect |
| 11 | ProtectedRoute component | DONE | Protected dashboard route added with hydration guard and redirect when session is missing |

## Phase 3 - Store management

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12 | POST /api/stores (create + QR gen) | DONE | Owner can create a store, receives a permanent QR code URL/data URL, and the slug is generated with a random 4-char suffix |
| 13 | GET /api/stores (list) | DONE | Owner can list all stores for the current business |
| 14 | Store settings page (GST/discount toggle) | DONE | Store details can be edited and business GST/discount flags can be updated from the UI |
| 15 | Employee invite + list | DONE | Owner can invite employees by phone and role, list them, and remove them from a store |

## Phase 4 - Inventory

| # | Task | Status | Notes |
|---|------|--------|-------|
| 16 | Catalog search + barcode lookup API | DONE | Search and barcode lookup endpoints work under /api/stores/:storeId; catalog search is limited and barcode lookup returns NOT_FOUND cleanly |
| 17 | Add product to store API | DONE | Supports catalog-linked and manual products with unit enum validation |
| 18 | Add stock batch API | DONE | Validates quantity, expiry rules, and persists FIFO-ready batches |
| 19 | FIFO batch deduction helper | DONE | getAvailableBatch(productId, storeId) returns the oldest non-expired batch with stock |
| 20 | Nightly expiry cron job | DONE | Cron updates batch expiry_status at midnight and inserts alerts once per day |
| 21 | Expiry alerts API | DONE | Store-level alerts endpoint lists expiring and expired batches with product/batch context |
| 22 | Product list page | DONE | Inventory list shows stock levels, status badges, and actions |
| 23 | Add product page (scan + search) | DONE | Catalog search, barcode lookup, and camera scan modal all prefill the form |
| 24 | Add batch page | DONE | Add batch form hides expiry input when the product does not track expiry |
| 25 | Expiry alerts page | DONE | Alert list page shows batches needing attention and links back to inventory |

## Phase 5 - POS billing

| # | Task | Status | Notes |
|---|------|--------|-------|
| 26 | posStore Zustand (cart logic) | DONE | Cart state, totals, discount handling, and stock validation live in a dedicated Zustand store |
| 27 | Barcode scan (USB + camera) | DONE | POS screen supports hidden USB barcode input and ZXing camera scan modal |
| 28 | POST /api/transactions (cash) | DONE | Cash checkout revalidates stock, deducts FIFO batches, and marks the transaction complete immediately |
| 29 | POST /api/transactions (UPI + Razorpay) | DONE | UPI checkout creates a Razorpay order in configured envs and a mock order locally, with QR rendering support |
| 30 | Razorpay webhook verify | DONE | Payment verification endpoint marks the transaction complete and deducts inventory on success |
| 31 | POS screen UI | DONE | Full-screen cashier interface is wired at /pos/:storeId with cart, scan, totals, and checkout actions |
| 32 | Receipt display | DONE | Receipt view renders the completed sale and transaction detail after cash or UPI confirmation |

## Phase 6 - Kiosk (self-checkout)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 33 | Anonymous session API | TODO | |
| 34 | Kiosk product search + barcode API | TODO | |
| 35 | Kiosk cart API (Redis session) | TODO | |
| 36 | Kiosk checkout + Razorpay order | TODO | |
| 37 | Kiosk confirm + socket emit | TODO | |
| 38 | Kiosk UI (mobile-first) | TODO | |

## Phase 7 - Dashboard + Reports

| # | Task | Status | Notes |
|---|------|--------|-------|
| 39 | Dashboard summary cards | TODO | |
| 40 | Live kiosk feed (socket.io) | TODO | |
| 41 | Sales report API + chart | TODO | |
| 42 | Stock + expiry report | TODO | |
| 43 | GST report (gst_enabled guard) | TODO | |
