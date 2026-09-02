# ARGUS v4 - Supabase PostgreSQL Setup - Already Done !!!
# DB Password - ARGUSbySHINKA

## 1. Create the Supabase project
1. Create one Supabase project for the ARGUS team.
2. Save the database password in the team's secure password manager/private channel.
3. Do not put the password in GitHub.

## 2. Create the database schema
Open **Supabase Dashboard -> SQL Editor**, create a new query, paste the contents of:

`argus_backend/supabase/schema.sql`

Run the query once.

## 3. Configure the backend
Copy:

`.env.example` -> `.env`

Set `DATABASE_URL` to the PostgreSQL connection string shown by Supabase under the project's database connection settings. For team/cloud development, prefer the Supabase pooler connection string when available.

Example only:

`DATABASE_URL=postgresql://postgres.<project-ref>:YOUR_PASSWORD@YOUR_POOLER_HOST:5432/postgres`

Keep `DB_SYNC=false` after the SQL schema has been created.

## 4. Install dependencies
From `argus_backend`:

```bash
npm install
```

## 5. Run ARGUS backend

```bash
npm run dev
```

Expected terminal messages:

- `Supabase PostgreSQL connected`
- `Server running on port 5000`

Open:

`http://localhost:5000/api/health`

Expected response:

```json
{
  "status": "ok",
  "database": "Supabase PostgreSQL"
}
```

## 6. Test without changing the plugin
The API paths are preserved:

- `POST /api/analysis`
- `GET /api/analysis`
- `GET /api/sessions`
- `GET /api/suggestions`
- `POST /api/reports/generate`
- `GET /api/reports`

The Figma plugin can continue calling the same localhost backend URLs.

## 7. Verify records in Supabase
After running an analysis, open **Table Editor** and confirm records appear in:

- `analysis_sessions`
- `analyses`
- `detected_issues`
- `suggestions`
- `reports` (after generating a report)

## Notes
- Figma node arrays and report snapshots remain `JSONB` to avoid disrupting the existing metadata pipeline.
- Core relational entities use UUID primary keys and foreign keys.
- Analysis creation now uses a PostgreSQL transaction, so partial analysis/session/issue/suggestion writes are rolled back automatically on failure.
- The old MongoDB/Mongoose dependency is removed from the migrated backend.
