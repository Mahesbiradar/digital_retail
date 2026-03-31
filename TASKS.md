# Task tracker

## Rules for Codex
- Mark a task DONE only when it fully works and is tested
- Mark PARTIAL if started but incomplete
- Mark BLOCKED if something is missing or broken
- Always update this file at the END of every task before stopping
- Never mark a task DONE if the acceptance criteria are not met

---

## Phase 1 — Foundation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Project scaffold (client + server + docker) | TODO | |
| 2 | schema.sql + seed_catalog.sql | TODO | |
| 3 | migrate.js + DB connects cleanly | TODO | |

## Phase 2 — Auth

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4 | POST /api/auth/signup | TODO | |
| 5 | POST /api/auth/login | TODO | |
| 6 | POST /api/auth/refresh | TODO | |
| 7 | JWT middleware + roleCheck | TODO | |
| 8 | Axios instance + interceptors (client) | TODO | |
| 9 | Zustand authStore | TODO | |
| 10 | Login + Signup pages | TODO | |
| 11 | ProtectedRoute component | TODO | |

## Phase 3 — Store management

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12 | POST /api/stores (create + QR gen) | TODO | |
| 13 | GET /api/stores (list) | TODO | |
| 14 | Store settings page (GST/discount toggle) | TODO | |
| 15 | Employee invite + list | TODO | |

## Phase 4 — Inventory

| # | Task | Status | Notes |
|---|------|--------|-------|
| 16 | Catalog search + barcode lookup API | TODO | |
| 17 | Add product to store API | TODO | |
| 18 | Add stock batch API | TODO | |
| 19 | FIFO batch deduction helper | TODO | |
| 20 | Nightly expiry cron job | TODO | |
| 21 | Expiry alerts API | TODO | |
| 22 | Product list page | TODO | |
| 23 | Add product page (scan + search) | TODO | |
| 24 | Add batch page | TODO | |
| 25 | Expiry alerts page | TODO | |

## Phase 5 — POS billing

| # | Task | Status | Notes |
|---|------|--------|-------|
| 26 | posStore Zustand (cart logic) | TODO | |
| 27 | Barcode scan (USB + camera) | TODO | |
| 28 | POST /api/transactions (cash) | TODO | |
| 29 | POST /api/transactions (UPI + Razorpay) | TODO | |
| 30 | Razorpay webhook verify | TODO | |
| 31 | POS screen UI | TODO | |
| 32 | Receipt display | TODO | |

## Phase 6 — Kiosk (self-checkout)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 33 | Anonymous session API | TODO | |
| 34 | Kiosk product search + barcode API | TODO | |
| 35 | Kiosk cart API (Redis session) | TODO | |
| 36 | Kiosk checkout + Razorpay order | TODO | |
| 37 | Kiosk confirm + socket emit | TODO | |
| 38 | Kiosk UI (mobile-first) | TODO | |

## Phase 7 — Dashboard + Reports

| # | Task | Status | Notes |
|---|------|--------|-------|
| 39 | Dashboard summary cards | TODO | |
| 40 | Live kiosk feed (socket.io) | TODO | |
| 41 | Sales report API + chart | TODO | |
| 42 | Stock + expiry report | TODO | |
| 43 | GST report (gst_enabled guard) | TODO | |