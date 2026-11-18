# RetailTrack - Inventory Management System

RetailTrack is an **Inventory Management System** for small retail shops (built for the *Ape Kade* store). It manages products, stock, sales, returns, purchase orders and reports, with separate access for **Administrators, Inventory Staff and Cashiers**.

> ⚠️ **Security notice.**
> `frontend/init` and `frontend/vite.config.js` used to contain a large block of obfuscated code unrelated to this application (added in commit `3c778d9`). It has been removed from the working copy, but **it is still in the git history** and in any older clone. Do not run `npm run dev`, `npm run build` or `node init` from an old checkout, and rotate any credentials on a machine where it ran. Ask the author of that commit what it was.

## 🌐 Live Deployment

| Part | Where it runs | Link |
| --- | --- | --- |
| 🖥️ Frontend | Vercel | https://retail-track-inventory-management-s.vercel.app |
| ⚙️ Backend API | Render (Singapore) | https://retailtrack-api.onrender.com/api — health check: https://retailtrack-api.onrender.com/api/health |
| 🗄️ Database | Supabase cloud (Singapore) | Private. Only the backend can reach it |

* The Render free plan puts the API to sleep after about 15 minutes without traffic, so the first request after a quiet period can take around a minute.
* The frontend reads the API address from `VITE_API_URL` **when it is built**. For the live site to use the live API, set `VITE_API_URL=https://retailtrack-api.onrender.com/api` in the Vercel project and redeploy from a branch that contains the API connection (see the Deployment section below).
* A complete deployment guide with every setting, a status table, backup advice and troubleshooting is in [`backend/docs/RetailTrack-System-Full-Report.pdf`](backend/docs/RetailTrack-System-Full-Report.pdf) (section 12).

## 🚀 Features

* 🔐 Role-based access control, enforced in the backend (not only hidden in the UI)
* 📦 Products with SKU, category, selling and cost price, images, minimum stock and activate/deactivate
* ✨ Categories with colours and descriptions
* 🔄 Inventory: add stock, adjust with a reason, full stock history, low-stock and out-of-stock alerts
* 📤 Sales: completed or pending orders, automatic stock deduction, overselling prevention, cancel pending orders
* 🧾 Receipts with barcode (80 mm, A5, A4), print and PDF; CSV and PDF exports of sales, inventory, returns and reports
* ↩️ Customer returns with quantity limits and automatic restocking
* 🛒 Purchase orders raised from low-stock alerts, downloadable as PDF
* 📈 Dashboard shaped by role, with period filters (daily to all time)
* 💰 Reports: sales analytics, inventory valuation, fast / slow / non-moving products, and gross profit & loss (Admin only)
* 👥 Users and profiles, email verification and password recovery with one-time codes
* ⚙️ Store settings, JSON backup export and restore
* 🔎 Global search, notification bell with stock alerts, dark mode

## 👤 User Roles

| Capability | Administrator | Inventory Staff | Cashier |
| --- | :---: | :---: | :---: |
| Dashboard | yes | yes | yes |
| View products | yes | yes | yes (no cost price) |
| Create / edit / (de)activate products | yes | yes | no |
| Delete products, manage categories | yes | no | no |
| Inventory: restock, adjust, history, alerts | yes | yes | no |
| Create, complete, cancel sales | yes | no (read-only) | yes |
| View sales | all | all | own sales |
| Process customer returns | yes | yes | yes |
| Purchase orders | yes | yes | no |
| Inventory and movement reports | yes | yes | no |
| Sales and profit & loss reports | yes | no | no |
| Users, store settings, backup / restore | yes | no | no |
| Own profile and password | yes | yes | yes |

## 📊 System Architecture

```text
   Frontend                     Backend                         Database
React 19 + Vite  ──HTTPS/JSON──▶  Node.js + Express 5  ──────▶  Supabase (PostgreSQL)
(Vercel)                          (Render)                      Row Level Security on,
                                  JWT, zod validation           service-role access only
                                  roles, rate limits
                                          │
                                          ├── Cloudinary  (optional product images)
                                          └── SMTP        (optional one-time-code emails)
```

