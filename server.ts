import express from "express";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";
import type { PoolClient } from "pg";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";

// Load environment variables from .env.local first (development) then fallback to .env
dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/debug")) {
    res.setHeader("Content-Type", "application/json");
  }
  next();
});

// PostgreSQL connection pool (Supabase)
let pool: Pool;

// Supabase client (optional)
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// --- Validation and normalization helpers ----------------------------------
function nonEmptyString(value: any): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
function ensureArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  try { return value ? JSON.parse(value) : []; } catch { return []; }
}
function ensureObject(value: any): object {
  if (value && typeof value === "object") return value;
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}
// normalize value for jsonb inserts
const normalizeJson = (val: any) => {
  if (val === undefined || val === null) return null;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val;
};

// helper to parse rows coming out of the db
const parseJsonFields = (obj: any, fields: string[]) => {
  if (!obj) return obj;
  const newObj = { ...obj };
  fields.forEach((field) => {
    if (newObj[field] && typeof newObj[field] === "string") {
      try {
        newObj[field] = JSON.parse(newObj[field]);
      } catch {
        newObj[field] = [];
      }
    }
  });
  return newObj;
};

function maskDbUrl(cs: string) {
  return cs.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
}

async function initDb() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";

  if (!connectionString) {
    console.error("⚠️ SUPABASE_DB_URL / DATABASE_URL is not set. Please configure your .env.local with the correct Supabase connection string.");
    process.exit(1);
  }

  if (!/pgbouncer/i.test(connectionString)) {
    console.warn("⚠️ Connection string does not mention pgbouncer; verify pooler settings");
  }

  // Debug: shows which URL your app actually uses (password masked)
  console.log("DB_URL_USED =", maskDbUrl(connectionString));

  if (!connectionString) {
    console.error("⚠️ SUPABASE_DB_URL / DATABASE_URL is not set. Please configure your .env.local with the correct Supabase connection string.");
    process.exit(1);
  }

  // Debug: shows which URL your app actually uses (password masked)
  console.log("DB_URL_USED =", maskDbUrl(connectionString));

  try {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      // Keep settings conservative for pooler connections
      max: 5,
      connectionTimeoutMillis: 10_000,
    });

    const client = await pool.connect();
    console.log("✅ Connected to Postgres (Supabase)");
    await ensureTables(client);
    client.release();
  } catch (error) {
    console.error("✖️ Unable to connect to database:", error);
    process.exit(1);
  }
}

async function ensureTables(client: PoolClient) {
  await client.query(
    `
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text UNIQUE NOT NULL,
      name text,
      role text,
      password text,
      is_active boolean DEFAULT true,
      is_password_set boolean DEFAULT false,
      project_id text,
      apartment_id text,
      master_package_id text,
      apartment_details jsonb,
      construction_progress jsonb,
      created_at text,
      remarks text,
      exceptions jsonb
    );
    CREATE TABLE IF NOT EXISTS projects (
      id text PRIMARY KEY,
      name text,
      status text,
      address text,
      homes_count integer,
      postal_code text,
      city text,
      manager text,
      available_option_ids jsonb,
      additional_photos jsonb,
      internal_remarks text,
      delivery_date text,
      logo_url text
    );
    CREATE TABLE IF NOT EXISTS master_packages (
      id text PRIMARY KEY,
      name text,
      project_id text,
      price numeric,
      category text,
      inclusions jsonb,
      photos jsonb,
      option_ids jsonb
    );
    CREATE TABLE IF NOT EXISTS messages (
      id text PRIMARY KEY,
      project_id text,
      customer_id text,
      sender_id text,
      sender_name text,
      role text,
      text text,
      date text,
      category text,
      is_escalated boolean DEFAULT false,
      is_archived boolean DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS portal_documents (
      id text PRIMARY KEY,
      project_id text,
      customer_id text,
      file_name text,
      uploaded_by text,
      role text,
      date text,
      size text,
      external_url text
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id text PRIMARY KEY,
      user_id text,
      message text,
      created_at text,
      is_read boolean DEFAULT false
    );
  `
  );
}

async function cleanupData() {
  const client = await pool.connect();
  const melvinEmail = "melvin@whoon.com";

  try {
    const tables = ["projects", "master_packages", "messages", "notifications", "portal_documents"];
    for (const table of tables) {
      await client.query(`DELETE FROM ${table}`);
    }
    await client.query("DELETE FROM users WHERE email != $1", [melvinEmail]);
    console.log("🧹 Cleaned database, leaving only superadmin");
  } catch (e) {
    console.error("Error during database cleanup:", e);
  } finally {
    client.release();
  }
}


