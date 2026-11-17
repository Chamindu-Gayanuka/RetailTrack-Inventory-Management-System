# RetailTrack - Inventory Management System

RetailTrack is an **Inventory Management System** for small retail shops (built for the *Ape Kade* store). It manages products, stock, sales, returns, purchase orders and reports, with separate access for **Administrators, Inventory Staff and Cashiers**.

> ⚠️ **Security notice - read before running the frontend.**
> `frontend/init` (run by `npm run dev` and `npm run build` through `node init`) and `frontend/vite.config.js` contain a large block of obfuscated code that has nothing to do with this application. Treat it as malicious: **do not run `npm run dev`, `npm run build` or `node init` in `frontend/`** until it has been removed and reviewed by the team, and rotate any credentials that were on a machine where it ran. The same file was removed from `backend/`.

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

The frontend currently runs on browser-stored demo data and is not connected to the API yet. See the security notice above before installing or starting it.

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

In development. The backend API is complete and tested; connecting the frontend to it is the next step.

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
