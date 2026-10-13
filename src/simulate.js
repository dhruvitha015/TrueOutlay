// Deterministic "simulated deal" for searches that are not in the catalog.
// The product id encodes the query + category, so the same id always rebuilds
// the same product (no server-side state needed).
const { CATEGORIES } = require("./products");

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const clean = (s) => String(s).replace(/[<>"'`&]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);

function encodeSimId(query, category) {
  return "sim_" + Buffer.from(JSON.stringify({ q: clean(query), c: category }), "utf8").toString("base64url");
}

function buildSimulated(query, category) {
  const q = clean(query);
  const cat = CATEGORIES.includes(category) ? category : "Smartphones";
  const base = 10000 + (hash(q.toLowerCase()) % 20000);
  return {
    id: encodeSimId(q, cat),
    name: q.charAt(0).toUpperCase() + q.slice(1) + " (Simulated Deal)",
    category: cat,
    simulated: true,
    history: [base + 3000, base + 1000, base],
    merchants: [
      { name: "Amazon India", price: base - 1000, discount: 15, apr: 0, minDown: 0, fee: 99 },
      { name: "Flipkart", price: base, discount: 10, apr: 12, minDown: 1000, fee: 199 },
      { name: "Croma", price: base + 500, discount: 5, apr: 14, minDown: 0, fee: 299 }
    ]
  };
}

function decodeSimId(id) {
  try {
    if (typeof id !== "string" || !id.startsWith("sim_") || id.length > 300) return null;
    const { q, c } = JSON.parse(Buffer.from(id.slice(4), "base64url").toString("utf8"));
    if (typeof q !== "string" || q.length < 3) return null;
    return buildSimulated(q, c);
  } catch {
    return null;
  }
}

module.exports = { buildSimulated, decodeSimId };
