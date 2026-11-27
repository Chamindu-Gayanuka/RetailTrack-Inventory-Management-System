# Local Supabase (Docker)

Runs a full Supabase stack on your machine, so no cloud account is needed for development and testing.

```bash
cd backend
npx supabase start     # first run downloads the images
npx supabase stop
npx supabase db reset  # wipes the local database and re-applies schema + seed
```

`start` prints the API URL (normally `http://127.0.0.1:54321`), the Studio URL and the keys. Put the API URL and the
`service_role` key into `backend/.env` as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

* `migrations/20260101000000_init.sql` is a **copy** of `../database/schema.sql` (the Supabase CLI only reads
  `supabase/migrations`). After changing `database/schema.sql`, copy it over this file and run `npx supabase db reset`.
* The seed data is read straight from `../database/seed.sql` (see `[db.seed]` in `config.toml`).
* Local SMTP is enabled on port `54325`; email messages can be viewed at `http://127.0.0.1:54324`.
* Product images use Multer in the Express API and Cloudinary. Local Supabase Storage is disabled because it is not used
  by the backend.
* Supabase Auth, realtime, edge functions and analytics are switched off because authentication and business logic are
  handled by the Express API.