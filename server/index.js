import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Legal thresholds and filing rules change; verify current law before relying on generated documents.
const app = express()
const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
app.use(express.json())
app.use(express.static(path.join(serverDirectory, '../dist')))
app.get('/api/health', (_req, res) => res.json({ name: 'Adhikar', status: 'ok' }))
app.post('/api/pdf', async (req, res) => {
  const { title = 'Adhikar document', content = '' } = req.body
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  let page = pdf.addPage([595, 842]); let y = 790
  page.drawText(title, { x: 50, y, size: 16, font, color: rgb(.09,.27,.23) }); y -= 35
  content.split('\n').forEach(line => { if (y < 55) { page = pdf.addPage([595,842]); y = 790 } page.drawText(line.replaceAll('₹', 'Rs. ').slice(0, 105), { x: 50, y, size: 10, font }); y -= 16 })
  res.setHeader('Content-Type', 'application/pdf'); res.send(Buffer.from(await pdf.save()))
})
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
  res.sendFile(path.join(serverDirectory, '../dist/index.html'))
})
app.listen(3001, () => console.log('Adhikar API listening on http://localhost:3001'))
