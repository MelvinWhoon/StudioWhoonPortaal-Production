import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";
import nodemailer from "nodemailer";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

// Setup cron job to keep Supabase alive
// Runs every day at 03:00 AM
cron.schedule("0 3 * * *", async () => {
  console.log("Running daily keep-alive cron job for Supabase...");
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Keep-alive failed: Missing Supabase URL or Key in environment variables.");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from('projects').select('id').limit(1);
    
    if (error) {
      console.error('Keep-alive query error:', error);
    } else {
      console.log('Keep-alive query successful at', new Date().toISOString());
    }
  } catch (e) {
    console.error('Keep-alive exception:', e);
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Routes
app.post("/api/send_mail", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email en wachtwoord zijn verplicht." });
  }

  try {
    // In a real production environment, configure SMTP settings via env variables
    // For now, we simulate success if SMTP is not configured, or use a test account
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.example.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || "test",
        pass: process.env.SMTP_PASS || "test",
      },
    });

    const mailOptions = {
      from: '"Global Interior Concepts" <no-reply@globalinteriorconcepts.com>',
      to: email,
      subject: "Uw account voor Global Interior Concepts is aangemaakt",
      text: `Beste klant,\n\nUw account is succesvol aangemaakt.\n\nU kunt inloggen via: https://www.globalinteriorconcepts.com/\n\nUw inloggegevens:\nE-mailadres: ${email}\nWachtwoord: ${password}\n\nMet vriendelijke groet,\nGlobal Interior Concepts`,
    };

    // If no real SMTP is configured, we just log and return success
    if (!process.env.SMTP_HOST) {
      console.log("Simulating email send (no SMTP_HOST configured):", mailOptions);
      return res.json({ success: true, message: "E-mail succesvol gesimuleerd (geen SMTP config)." });
    }

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "E-mail succesvol verzonden." });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ success: false, message: "Fout bij verzenden van e-mail." });
  }
});

// Vite middleware for development
async function startServer() {
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