app.get("/debug/db", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT current_database() AS db, inet_server_addr() AS host");
    const row: any = rows[0] || {};
    res.json({
      mode: "postgres",
      host: row.host,
      database: row.db,
    });
  } catch (e: any) {
    return res.status(500).json({ mode: "error", error: e.message });
  }
});

// API Routes
app.get("/api/projects", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM projects");
    const projects = (rows as any[]).map((p) => parseJsonFields(p, ["available_option_ids", "additional_photos"]));
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/projects", async (req, res) => {
  try {
    const p = req.body;
    // basic validation
    if (!p || !nonEmptyString(p.id) || !nonEmptyString(p.name)) {
      return res.status(400).json({ error: "project id and name are required" });
    }
    // enforce arrays for JSON fields
    const available = ensureArray(p.available_option_ids);
    const photos = ensureArray(p.additional_photos);

    await pool.query(
      `INSERT INTO projects (id, name, status, address, homes_count, postal_code, city, manager, available_option_ids, additional_photos, internal_remarks, delivery_date, logo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        p.id,
        p.name,
        p.status,
        p.address,
        p.homes_count,
        p.postal_code,
        p.city,
        p.manager,
        JSON.stringify(available),
        JSON.stringify(photos),
        p.internal_remarks,
        p.delivery_date,
        p.logo_url,
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!nonEmptyString(id)) {
      return res.status(400).json({ error: "missing project id in URL" });
    }
    const updates = req.body || {};

    const fields: string[] = [];
    const values: any[] = [];

    const addField = (name: string, value: any) => {
      values.push(value);
      fields.push(`${name} = $${values.length}`);
    };

    if (updates.name !== undefined) addField("name", updates.name);
    if (updates.status !== undefined) addField("status", updates.status);
    if (updates.address !== undefined) addField("address", updates.address);
    if (updates.homes_count !== undefined) addField("homes_count", updates.homes_count);
    if (updates.postal_code !== undefined) addField("postal_code", updates.postal_code);
    if (updates.city !== undefined) addField("city", updates.city);
    if (updates.manager !== undefined) addField("manager", updates.manager);
    if (updates.delivery_date !== undefined) addField("delivery_date", updates.delivery_date);
    if (updates.internal_remarks !== undefined) addField("internal_remarks", updates.internal_remarks);
    if (updates.logo_url !== undefined) addField("logo_url", updates.logo_url);
    if (updates.available_option_ids !== undefined) addField("available_option_ids", JSON.stringify(ensureArray(updates.available_option_ids)));
    if (updates.additional_photos !== undefined) addField("additional_photos", JSON.stringify(ensureArray(updates.additional_photos)));

    if (fields.length === 0) {
      return res.status(400).json({ error: "no updatable fields provided" });
    }

    values.push(id);
    const result = await pool.query(`UPDATE projects SET ${fields.join(", ")} WHERE id = $${values.length}`, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "project not found" });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users");
    const users = (rows as any[]).map((u) => parseJsonFields(u, ["apartment_details", "construction_progress", "exceptions"]));
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/users/upsert", async (req, res) => {
  try {
    const users = req.body;
    if (!Array.isArray(users)) {
      return res.status(400).json({ error: "expected an array of users" });
    }
    for (const u of users) {
      if (!nonEmptyString(u.id) || !nonEmptyString(u.email)) {
        return res.status(400).json({ error: "each user must have id and email" });
      }
      await pool.query(
        `
        INSERT INTO users (id, email, name, role, password, is_active, is_password_set, project_id, apartment_id, master_package_id, apartment_details, construction_progress, created_at, remarks, exceptions)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          password = EXCLUDED.password,
          is_active = EXCLUDED.is_active,
          is_password_set = EXCLUDED.is_password_set,
          project_id = EXCLUDED.project_id,
          apartment_id = EXCLUDED.apartment_id,
          master_package_id = EXCLUDED.master_package_id,
          apartment_details = EXCLUDED.apartment_details,
          construction_progress = EXCLUDED.construction_progress,
          remarks = EXCLUDED.remarks,
          exceptions = EXCLUDED.exceptions
        `,
        [
          u.id,
          u.email,
          u.name,
          u.role,
          u.password,
          u.is_active,
          u.is_password_set,
          u.project_id,
          u.apartment_id,
          u.master_package_id,
          JSON.stringify(normalizeJson(u.apartment_details) || {}),
          JSON.stringify(normalizeJson(u.construction_progress) || {}),
          u.created_at,
          u.remarks,
          JSON.stringify(ensureArray(u.exceptions) || []),
        ]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/api/master_packages", async (req, res) => {
  try {
    const { projectId } = req.query;
    let sql = "SELECT * FROM master_packages";
    const params: any[] = [];
    if (projectId) {
      sql += " WHERE project_id = $1";
      params.push(projectId);
    }
    const { rows } = await pool.query(sql, params);
    const packages = (rows as any[]).map((p) => parseJsonFields(p, ["inclusions", "photos", "option_ids"]));
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/master_packages", async (req, res) => {
  try {
    const mp = req.body;
    if (!mp || !nonEmptyString(mp.id) || !nonEmptyString(mp.name) || !nonEmptyString(mp.project_id)) {
      return res.status(400).json({ error: "id, name and project_id are required" });
    }
    await pool.query(
      `INSERT INTO master_packages (id, name, project_id, price, category, inclusions, photos, option_ids) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        mp.id,
        mp.name,
        mp.project_id,
        mp.price,
        mp.category,
        JSON.stringify(ensureArray(mp.inclusions)),
        JSON.stringify(ensureArray(mp.photos)),
        JSON.stringify(ensureArray(mp.option_ids)),
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/api/messages", async (req, res) => {
  try {
    const { customerId } = req.query;
    let sql = "SELECT * FROM messages";
    const params: any[] = [];
    if (customerId) {
      sql += " WHERE customer_id = $1";
      params.push(customerId);
    }
    sql += " ORDER BY date ASC";
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/messages", async (req, res) => {
  try {
    const m = req.body;
    if (!m || !nonEmptyString(m.id) || !nonEmptyString(m.customer_id) || !nonEmptyString(m.sender_id) || !nonEmptyString(m.text)) {
      return res.status(400).json({ error: "id, customer_id, sender_id and text are required" });
    }
    await pool.query(
      `INSERT INTO messages (id, project_id, customer_id, sender_id, sender_name, role, text, date, category, is_escalated, is_archived)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [m.id, m.project_id, m.customer_id, m.sender_id, m.sender_name, m.role, m.text, m.date, m.category, m.is_escalated, m.is_archived]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/api/documents", async (req, res) => {
  try {
    const { customerId } = req.query;
    const { rows } = await pool.query("SELECT * FROM portal_documents WHERE customer_id = $1", [customerId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// notifications -------------------------------------------------------------
app.get("/api/notifications", async (req, res) => {
  try {
    const { userId } = req.query;
    let sql = "SELECT * FROM notifications";
    const params: any[] = [];
    if (userId) {
      sql += " WHERE user_id = $1";
      params.push(userId);
    }
    const { rows } = await pool.query(sql, params);
    // rename message -> text to match client types
    const normalized = (rows as any[]).map((r) => ({
      ...r,
      text: r.message,
    }));
    res.json(normalized);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/notifications", async (req, res) => {
  try {
    const n = req.body;
    if (!n || !nonEmptyString(n.id) || !nonEmptyString(n.user_id) || !nonEmptyString(n.message)) {
      return res.status(400).json({ error: "id, user_id and message are required" });
    }
    await pool.query(
      `INSERT INTO notifications (id, user_id, message, created_at, is_read)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         message = EXCLUDED.message,
         created_at = EXCLUDED.created_at,
         is_read = EXCLUDED.is_read`,
      [n.id, n.user_id, n.message, n.created_at, n.is_read]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/documents", async (req, res) => {
  try {
    const d = req.body;
    if (!d || !nonEmptyString(d.id) || !nonEmptyString(d.project_id) || !nonEmptyString(d.customer_id) || !nonEmptyString(d.file_name) || !nonEmptyString(d.uploaded_by)) {
      return res.status(400).json({ error: "id, project_id, customer_id, file_name and uploaded_by are required" });
    }
    await pool.query(
      `INSERT INTO portal_documents (id, project_id, customer_id, file_name, uploaded_by, role, date, size, external_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [d.id, d.project_id, d.customer_id, d.file_name, d.uploaded_by, d.role, d.date, d.size, d.external_url]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Vite middleware for development
async function startServer() {
  await initDb();
  if (process.env.RESET_DB === "true") {
    console.log("⏳ RESET_DB=true detected, running cleanupData");
    await cleanupData();
  }


  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
