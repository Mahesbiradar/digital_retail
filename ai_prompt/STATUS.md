# Current project status
Last updated: 2026-04-04

## Last completed task
Task #: 2 - Auth module
What was done: Task 2 is complete. The server now has signup, login, refresh, logout, access-token auth middleware, roleCheck middleware, and protected auth test endpoints backed by PostgreSQL and Redis. The client now has an auth store, Axios refresh handling, login/signup pages, protected routing, and a dashboard page that confirms access to a secured endpoint.

## Current state
- Server: not started - auth routes and middleware are implemented and syntax-checked, but the app was not left running
- Client: not started - auth routes/pages are implemented and npm run build passes
- Database: migrated - Postgres and Redis are running via Docker, schema applied successfully, and seed data loaded successfully
- Last passing test: an in-process server test successfully completed signup, login, GET /api/auth/me, GET /api/test/protected, refresh, logout, and verified that refresh fails after logout; client npm run build also passed

## Next task to run
Task #: 3
Prompt to use: Build store and employee management. Auth middleware applies to all routes.

Backend endpoints:
POST   /api/stores              (owner only) create store, auto-generate
                                 store_slug from name, generate QR code URL
GET    /api/stores              (owner) list all stores for their business
GET    /api/stores/:storeId     store detail
PATCH  /api/stores/:storeId     update store settings (gst, discount toggles
                                 live on business level - update /api/business)
POST   /api/stores/:storeId/employees    invite employee by phone + role
GET    /api/stores/:storeId/employees    list employees
DELETE /api/stores/:storeId/employees/:userId   remove employee

Store slug: auto-generated as kebab-case of store name + 4 random chars.
Example: "Ram General Store" -> "ram-general-store-k7x2"

QR code: use the qrcode npm package to generate a PNG data URL for
https://[FRONTEND_URL]/shop/[store_slug] and save to Cloudinary.

Frontend pages:
- /src/pages/stores/StoreList.jsx  - cards showing each store
- /src/pages/stores/CreateStore.jsx - form
- /src/pages/stores/StoreSettings.jsx - edit store, toggle GST/discount,
  show QR code with a download button
- /src/pages/stores/Employees.jsx - list + invite form

Acceptance: Owner can create a store, see its QR code, download it,
invite an employee by phone number with a role.

## Known issues / blockers
- Server dependency install reports 2 high severity vulnerabilities in npm audit; not addressed in Task 1
- Several seed barcodes are intentionally marked for later physical-packaging verification
- Docker commands from this environment require elevated access to reach the local Docker daemon
- ai_prompt/auth_module.txt is present but empty; Task 2 was implemented from AGENTS.md and ai_prompt/TASKS.md

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
- .gitignore
- .env.example
- docker-compose.yml
- client/package.json
- client/vite.config.js
- client/tailwind.config.js
- client/postcss.config.js
- client/index.html
- client/src/App.jsx
- client/src/index.css
- client/src/main.jsx
- server/package.json
- server/db/schema.sql
- server/db/seed_catalog.sql
- server/db/migrate.js
- server/src/app.js
- server/src/index.js
- server/src/config/env.js
- server/src/lib/jwt.js
- server/src/lib/postgres.js
- server/src/lib/redis.js
- server/src/middleware/auth.js
- server/src/middleware/roleCheck.js
- server/src/routes/auth.js
- server/src/utils/phone.js
- server/src/utils/serialize.js
- server/src/utils/time.js
- client/src/api/axios.js
- client/src/store/authStore.js
- client/src/components/ProtectedRoute.jsx
- client/src/pages/auth/Login.jsx
- client/src/pages/auth/Signup.jsx
- client/src/pages/dashboard/DashboardHome.jsx
- .env
