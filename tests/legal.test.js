import test from "node:test";
import assert from "node:assert/strict";
import { getAnnexures, getForum } from "../src/lib/legal.js";

test("jurisdiction uses inclusive configured boundaries", () => {
  assert.equal(getForum(1).shortName, "District Commission");
  assert.equal(getForum(5_000_000).shortName, "District Commission");
  assert.equal(getForum(20_000_000).shortName, "State Commission");
  assert.equal(getForum(100_000_000).shortName, "National Commission");
});

test("annexures normalize aliases and remove duplicate document types", () => {
  const annexures = getAnnexures({
    nature: "defective product",
    evidence: [
      "Invoice / receipt",
      "invoice / purchase receipt",
      "Payment receipt / bank statement",
      "Payment proof",
      "Screenshots / photos",
      "Photos / videos",
    ],
  });

  assert.deepEqual(annexures, [
    "Invoice / purchase receipt",
    "Payment proof",
    "Unboxing video / defect photographs",
  ]);
});