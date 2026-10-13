// SmartBuy / TrueOutlay backend — zero dependencies, Node 18+.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { products, CATEGORIES, MERCHANTS } = require("./src/products");
const { buildEmiTable, DEFAULT_TENURES } = require("./src/emi");
const { buildSimulated, decodeSimId } = require("./src/simulate");
const { createStore } = require("./src/store");

const PUBLIC_DIR = path.join(__dirname, "public");
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};
const USER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function findProduct(id) {
  if (typeof id === "string" && id.startsWith("sim_")) return decodeSimId(id);
  const n = Number(id);
  return products.find((p) => p.id === n) || null;
}

function filterProducts({ q, category, merchant, minDiscount, maxPrice }) {
  const query = (q || "").toLowerCase().trim();
  const minDisc = parseFloat(minDiscount) || 0;
  const maxP = maxPrice !== undefined && maxPrice !== "" ? parseFloat(maxPrice) : Infinity;
  return products.filter((p) => {
    if (!p.name.toLowerCase().includes(query)) return false;
    if (category && category !== "All" && p.category !== category) return false;
    return p.merchants.some((m) =>
      (!merchant || merchant === "All" || m.name === merchant) &&
      m.discount >= minDisc && m.price <= maxP);
  });
}

function recommendationsFor(store, userId) {
  const u = store.getUser(userId);
  if (!u) return { topCategory: null, products: [] };
  let top = null, best = 0;
  for (const [cat, count] of Object.entries(u.categories)) {
    if (count > best) { best = count; top = cat; }
  }
  return { topCategory: top, products: top ? products.filter((p) => p.category === top) : [] };
}

function readJson(req, limit = 10 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, "Request body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new HttpError(400, "Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

function createApp({ dataDir = process.env.DATA_DIR || path.join(__dirname, "data"), corsOrigin = process.env.CORS_ORIGIN || "*" } = {}) {
  const store = createStore(dataDir);

  function send(res, status, body) {
    const data = JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(data) });
    res.end(data);
  }

  async function handleApi(req, res, url) {
    const { pathname, searchParams } = url;
    const method = req.method;
    const segs = pathname.split("/").filter(Boolean).slice(1); // drop "api"

    if (method === "GET" && segs[0] === "health" && segs.length === 1)
      return send(res, 200, { status: "ok", time: new Date().toISOString() });

    if (method === "GET" && segs[0] === "meta" && segs.length === 1)
      return send(res, 200, { categories: CATEGORIES, merchants: MERCHANTS, tenures: DEFAULT_TENURES });

    if (segs[0] === "products") {
      if (method === "GET" && segs.length === 1) {
        const params = Object.fromEntries(searchParams);
        let results = filterProducts(params);
        let simulated = false;
        const q = (params.q || "").trim();
        if (results.length === 0 && q.length > 2 && params.simulate !== "false") {
          results = [buildSimulated(q, params.category)];
          simulated = true;
        }
        return send(res, 200, { count: results.length, simulated, products: results });
      }
      if (method === "GET" && segs.length === 2) {
        const p = findProduct(segs[1]);
        if (!p) throw new HttpError(404, "Product not found");
        return send(res, 200, p);
      }
      if (method === "GET" && segs.length === 3 && segs[2] === "emi") {
        const p = findProduct(segs[1]);
        if (!p) throw new HttpError(404, "Product not found");
        const down = parseFloat(searchParams.get("downPayment")) || 0;
        if (down < 0 || down > 1e8) throw new HttpError(400, "downPayment out of range");
        let tenures = DEFAULT_TENURES;
        if (searchParams.get("tenures")) {
          tenures = searchParams.get("tenures").split(",").map(Number);
          if (!tenures.length || tenures.length > 12 || tenures.some((t) => !Number.isInteger(t) || t < 1 || t > 60))
            throw new HttpError(400, "tenures must be comma-separated whole months between 1 and 60");
        }
        return send(res, 200, { product: { id: p.id, name: p.name }, ...buildEmiTable(p, down, tenures) });
      }
    }

    if (method === "POST" && segs[0] === "activity" && segs.length === 1) {
      const { userId, productId } = await readJson(req);
      if (!USER_ID_RE.test(userId || "")) throw new HttpError(400, "userId must be 8-64 chars: letters, digits, _ or -");
      const p = findProduct(productId);
      if (!p) throw new HttpError(404, "Product not found");
      store.recordClick(userId, p);
      return send(res, 201, { ok: true, ...recommendationsFor(store, userId) });
    }

    if (method === "GET" && segs[0] === "recommendations" && segs.length === 1) {
      const userId = searchParams.get("userId") || "";
      if (!USER_ID_RE.test(userId)) throw new HttpError(400, "Valid userId required");
      return send(res, 200, recommendationsFor(store, userId));
    }

    throw new HttpError(404, "Route not found");
  }

  function serveStatic(req, res, pathname) {
    let rel = decodeURIComponent(pathname);
    if (rel === "/") rel = "/index.html";
    const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
    fs.readFile(filePath, (err, buf) => {
      if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(buf);
    });
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
      if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res, url.pathname);
      throw new HttpError(405, "Method not allowed");
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      console.error(e);
      send(res, 500, { error: "Internal server error" });
    }
  });

  return { server, store };
}

module.exports = { createApp };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const { server, store } = createApp();
  server.listen(port, () => console.log(`SmartBuy API + frontend running at http://localhost:${port}`));
  const shutdown = () => store.flush().then(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
