const { Pool } = require("pg");
const { randomUUID } = require("crypto");

// adjust base URL if necessary
const BASE = process.env.BASE_URL || "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log("Starting write-endpoints smoke test");
  try {
    // project
    const project = { id: randomUUID(), name: "Test project", status: "open" };
    let resp = await fetch(`${BASE}/api/projects`, { method: "POST", body: JSON.stringify(project), headers: { "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error("project POST failed " + resp.status);
    let { rowCount } = await pool.query("SELECT * FROM projects WHERE id=$1", [project.id]);
    if (rowCount !== 1) throw new Error("project not found after insert");

    // update project
    resp = await fetch(`${BASE}/api/projects/${project.id}`, { method: "PUT", body: JSON.stringify({ city: "Amsterdam" }), headers: { "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error("project PUT failed");

    // user upsert
    const user = { id: randomUUID(), email: "test@example.com" };
    resp = await fetch(`${BASE}/api/users/upsert`, { method: "POST", body: JSON.stringify([user]), headers: { "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error("users upsert failed");
    ({ rowCount } = await pool.query("SELECT * FROM users WHERE id=$1", [user.id]));
    if (rowCount !== 1) throw new Error("user not found");

    // master package
    const mp = { id: randomUUID(), name: "mp1", project_id: project.id };
    resp = await fetch(`${BASE}/api/master_packages`, { method: "POST", body: JSON.stringify(mp), headers: { "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error("master_packages POST failed");
    ({ rowCount } = await pool.query("SELECT * FROM master_packages WHERE id=$1", [mp.id]));
    if (rowCount !== 1) throw new Error("master_package not found");

    // message
    const msg = { id: randomUUID(), customer_id: user.id, sender_id: user.id, text: "hello" };
    resp = await fetch(`${BASE}/api/messages`, { method: "POST", body: JSON.stringify(msg), headers: { "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error("messages POST failed");
    ({ rowCount } = await pool.query("SELECT * FROM messages WHERE id=$1", [msg.id]));
    if (rowCount !== 1) throw new Error("message not found");

    // document
    const doc = { id: randomUUID(), project_id: project.id, customer_id: user.id, file_name: "foo.txt", uploaded_by: user.id };
    resp = await fetch(`${BASE}/api/documents`, { method: "POST", body: JSON.stringify(doc), headers: { "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error("documents POST failed");
    ({ rowCount } = await pool.query("SELECT * FROM portal_documents WHERE id=$1", [doc.id]));
    if (rowCount !== 1) throw new Error("document not found");

    // notification
    const note = { id: randomUUID(), user_id: user.id, message: "welcome" };
    resp = await fetch(`${BASE}/api/notifications`, { method: "POST", body: JSON.stringify(note), headers: { "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error("notifications POST failed");
    ({ rowCount } = await pool.query("SELECT * FROM notifications WHERE id=$1", [note.id]));
    if (rowCount !== 1) throw new Error("notification not found");

    console.log("✅ All write endpoints behaved correctly");
  } catch (err) {
    console.error("Smoke test failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
