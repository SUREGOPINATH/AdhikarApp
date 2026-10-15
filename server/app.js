import express from "express";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export function createApp({
  databasePath = path.resolve("data/adhikar.db"),
  distDirectory = path.resolve("dist"),
  cleanupIntervalMs = 3 * 60 * 60 * 1000,
} = {}) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resume_code TEXT NOT NULL UNIQUE,
      draft_type TEXT NOT NULL CHECK (draft_type IN ('rti', 'consumer')),
      form_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_drafts_resume_code ON drafts(resume_code);
  `);

  const app = express();
  app.use(express.json());
  app.use(express.static(distDirectory));

  function cleanExpiredDrafts() {
    database
      .prepare("DELETE FROM drafts WHERE expires_at < ?")
      .run(new Date().toISOString());
  }

  function createResumeCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    do {
      code = Array.from(
        { length: 6 },
        () => alphabet[Math.floor(Math.random() * alphabet.length)],
      ).join("");
    } while (database.prepare("SELECT 1 FROM drafts WHERE resume_code = ?").get(code));
    return code;
  }

  app.get("/api/health", (_req, res) => res.json({ name: "Adhikar", status: "ok" }));
  app.post("/api/drafts", (req, res) => {
    cleanExpiredDrafts();
    if (!req.body || !["rti", "consumer"].includes(req.body.type) || !req.body.data || typeof req.body.data !== "object") {
      return res.status(400).json({ error: "Draft type and form data are required." });
    }
    const requestedCode = String(req.body.resumeCode || "").trim().toUpperCase();
    if (requestedCode && !/^[A-Z0-9]{6}$/.test(requestedCode)) {
      return res.status(400).json({ error: "Resume codes must contain exactly 6 letters or digits." });
    }
    const code = requestedCode || createResumeCode();
    const now = new Date().toISOString();
    const existing = database
      .prepare("SELECT created_at FROM drafts WHERE resume_code = ?")
      .get(code);
    const createdAt = existing?.created_at || now;
    const expiresAt = new Date(Date.parse(createdAt) + 7 * 24 * 60 * 60 * 1000).toISOString();
    database.prepare(`
      INSERT INTO drafts (resume_code, draft_type, form_data, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(resume_code) DO UPDATE SET
        draft_type = excluded.draft_type,
        form_data = excluded.form_data,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at
    `).run(code, req.body.type, JSON.stringify(req.body.data), createdAt, now, expiresAt);
    return res.status(201).json({ code, expiresAt });
  });

  app.get("/api/drafts/:code", (req, res) => {
    cleanExpiredDrafts();
    const draft = database
      .prepare("SELECT * FROM drafts WHERE resume_code = ? AND expires_at >= ?")
      .get(req.params.code.toUpperCase(), new Date().toISOString());
    if (!draft) return res.status(404).json({ error: "Resume code not found or expired." });
    return res.json({
      type: draft.draft_type,
      formData: JSON.parse(draft.form_data),
      expiresAt: draft.expires_at,
    });
  });

  const cleanupTimer = cleanupIntervalMs > 0
    ? setInterval(cleanExpiredDrafts, cleanupIntervalMs)
    : null;
  cleanupTimer?.unref();

  app.post("/api/pdf", async (req, res, next) => {
    try {
      const { title = "Adhikar document", content = "" } = req.body;
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const pageWidth = 595;
      const pageHeight = 842;
      const margin = 50;
      const footer = "This tool helps you draft correctly but does not provide legal advice. Verify current fees, formats, and jurisdiction rules before filing, as these can change.";
      let page;
      let y;
      function addPage() {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - 52;
        page.drawText(footer, {
          x: margin,
          y: 24,
          size: 6.5,
          font,
          color: rgb(0.42, 0.45, 0.43),
          maxWidth: pageWidth - margin * 2,
        });
      }
      function writeLine(line, size = 10, color = rgb(0, 0, 0)) {
        if (!page || y < 48) addPage();
        page.drawText(line, { x: margin, y, size, font, color });
        y -= size + 6;
      }
      function wrapLine(line, size = 10) {
        const normalized = line.replaceAll("₹", "Rs. ");
        if (!normalized.trim()) {
          y -= 8;
          return;
        }
        const words = normalized.split(/\s+/);
        let current = "";
        const maxWidth = pageWidth - margin * 2;
        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
          else {
            if (current) writeLine(current, size);
            current = word;
          }
        }
        if (current) writeLine(current, size);
      }
      addPage();
      writeLine(title, 16, rgb(0.09, 0.27, 0.23));
      y -= 8;
      String(content).split("\n").forEach((line) => wrapLine(line));
      res.setHeader("Content-Type", "application/pdf");
      return res.send(Buffer.from(await pdf.save()));
    } catch (error) {
      return next(error);
    }
  });

  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(distDirectory, "index.html"));
  });

  return {
    app,
    database,
    close() {
      if (cleanupTimer) clearInterval(cleanupTimer);
      database.close();
    },
  };
}