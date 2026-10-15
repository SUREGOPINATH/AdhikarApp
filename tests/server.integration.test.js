import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { PDFDocument } from "pdf-lib";
import { createApp } from "../server/app.js";

async function startServer(databasePath, tempDirectory) {
  const service = createApp({
    databasePath,
    distDirectory: tempDirectory,
    cleanupIntervalMs: 0,
  });
  const server = service.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  let closed = false;
  async function shutdown() {
    if (closed) return;
    closed = true;
    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    service.close();
  }
  return { ...service, server, shutdown, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

test("SQLite draft codes survive a server restart, upsert, and expire", async (t) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "adhikar-test-"));
  const databasePath = path.join(tempDirectory, "drafts.db");
  const servers = [];
  t.after(async () => {
    for (const server of servers) await server.shutdown();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const first = await startServer(databasePath, tempDirectory);
  servers.push(first);
  const originalForm = { name: "Test Applicant", applicantAddress: { pin: "123456" } };
  const createResponse = await fetch(`${first.baseUrl}/api/drafts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "rti", data: originalForm }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.match(created.code, /^[A-Z0-9]{6}$/);

  await first.shutdown();

  const restarted = await startServer(databasePath, tempDirectory);
  servers.push(restarted);
  let loadedResponse = await fetch(`${restarted.baseUrl}/api/drafts/${created.code}`);
  assert.equal(loadedResponse.status, 200);
  let loaded = await loadedResponse.json();
  assert.equal(loaded.type, "rti");
  assert.deepEqual(loaded.formData, originalForm);

  const updatedForm = { ...originalForm, name: "Updated Applicant" };
  const updateResponse = await fetch(`${restarted.baseUrl}/api/drafts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "rti", resumeCode: created.code, data: updatedForm }),
  });
  assert.equal(updateResponse.status, 201);
  assert.equal((await updateResponse.json()).code, created.code);
  loadedResponse = await fetch(`${restarted.baseUrl}/api/drafts/${created.code}`);
  loaded = await loadedResponse.json();
  assert.deepEqual(loaded.formData, updatedForm);

  restarted.database
    .prepare("UPDATE drafts SET expires_at = ? WHERE resume_code = ?")
    .run("2000-01-01T00:00:00.000Z", created.code);
  const expiredResponse = await fetch(`${restarted.baseUrl}/api/drafts/${created.code}`);
  assert.equal(expiredResponse.status, 404);
  assert.equal(
    restarted.database.prepare("SELECT count(*) AS count FROM drafts WHERE resume_code = ?").get(created.code).count,
    0,
  );
});

test("PDF endpoint returns a valid multi-page PDF for long content", async (t) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "adhikar-pdf-test-"));
  const databasePath = path.join(tempDirectory, "drafts.db");
  const service = await startServer(databasePath, tempDirectory);
  t.after(async () => {
    await service.shutdown();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });
  const longParagraph = `${"Long facts paragraph describing the transaction, the defect, customer support requests, and continuing loss. ".repeat(90)}FINAL SENTENCE MUST REMAIN PRESENT.`;
  const response = await fetch(`${service.baseUrl}/api/pdf`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Long consumer complaint", content: longParagraph }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/pdf/);
  const bytes = Buffer.from(await response.arrayBuffer());
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() > 1, "long content should wrap onto multiple pages");
  assert.ok(bytes.subarray(0, 5).equals(Buffer.from("%PDF-")));
});