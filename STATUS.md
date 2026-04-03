# Current project status
Last updated: 2026-04-03

## Last completed task
Task #: 1 - Scaffold + Schema
What was done: Task 1 is complete. The repo now has a React 18 + Vite + Tailwind client scaffold, an Express server scaffold, Docker Compose for Postgres and Redis, the approved schema.sql, a 30-item seed_catalog.sql, and a working migrate.js. Verification passed for docker compose startup, database migration, required schema columns, the product_stock view, the 30-row catalog seed, and the client production build.

## Current state
- Server: not started - scaffold exists and syntax check passes, but the app was not left running
- Client: not started - scaffold exists and npm run build passes
- Database: migrated - Postgres and Redis are running via Docker, schema applied successfully, and seed data loaded successfully
- Last passing test: docker compose up -d started Postgres and Redis cleanly, node server/db/migrate.js ran without errors, required columns plus product_stock were verified in Postgres, catalog_count returned 30, and the client Vite build completed successfully

## Next task to run
Task #: 2
Prompt to use: Build the complete auth system in /server. Rules from AGENTS.md apply.

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
- /server/middleware/auth.js - verifies JWT, attaches req.user
- /server/middleware/roleCheck.js - roleCheck('owner'), roleCheck('owner','manager'), etc.

Access token: 15 min expiry, payload { userId, businessId, role }
Refresh token: 7 days, stored as key refreshToken:{userId} in Redis

On the frontend /client:
- /src/api/axios.js - Axios instance with base URL from env,
  request interceptor attaches Authorization header,
  response interceptor handles 401 by calling /refresh and retrying
- /src/store/authStore.js - Zustand store: { user, business, accessToken,
  login(), logout(), setTokens() }
- Pages: /src/pages/auth/Login.jsx and Signup.jsx
  Simple, clean forms. Tailwind styled. On success redirect to /dashboard.
- Protected route wrapper: /src/components/ProtectedRoute.jsx

Acceptance: Can sign up a new business owner, log in, access a protected
test route, refresh token works, logout invalidates session.

## Known issues / blockers
- Server dependency install reports 2 high severity vulnerabilities in npm audit; not addressed in Task 1
- Several seed barcodes are intentionally marked for later physical-packaging verification
- Docker commands from this environment require elevated access to reach the local Docker daemon

## Environment variables needed before next task
- POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD or DATABASE_URL
- REDIS_URL
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- FRONTEND_URL
- BACKEND_URL
- VITE_API_BASE_URL
- VITE_SOCKET_URL

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
- server/src/lib/postgres.js
- server/src/lib/redis.js
