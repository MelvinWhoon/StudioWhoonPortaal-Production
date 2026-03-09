<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9cf91d7d-51fc-4719-b866-e042e58f0ac5

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a file named `.env.local` and add the following variables (replace values with your Supabase project credentials):
   ```
   GEMINI_API_KEY=<your Gemini key>
   SUPABASE_URL=https://biyyukscbbqhdhhnykqh.supabase.co
   SUPABASE_KEY=sb_publishable_OwvsEB8R1ms1cfcALl0Ieg_dFAtNFHR
   SUPABASE_DB_URL=postgresql://postgres:<YOUR-PASSWORD>@db.biyyukscbbqhdhhnykqh.supabase.co:5432/postgres
   ```
   The start script will automatically run `ensureTables` and create any missing tables.  Data is cleaned on startup and only the Melvin super‑admin account is preserved.
3. Run the app:
   `npm run dev`

### Additional utilities

- **Health check**: GET `/debug/db` will perform a simple query and report the database and host. Useful for CI or deployment checks.
- **Reset database**: startup cleanup runs only when `RESET_DB=true` is present. In production the cleanup is disabled by default.
- **Smoke test**: execute `npm run test:write` (after the server is running) to call all write endpoints with example payloads and verify the rows landed in Postgres.

