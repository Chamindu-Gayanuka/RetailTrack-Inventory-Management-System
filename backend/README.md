# ⚙️ RetailTrack Backend API

REST API for the RetailTrack (Ape Kade) Inventory Management System. Node.js 20+, Express 5, Supabase (PostgreSQL).

| Document | What it covers |
| --- | --- |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Creating the Supabase project, running the SQL, keys, security checklist |
| [docs/API.md](docs/API.md) | Every endpoint: roles, parameters, request and response examples |
| [docs/TRACEABILITY.md](docs/TRACEABILITY.md) | SRS requirement -> API / database / test mapping, plus deviations |
| [postman/](postman/) | Postman collection and environment |

## 🚀 Quick start

```bash
cd backend
npm install --ignore-scripts      # this project needs no install scripts
cp .env.example .env              # then fill in the values below
npm run dev                       # http://localhost:5000/api
```

Before the first start, run `database/schema.sql` and `database/seed.sql` in the Supabase SQL editor (see [docs/SUPABASE.md](docs/SUPABASE.md)). On start the server creates the first administrator from `ADMIN_*` if no administrator exists, then sign in with `POST /api/auth/login`.

| Script | Purpose |
| --- | --- |
| `npm start` | Run the API |
| `npm run dev` | Run with automatic restart on file changes |
| `npm test` | Run the test suite (no database or network needed) |

## 🔧 Configuration

All settings come from environment variables (`.env`, never committed). The server validates them at start-up and stops with a clear message if one is missing or invalid.

| Variable | Required | Default | Notes |
| --- | :---: | --- | --- |
| `SUPABASE_URL` | yes | | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | | Server only. Bypasses Row Level Security |
| `JWT_SECRET` | yes | | 32+ random characters |
| `JWT_EXPIRES_IN` | | `8h` | Session length |
| `BCRYPT_SALT_ROUNDS` | | `12` | Password hashing cost |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first run | | Used only while no administrator exists. Change the default password and remove `ADMIN_PASSWORD` after first start |
| `PORT` | | `5000` | |
| `FRONTEND_URL` | | `http://localhost:5173` | Allowed browser origins, comma separated |
| `TRUST_PROXY` | | `0` | Set `1` behind a reverse proxy so rate limits see real client IPs |
| `OTP_EXPIRY_MINUTES`, `OTP_RESEND_COOLDOWN_SECONDS`, `OTP_MAX_ATTEMPTS` | | `10`, `60`, `5` | One-time code rules |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL` | | | Optional email. Without it, development prints codes to the console and production returns 503 for email verification |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | | | Optional image hosting. Without it, images up to about 700 KB are stored in the database |

## 📁 Structure

```text
backend/
├── database/
│   ├── schema.sql        Tables, atomic functions, reports, backup restore, RLS (safe to re-run)
│   └── seed.sql          4 categories, 31 sample products
├── docs/                 SUPABASE.md, API.md, TRACEABILITY.md
├── postman/              Collection and environment
├── src/
│   ├── config/           env.js (validated settings), supabase.js
│   ├── controllers/      HTTP layer: read validated input, call a service, shape the response
│   ├── middleware/       auth (authenticate, authorize), errorHandler, rateLimiter
│   ├── routes/           One router per module; role rules are declared here
│   ├── services/         Business logic and database access
│   ├── utils/            ApiError, validate, password, token, db helpers
│   ├── validators/       zod schemas for every request
│   ├── app.js            Express app (no listen, so tests can start it)
│   └── server.js         Start-up, first-admin bootstrap, graceful shutdown
└── tests/                node:test suites and an in-memory Supabase fake
```

## 📡 Conventions

* **Base path** `/api`. JSON in and out.
* **Success** `{ "success": true, "data": ..., "message": "..." }`. Lists add `"meta": { page, limit, total, totalPages }`.
* **Error** `{ "success": false, "message": "...", "errors": { "field": ["..."] } }` with the right status: 400 invalid input or broken business rule, 401 not signed in, 403 role not allowed, 404 not found, 409 duplicate or in use, 413 body too large, 429 rate limited, 502/503 an optional service (images, email) failed. Unexpected failures return a generic 500 and are logged on the server only.
* **Authentication** `Authorization: Bearer <token>` from `POST /auth/login`.
* **Enums** are returned in UPPER_CASE (`ADMIN`, `COMPLETED`, `CASH`, `LOW_STOCK`) next to a human `...Label` where the UI needs one. Request enums are case-insensitive where noted.
* **Dates** are ISO 8601 UTC. Report `tz` (minutes east of UTC, default 330 for Sri Lanka) decides which local day a sale belongs to.
* **Money** is a number with 2 decimals (LKR).

## 🔒 Security design

| Concern | How it is handled |
| --- | --- |
| Authorization | Roles are checked in the backend on every route (`authorize(...)`). The user is re-read from the database on every request, so deactivation and role changes apply immediately |
| Passwords | bcrypt hashed, 8-72 characters. Changing or resetting a password increments `token_version`, which signs out every other session |
| Login | Same message and similar timing for unknown email and wrong password; rate limited |
| One-time codes | 6 digits, stored as an HMAC, expire in 10 minutes, single use, 5 attempts, 60 s resend cooldown. Password recovery never reveals whether an email exists |
| Database | Row Level Security on every table with no policies; `anon` and `authenticated` roles have no access. Only this server, with the service-role key, reads or writes |
| Overselling | Sales, stock changes and returns run in database functions with row locks in one transaction, so concurrent sales cannot make stock negative |
| Injection | zod validation on every input; search terms are stripped of filter syntax; Supabase client uses parameterised calls |
| Prices | Taken from the database at sale time, never from the client |
| Data exposure | Cashiers do not receive cost prices and see only their own sales; password hashes never leave the server |
| Transport and headers | helmet, CORS allow-list from `FRONTEND_URL`, 1 MB body limit (products 4 MB, backup 12 MB), rate limits. Use HTTPS in production |
| Supply chain | `.npmrc` sets `ignore-scripts=true`; `package.json` defines no install-time scripts |

## 🧪 Testing

```bash
npm test      # 63 tests across 9 suites
```

The tests start the real Express app and replace Supabase with an in-memory fake (`tests/fakeSupabase.js`), so they need no network. The SQL in `database/schema.sql` is not executed by `npm test`; it was verified separately by running it in a real PostgreSQL engine (PGlite): idempotent re-run, stock functions, returns, reports and backup restore, including rollback on failure. When you change the SQL, re-run it against your own Supabase project and exercise the affected endpoints, for example with the Postman collection.

## 🔄 Changing the database

`schema.sql` is idempotent: run the whole file again in the Supabase SQL editor after pulling changes. It never deletes data. Do not edit rows in the Supabase table editor for stock, sales or returns; use the API so history stays complete.
