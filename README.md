# RetailTrack - Inventory Management System

RetailTrack is an **Inventory Management System** for small retail shops (built for the *Ape Kade* store). It manages products, stock, sales, returns, purchase orders and reports, with separate access for **Administrators, Inventory Staff and Cashiers**.

> ⚠️ **Security notice.**
> `frontend/init` and `frontend/vite.config.js` used to contain a large block of obfuscated code unrelated to this application (added in commit `3c778d9`). It has been removed from the working copy, but **it is still in the git history** and in any older clone. Do not run `npm run dev`, `npm run build` or `node init` from an old checkout, and rotate any credentials on a machine where it ran. Ask the author of that commit what it was.

## 🚀 Features

* 🔐 Role-based access control, enforced in the backend (not only hidden in the UI)
* 📦 Products with SKU, category, selling and cost price, images, minimum stock and activate/deactivate
* ✨ Categories with colours and descriptions
* 🔄 Inventory: add stock, adjust with a reason, full stock history, low-stock and out-of-stock alerts
* 📤 Sales: completed or pending orders, automatic stock deduction, overselling prevention, cancel pending orders
* ↩️ Customer returns with quantity limits and automatic restocking
* 🛒 Purchase orders raised from low-stock alerts
* 📈 Dashboard shaped by role
* 💰 Reports: sales analytics, inventory valuation, fast / slow / non-moving products, and gross profit & loss (Admin only)
* 👥 Users and profiles, email verification and password recovery with one-time codes
* ⚙️ Store settings, JSON backup export and restore

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
                                  JWT, zod validation           Row Level Security on,
                                  roles, rate limits            service-role access only
                                          │
                                          ├── Cloudinary  (optional product images)
                                          └── SMTP        (optional one-time-code emails)
```

The browser never talks to Supabase directly. Every table has Row Level Security enabled with no public policies, so only the backend (using the service-role key, kept on the server) can read or write data. Stock changes run inside database functions with row locks, so two cashiers cannot sell the same last item.

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
| `node:test` | Backend tests |

## 📁 Project Structure

```text
RetailTrack-Inventory-Management-System/
├── frontend/                 React application (Vite)
│   ├── src/
│   └── public/
├── backend/
│   ├── database/
│   │   ├── schema.sql        Tables, atomic functions, reports, RLS (safe to re-run)
│   │   └── seed.sql          4 categories and 31 sample products
│   ├── src/
│   │   ├── config/           Environment and Supabase client
│   │   ├── controllers/
│   │   ├── middleware/       Auth, roles, errors, rate limits
│   │   ├── routes/
│   │   ├── services/         Business logic
│   │   ├── utils/
│   │   └── validators/       zod schemas
│   ├── tests/
│   └── .env.example
└── README.md
```

## ⚙️ Getting Started

### Prerequisites

* Node.js 20 or newer and npm
* Git
* A free [Supabase](https://supabase.com) project

### 1. Clone

```bash
git clone https://github.com/Chamindu-Gayanuka/RetailTrack-Inventory-Management-System.git
cd RetailTrack-Inventory-Management-System
```

### 2. Database

1. In Supabase open **SQL Editor**, paste [`backend/database/schema.sql`](backend/database/schema.sql) and run it. Run [`backend/database/seed.sql`](backend/database/seed.sql) afterwards for the sample catalogue. Both can be run again safely; run `schema.sql` again whenever it changes.
2. In **Project Settings -> API** copy the project URL and the `service_role` key. Never put the service-role key in the frontend or commit it.

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
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | From step 2 |
| `JWT_SECRET` | A random string of 32+ characters |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The first administrator, created on first start if none exists (password 8+ characters) |
| `FRONTEND_URL` | Allowed browser origin(s), comma separated. Default `http://localhost:5173` |

`SMTP_*` (one-time-code emails) and `CLOUDINARY_*` (image hosting) are optional. Without SMTP the codes are printed to the server console in development. Without Cloudinary, small images are stored in the database.

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

### Running everything locally without a cloud account

`backend/supabase/` and `backend/database/` let you run a full local Supabase with Docker: `cd backend && npx supabase start`. The schema and seed data are applied automatically. Copy the printed API URL and `service_role` key into `backend/.env`.

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

`GET /backup/export` downloads everything the business owns as JSON. It never contains password hashes. `POST /backup/import` first checks the file (`"mode": "validate"`, the default) and reports what would change; replacing all data (`"mode": "replace"`) additionally requires your password and the phrase `REPLACE ALL DATA`, and happens in one database transaction, so a failed restore changes nothing. User accounts are never deleted; accounts that exist only in the backup are added without a password and must use "Forgot password". Backups made by the browser demo (format versions 1 and 2) can be imported too.

## 🔄 Development Workflow

```text
Create branch -> Develop -> Test (npm test) -> Commit -> Push -> Pull request -> Review -> Merge
```

## 📌 Project Status

The backend API is complete and tested (63 automated tests, plus a 63-request Postman collection), and the frontend is connected to it. Remaining: deploy to a hosted Supabase project and production hardening.

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