The browser never talks to Supabase directly. Every table has Row Level Security enabled with no public policies, so only the backend (using the service-role key, kept on the server) can read or write data. Stock changes run inside database functions with row locks, so two cashiers cannot sell the same last item.

The frontend keeps no business data of its own: after sign-in it loads what the user's role may see from the API, and reloads the affected lists after every change. Only the sign-in token and display preferences (theme, sidebar, receipt format) are stored in the browser.

## 🛠️ Technology Stack

| Technology | Purpose |
| --- | --- |
| React 19, Vite | Frontend (plain CSS, `lucide-react` icons, `jspdf` for PDFs) |
| Node.js 20+, Express 5 | REST API |
| Supabase / PostgreSQL | Database |
| zod | Request validation |
| JWT, bcryptjs | Authentication and password hashing |
| helmet, cors, express-rate-limit | Security headers, origin allow-list, rate limiting |
| Cloudinary, Nodemailer | Optional image hosting and email |
| `node:test`, Postman / newman | Backend tests and API collection |
| Docker, Supabase CLI | Local Supabase for development and testing |
| Vercel, Render | Hosting for the frontend and the API |

## 📁 Project Structure

```text
RetailTrack-Inventory-Management-System/
├── frontend/                 React application (Vite)
│   ├── src/
│   │   ├── api/              API client and data adapters
│   │   ├── components/       Layout, receipts, modals, inputs
│   │   ├── pages/            Dashboard, Products, Inventory, Sales, Reports...
│   │   ├── utils/            PDF, CSV, periods, backup helpers
│   │   └── ServerStoreContext.jsx   App state loaded from and saved to the API
│   ├── public/
│   ├── vercel.json           Sends every address to index.html
│   └── .env.example          VITE_API_URL
├── backend/
│   ├── database/
│   │   ├── schema.sql        Tables, atomic functions, reports, RLS (safe to re-run)
│   │   └── seed.sql          4 categories and 31 sample products
│   ├── supabase/             Local Supabase (Docker) configuration and migration
│   ├── src/
│   │   ├── config/           Environment and Supabase client
│   │   ├── controllers/
│   │   ├── middleware/       Auth, roles, errors, rate limits
│   │   ├── routes/
│   │   ├── services/         Business logic
│   │   ├── utils/
│   │   └── validators/       zod schemas
│   ├── tests/                63 automated tests
│   ├── postman/              Postman collection and environment
│   ├── docs/                 API, Supabase setup, SRS traceability, full report PDF
│   └── .env.example
└── README.md
```

## ⚙️ Getting Started

### Prerequisites

