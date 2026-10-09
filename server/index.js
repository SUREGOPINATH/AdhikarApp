import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Legal thresholds and filing rules change; verify current law before relying on generated documents.
const app = express()
const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const draftTtlMs = 7 * 24 * 60 * 60 * 1000
const dataDirectory = path.join(serverDirectory, '../data')
fs.mkdirSync(dataDirectory, { recursive: true })
const database = new Database(path.join(dataDirectory, 'adhikar.db'))
database.exec(`CREATE TABLE IF NOT EXISTS drafts (id INTEGER PRIMARY KEY AUTOINCREMENT, resume_code TEXT NOT NULL UNIQUE, draft_type TEXT NOT NULL CHECK (draft_type IN ('rti', 'consumer')), form_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_drafts_resume_code ON drafts(resume_code);`)
app.use(express.json())
app.use(express.static(path.join(serverDirectory, '../dist')))
app.get('/api/health', (_req, res) => res.json({ name: 'Adhikar', status: 'ok' }))
function cleanExpiredDrafts() { database.prepare('DELETE FROM drafts WHERE expires_at < ?').run(new Date().toISOString()) }
function createResumeCode() { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code; do { code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('') } while (database.prepare('SELECT 1 FROM drafts WHERE resume_code = ?').get(code)); return code }
app.post('/api/drafts', (req, res) => { cleanExpiredDrafts(); const code = String(req.body.resumeCode || '').trim().toUpperCase() || createResumeCode(); const draftType = req.body.type === 'rti' ? 'rti' : 'consumer'; const formData = req.body.data || req.body; const now = new Date().toISOString(); const existing = database.prepare('SELECT created_at FROM drafts WHERE resume_code = ?').get(code); const createdAt = existing?.created_at || now; const expiresAt = new Date(Date.parse(createdAt) + draftTtlMs).toISOString(); database.prepare('INSERT INTO drafts (resume_code, draft_type, form_data, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(resume_code) DO UPDATE SET draft_type=excluded.draft_type, form_data=excluded.form_data, updated_at=excluded.updated_at, expires_at=excluded.expires_at').run(code, draftType, JSON.stringify(formData), createdAt, now, expiresAt); res.status(201).json({ code, expiresAt }) })
app.get('/api/drafts/:code', (req, res) => { cleanExpiredDrafts(); const draft = database.prepare('SELECT * FROM drafts WHERE resume_code = ? AND expires_at >= ?').get(req.params.code.toUpperCase(), new Date().toISOString()); if (!draft) return res.status(404).json({ error: 'Resume code not found or expired.' }); res.json({ type: draft.draft_type, formData: JSON.parse(draft.form_data), expiresAt: draft.expires_at }) })
setInterval(cleanExpiredDrafts, 3 * 60 * 60 * 1000)
app.post('/api/pdf', async (req, res) => {
  const { title = 'Adhikar document', content = '' } = req.body
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pageWidth = 595
  const pageHeight = 842
  const margin = 50
  const footer = 'This tool helps you draft correctly but does not provide legal advice. Verify current fees, formats, and jurisdiction rules before filing, as these can change.'
  let page
  let y
  function addPage() {
    page = pdf.addPage([pageWidth, pageHeight])
    y = pageHeight - 52
    page.drawText(footer, { x: margin, y: 24, size: 6.5, font, color: rgb(.42, .45, .43), maxWidth: pageWidth - margin * 2 })
  }
  function writeLine(line, size = 10, color = rgb(0, 0, 0)) {
    if (!page || y < 48) addPage()
    page.drawText(line, { x: margin, y, size, font, color })
    y -= size + 6
  }
  function wrapLine(line, size = 10) {
    const normalized = line.replaceAll('₹', 'Rs. ')
    if (!normalized.trim()) { y -= 8; return }
    const words = normalized.split(/\s+/)
    let current = ''
    const maxWidth = pageWidth - margin * 2
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate
      else { if (current) writeLine(current, size); current = word }
    }
    if (current) writeLine(current, size)
  }
  addPage()
  writeLine(title, 16, rgb(.09, .27, .23))
  y -= 8
  content.split('\n').forEach(line => wrapLine(line))
  res.setHeader('Content-Type', 'application/pdf'); res.send(Buffer.from(await pdf.save()))
})
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
  res.sendFile(path.join(serverDirectory, '../dist/index.html'))
})
app.listen(3001, () => console.log('Adhikar API listening on http://localhost:3001'))
