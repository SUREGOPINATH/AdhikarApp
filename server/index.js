import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Legal thresholds and filing rules change; verify current law before relying on generated documents.
const app = express()
const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const drafts = new Map()
const draftTtlMs = 7 * 24 * 60 * 60 * 1000
app.use(express.json())
app.use(express.static(path.join(serverDirectory, '../dist')))
app.get('/api/health', (_req, res) => res.json({ name: 'Adhikar', status: 'ok' }))
function cleanExpiredDrafts() { const now = Date.now(); for (const [code, draft] of drafts) if (draft.expiresAt <= now) drafts.delete(code) }
function createResumeCode() { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code; do { code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('') } while (drafts.has(code)); return code }
app.post('/api/drafts', (req, res) => { cleanExpiredDrafts(); const code = createResumeCode(); drafts.set(code, { data: req.body, expiresAt: Date.now() + draftTtlMs }); res.status(201).json({ code, expiresAt: new Date(Date.now() + draftTtlMs).toISOString() }) })
app.get('/api/drafts/:code', (req, res) => { cleanExpiredDrafts(); const draft = drafts.get(req.params.code.toUpperCase()); if (!draft) return res.status(404).json({ error: 'Resume code not found or expired.' }); res.json({ data: draft.data, expiresAt: new Date(draft.expiresAt).toISOString() }) })
setInterval(cleanExpiredDrafts, 60 * 60 * 1000)
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
