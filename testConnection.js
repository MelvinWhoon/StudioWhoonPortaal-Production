import { Pool } from 'pg';
import fs from 'fs';

(async () => {
  try {
    const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
    const pool = new Pool({ connectionString });
    const res = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    fs.writeFileSync('/tmp/testConnection.txt', JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (err) {
    fs.writeFileSync('/tmp/testConnection.txt', 'ERROR:'+err);
  }
})();
