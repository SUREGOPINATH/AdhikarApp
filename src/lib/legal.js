import thresholds from "../../config/jurisdiction-thresholds.json" with { type: "json" };

export function getForum(value) {
  return thresholds.bands.find(
    (band) => band.max === null || Number(value) <= band.max,
  );
}

export function getAnnexures(data) {
  const items = ["Invoice / purchase receipt", "Payment proof"];
  if (data.nature === "defective product")
    items.push("Unboxing video / defect photographs");
  if (data.nature === "non-delivery") items.push("Tracking and delivery logs");

  const aliases = {
    "invoice / receipt": "Invoice / purchase receipt",
    "invoice / purchase receipt": "Invoice / purchase receipt",
    "payment receipt / bank statement": "Payment proof",
    "payment proof": "Payment proof",
    "screenshots / photos": "Photos / videos",
    "photos / videos": "Photos / videos",
  };
  const seen = new Set();

  return [...items, ...(data.evidence || [])].filter((item) => {
    const normalized = item.trim().toLowerCase().replace(/\s+/g, " ");
    const canonical = normalized.includes("invoice")
      ? "Invoice / purchase receipt"
      : normalized.includes("payment") || normalized.includes("bank statement")
        ? "Payment proof"
        : normalized.includes("photo") || normalized.includes("video") || normalized.includes("screenshot")
          ? "Photos / videos"
          : aliases[normalized] || item.trim();
    const key = canonical.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}