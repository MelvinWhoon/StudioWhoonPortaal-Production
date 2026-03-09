const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
let pool;

async function initDb() {
  pool = new Pool({ connectionString });
  const client = await pool.connect();
  client.release();
}

app.get("/debug/db", async (req, res) => {
  const { rows } = await pool.query("SELECT current_database() AS db, inet_server_addr() AS host");
  res.json({ mode: "postgres", ...rows[0] });
});

app.get("/api/messages", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM messages ORDER BY date ASC");
  res.json(rows);
});

app.post("/api/messages", async (req, res) => {
  const m = req.body;
  await pool.query(
    `INSERT INTO messages (id, project_id, customer_id, sender_id, sender_name, role, text, date, category, is_escalated, is_archived) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [m.id, m.project_id, m.customer_id, m.sender_id, m.sender_name, m.role, m.text, m.date, m.category, m.is_escalated, m.is_archived]
  );
  res.json({ success: true });
});

initDb()
  .then(() => app.listen(PORT, "0.0.0.0", () => console.log("API live")))
  .catch((e) => {
    console.error("BOOT ERROR:", e);
    process.exit(1);
  });