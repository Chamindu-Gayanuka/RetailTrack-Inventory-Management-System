# Supabase setup guide

RetailTrack uses Supabase only as a managed PostgreSQL database. The browser never talks to Supabase; only the backend does, using the **service-role** key.

## 1. Create the project

1. Sign in at <https://supabase.com> and create a new project. Choose a region close to the shop and save the database password somewhere safe (the API does not need it).
2. Wait until the project is ready.

## 2. Create the tables and functions

1. Open **SQL Editor -> New query**.
2. Paste the full contents of [`database/schema.sql`](../database/schema.sql) and click **Run**. It creates:
   * enums, sequences and the tables (users, categories, products, sales, sale items, returns, return items, inventory transactions, purchase orders, store settings, OTP codes)
   * the atomic business functions: `add_stock_atomic`, `adjust_stock_atomic`, `create_sale_atomic`, `complete_sale_atomic`, `cancel_sale_atomic`, `create_return_atomic`
   * reporting: the `sale_lines_net` view and `report_sales`, `report_movement`
   * `import_backup` for restoring backups, and `increment_otp_attempts`
   * Row Level Security on every table, and revoked access for the public roles
3. Paste [`database/seed.sql`](../database/seed.sql) and run it to add the 4 sample categories and 31 sample products. Skip this for a real shop that will enter its own catalogue.

Both files are **safe to run again**. Run `schema.sql` again whenever the project is updated; existing data is never deleted.

The SQL editor may warn about "destructive operations" because the file contains `revoke` statements. They only remove public access and are required.

## 3. Get the keys

**Project Settings -> API**:

| Value | Goes in `backend/.env` as | Notes |
| --- | --- | --- |
| Project URL | `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `service_role` secret key | `SUPABASE_SERVICE_ROLE_KEY` | Server only. Full access. Never put it in the frontend, a public repo or a chat |

You do **not** need the `anon` key: the backend does not use it, and the database refuses it.

## 4. Configure and start the API

```bash
cd backend
cp .env.example .env     # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, ADMIN_*
npm install --ignore-scripts
npm run dev
```

Generate a `JWT_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

If the server prints *"Failed to start the API (check SUPABASE_URL, the service-role key and that schema.sql was run)"*, one of those three is wrong.

## 5. Verify

1. `GET /api/health` returns `status: ok`.
2. `POST /api/auth/login` with your `ADMIN_EMAIL` and `ADMIN_PASSWORD` returns a token.
3. In Supabase **Table Editor** you should see 11 tables, each marked with the RLS shield and **no policies**. That is intended.
4. **Security Advisor** (Database -> Advisors) should report no "RLS disabled" findings. A note that RLS is enabled without policies is expected: the service role is the only client.

## Security checklist

* [ ] `SUPABASE_SERVICE_ROLE_KEY` exists only in `backend/.env` or your host's secret store.
* [ ] `.env` is not committed (it is in `.gitignore`).
* [ ] `JWT_SECRET` is long and random, and different for each environment.
* [ ] The default `ADMIN_PASSWORD` was changed, and removed from `.env` after the first start.
* [ ] `FRONTEND_URL` lists only your real frontend origin(s).
* [ ] The API is served over HTTPS in production and `TRUST_PROXY=1` is set when behind a proxy.
* [ ] If the service-role key was ever exposed, rotate it in Project Settings -> API and update the backend.
* [ ] Supabase automatic backups are enabled for the plan you use, in addition to the app's own **Backup and restore** (`GET /api/backup/export`).

## Restoring data

* **From an app backup:** `POST /api/backup/import` (see [API.md](API.md#backup-and-restore)). It validates first, then replaces all business data in one transaction.
* **Moving the browser demo data:** a backup downloaded from the old frontend (Settings -> Data) can be imported the same way.
* **Starting over:** to wipe everything, create a new Supabase project (or drop the tables and re-run `schema.sql`). Do not run `schema.sql` as a "reset"; it deliberately keeps data.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Invalid environment configuration` at start | A required variable is missing or too short (`JWT_SECRET` needs 32+ characters) |
| `permission denied` / `PGRST...` errors from the API | `schema.sql` was not run, or was run in a different project than the keys point to |
| `function ... does not exist` | Run the latest `schema.sql` again |
| Login works but everything returns 401 afterwards | The token expired (`JWT_EXPIRES_IN`) or the password was changed, which signs out all sessions |
| CORS error in the browser | The page's origin is not in `FRONTEND_URL` |
| No administrator exists | Set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and restart |
