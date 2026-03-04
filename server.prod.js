const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool;

async function initDb() {
  pool = mysql.createPool(dbConfig);
  const c = await pool.getConnection();
  c.release();
}

app.get("/debug/db", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT @@hostname AS mysql_host, DATABASE() AS db, CURRENT_USER() AS db_user"
  );
  res.json({ mode: "mysql", ...rows[0] });
});

app.get("/api/messages", async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM messages ORDER BY `date` ASC");
  res.json(rows);
});

app.post("/api/messages", async (req, res) => {
  const m = req.body;
  await pool.query(
    "INSERT INTO messages (id, project_id, customer_id, sender_id, sender_name, role, text, date, category, is_escalated, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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