* Node.js 20 or newer and npm
* Git
* A free [Supabase](https://supabase.com) project, **or** Docker to run Supabase locally

### 1. Clone

```bash
git clone https://github.com/Chamindu-Gayanuka/RetailTrack-Inventory-Management-System.git
cd RetailTrack-Inventory-Management-System
```

### 2. Database

**Option A: local Supabase in Docker (no account needed)**

```bash
cd backend
npx supabase start          # first run downloads the images; applies schema.sql and seed.sql
```

It prints the API URL (normally `http://127.0.0.1:54321`) and keys. Use the API URL as `SUPABASE_URL`, and the secret / `service_role` key as `SUPABASE_SERVICE_ROLE_KEY`. Studio (a web table browser) is at `http://127.0.0.1:54323`. `npx supabase db reset` wipes the local database and re-applies everything.

**Option B: a Supabase cloud project**

1. In the Supabase **SQL Editor** run [`backend/database/schema.sql`](backend/database/schema.sql), then [`backend/database/seed.sql`](backend/database/seed.sql). Both can be run again safely.
2. In **Project Settings -> API Keys** copy the project URL and the **secret** key (`sb_secret_...`), or the `service_role` key on the legacy tab. Never use the publishable / `anon` key, never put the secret key in the frontend, and never commit it.

### 3. Backend

```bash
cd backend
npm install --ignore-scripts
cp .env.example .env        # then edit .env
npm run dev
```

Set at least these in `backend/.env`:

| Variable | Meaning |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | From step 2 (`SUPABASE_URL` is the project address, not `/rest/v1/`) |
| `JWT_SECRET` | A random string of 32+ characters |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The first administrator, created on first start if none exists (password 8+ characters) |
| `FRONTEND_URL` | Allowed browser origin(s), comma separated. Default `http://localhost:5173` |
| `TRUST_PROXY` | `1` when running behind a proxy such as Render |

`SMTP_*` (one-time-code emails) and `CLOUDINARY_*` (image hosting) are optional. Without SMTP the codes are printed to the server console (or the hosting logs). Without Cloudinary, small images are stored in the database.

The API listens on `http://localhost:5000/api`. Check it with `GET /api/health`.

```bash
npm test      # 63 tests, no database or network needed
```

### 4. Frontend

The frontend talks only to the backend API; all data lives in the database.

```bash
cd frontend
npm install --ignore-scripts
npx vite              # http://localhost:5173
```

* The API address comes from `VITE_API_URL` (see `frontend/.env.example`); it defaults to `http://localhost:5000/api`.
* The backend must be running, and `FRONTEND_URL` in `backend/.env` must include `http://localhost:5173` (it does by default).
* Sign in with the administrator created from `ADMIN_*` in `backend/.env`. That administrator can then create the cashier and inventory-staff accounts on the **Users** page; each new user is emailed a temporary password (printed in the backend console while SMTP is not configured).
* Use `npx vite` rather than `npm run dev` until the `node init` step in `package.json` is removed.

## ☁️ Deployment

The live system uses three free-tier services. The full step-by-step guide, including every setting, is in section 12 of [`backend/docs/RetailTrack-System-Full-Report.pdf`](backend/docs/RetailTrack-System-Full-Report.pdf). In short:

1. **Database (Supabase cloud).** Create a project, run `schema.sql` then `seed.sql`, copy the project URL and the secret key.
2. **Backend (Render web service).** Connect the repository, runtime Node, build command `cd backend && npm ci --omit=dev`, start command `cd backend && npm start`, health check path `/api/health`, region Singapore. Environment settings:

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | From the database step (secret) |
   | `JWT_SECRET` | Random, 32+ characters (secret) |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | The first administrator, created once (secret password) |
   | `FRONTEND_URL` | The exact frontend address, for example `https://retail-track-inventory-management-s.vercel.app` |
   | `NODE_ENV`, `TRUST_PROXY`, `NODE_VERSION` | `production`, `1`, `22` |
   | `SMTP_*` | Recommended, so recovery codes and new-user emails are delivered |

3. **Frontend (Vercel).** Root directory `frontend`, framework Vite, output `dist`. Add `VITE_API_URL=https://retailtrack-api.onrender.com/api` and redeploy (the value is built into the site).
4. **Check.** Open `/api/health` on the API, sign in on the frontend, and watch the browser's network tab: calls must go to the Render address.

Code changes deploy automatically on push (Render and Vercel). Database structure changes do **not**: apply the SQL to the cloud database yourself. Take a JSON backup first (Settings, Data and Backups).

> ⚠️ Never run the Postman collection against the live system. It creates test data, changes the administrator's password and performs a full restore. Run it only against a local or throw-away database.

## 🧪 Testing

| Layer | What it covers |
| --- | --- |
| `npm test` (backend) | 63 automated tests: roles, validation, atomic stock logic, reports, backup and restore |
| [Postman collection](backend/postman/) | 64 requests across every endpoint group for all three roles; run with `newman`. Passes against a local Supabase, repeatably |
| Browser walkthrough | Every page and flow of the three roles was exercised against a real backend and database, including exports compared with the database |

Details and results are in the [full report](backend/docs/RetailTrack-System-Full-Report.pdf).

## 🔌 API Overview

Full documentation lives in [`backend/README.md`](backend/README.md): [Supabase setup guide](backend/docs/SUPABASE.md), [API reference](backend/docs/API.md), [SRS traceability](backend/docs/TRACEABILITY.md) and a [Postman collection](backend/postman/).

All routes are under `/api`. Responses are `{ "success": true, "data": ... }` or `{ "success": false, "message": "...", "errors": { "field": ["..."] } }`. Send the token from `POST /auth/login` as `Authorization: Bearer <token>`.

| Area | Main endpoints |
| --- | --- |
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`, `POST /auth/forgot-password`, `/auth/verify-reset-otp`, `/auth/reset-password`, `/auth/email-verification/send`, `/confirm` |
| Users | `GET/PATCH /users/me`; admin: `GET/POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status` |
| Categories | `GET/POST /categories`, `PATCH/DELETE /categories/:id` |
| Products | `GET/POST /products`, `GET /products/next-sku`, `GET/PATCH/DELETE /products/:id`, `PATCH /products/:id/status` |
| Inventory | `GET /inventory/summary`, `/alerts`, `/transactions`; `POST /inventory/restock`, `/adjustments` |
| Sales | `GET/POST /sales`, `GET /sales/:id`, `POST /sales/:id/complete`, `/cancel` |
| Returns | `GET/POST /returns`, `GET /returns/eligible-sales`, `GET /returns/:id` |
| Dashboard and reports | `GET /dashboard`; `GET /reports/sales`, `/profit`, `/inventory`, `/movement` |
| Purchase orders | `GET/POST /purchase-orders`, `GET /purchase-orders/:id` |
| Settings | `GET /settings/public` (no sign-in), `GET/PATCH /settings` |
| Backup | `GET /backup/export`; `POST /backup/import` (validate first, then replace) |

### 💾 Backup and Restore

`GET /backup/export` downloads everything the business owns as JSON. It never contains password hashes. `POST /backup/import` first checks the file (`"mode": "validate"`, the default) and reports what would change; replacing all data (`"mode": "replace"`) additionally requires your password and the phrase `REPLACE ALL DATA`, and happens in one database transaction, so a failed restore changes nothing. User accounts are never deleted; accounts that exist only in the backup are added without a password and must use "Forgot password". Backups made by the earlier browser-only demo (format versions 1 and 2) can be imported too.

## 🔄 Development Workflow

```text
Create branch -> Develop -> Test (npm test) -> Commit -> Push -> Pull request -> Review -> Merge
```

## 📌 Project Status

Last updated: 18 November 2026.

| Area | Status |
| --- | --- |
| ✅ Backend API | Complete and tested (63 automated tests, 64-request Postman collection). **Live and healthy** on Render |
| ✅ Database | Cloud Supabase project created with the schema, security and real seed data. No test data |
| ✅ Frontend | Connected to the API; every page and flow tested in a browser for all three roles |
| 🔄 Live frontend | The Vercel site must be redeployed from the connected code with `VITE_API_URL` set before it uses the live API |
| 🔄 Backup restore on the live database | The `import_backup` function still has to be applied to the cloud database |
| 🔄 Email | Configure SMTP on the live API so recovery codes and new-user emails are delivered |
| 📝 Next | Remove the `node init` step from `frontend/package.json`; optionally serve the dashboard and reports from the API endpoints that already exist |

## 👥 Development Team

* **Chamindu Gayanuka Dharmasiri** - Frontend Developer & Project Manager
* **Sandun Madushan** - QA Engineer & Documentation
* **Chathuranga Sampath** - Business Analyst & UI/UX Designer
* **Dilwan Thennakoon** - Backend Developer & Database Administrator

## 📄 License

Licensed under the MIT License. See the [LICENSE](LICENSE) file.

---
<p style="text-align: center;">
🌟 RetailTrack Inventory Management System<br>
✨ Develop. Manage. Succeed. ✨ <br>
🚀 Built with the power of React, Node.js, and Supabase. <br>
</p>
