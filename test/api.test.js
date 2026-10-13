const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../server");

let server, store, base;
const uid = "testuser-12345678";

test.before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smartbuy-"));
  ({ server, store } = createApp({ dataDir: dir }));
  await new Promise((r) => server.listen(0, r));
  base = "http://127.0.0.1:" + server.address().port;
});
test.after(async () => { await store.flush(); server.close(); });

const get = (p) => fetch(base + p).then(async (r) => ({ status: r.status, body: await r.json() }));
const post = (p, b) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
  .then(async (r) => ({ status: r.status, body: await r.json() }));

test("health", async () => { assert.equal((await get("/api/health")).body.status, "ok"); });

test("lists all products and filters by category/merchant/price", async () => {
  assert.equal((await get("/api/products")).body.count, 5);
  assert.equal((await get("/api/products?category=Audio")).body.count, 1);
  assert.equal((await get("/api/products?q=oneplus")).body.products[0].id, 5);
  // Only the Sony headphones have an offer at or under 27,000
  const r = await get("/api/products?maxPrice=27000&simulate=false");
  assert.deepEqual(r.body.products.map((p) => p.id), [2]);
  assert.equal((await get("/api/products?minDiscount=22&simulate=false")).body.products[0].id, 2);
});

test("simulated product is deterministic and rebuildable by id", async () => {
  const a = (await get("/api/products?q=pixel%20phone")).body;
  const b = (await get("/api/products?q=pixel%20phone")).body;
  assert.equal(a.simulated, true);
  assert.deepEqual(a.products[0], b.products[0]);
  const byId = await get("/api/products/" + a.products[0].id);
  assert.equal(byId.status, 200);
  assert.equal(byId.body.name, a.products[0].name);
});

test("simulated names are sanitised", async () => {
  const r = (await get("/api/products?q=" + encodeURIComponent("<script>alert(1)</script>"))).body;
  assert.ok(!/[<>]/.test(r.products[0].name));
});

test("EMI math matches the original frontend formula", async () => {
  // iPhone @ Croma, 12% APR, minDown 5000, 12 months: loan 64900, interest 7788, total 72688
  const r = (await get("/api/products/1/emi?downPayment=0")).body;
  const row = r.rows.find((x) => x.platform === "Croma" && x.tenureMonths === 12);
  assert.equal(row.downPayment, 5000);
  assert.equal(row.loanAmount, 64900);
  assert.equal(row.interestAmount, 7788);
  assert.equal(row.monthlyInstallment, 6057.33);
  assert.equal(row.totalOutlay, 5000 + 72688 + 299);
  assert.ok(r.bestPlan.totalOutlay <= Math.min(...r.rows.map((x) => x.totalOutlay)));
});

test("EMI validation and 404s", async () => {
  assert.equal((await get("/api/products/1/emi?downPayment=-5")).status, 400);
  assert.equal((await get("/api/products/1/emi?tenures=0,abc")).status, 400);
  assert.equal((await get("/api/products/999")).status, 404);
  assert.equal((await get("/api/nope")).status, 404);
});

test("activity tracking drives recommendations", async () => {
  assert.deepEqual((await get("/api/recommendations?userId=" + uid)).body.products, []);
  await post("/api/activity", { userId: uid, productId: 1 });
  await post("/api/activity", { userId: uid, productId: 5 });
  await post("/api/activity", { userId: uid, productId: 2 });
  const r = (await get("/api/recommendations?userId=" + uid)).body;
  assert.equal(r.topCategory, "Smartphones");
  assert.deepEqual(r.products.map((p) => p.id), [1, 5]);
});

test("activity validation", async () => {
  assert.equal((await post("/api/activity", { userId: "x", productId: 1 })).status, 400);
  assert.equal((await post("/api/activity", { userId: uid, productId: 999 })).status, 404);
  const bad = await fetch(base + "/api/activity", { method: "POST", body: "{not json" });
  assert.equal(bad.status, 400);
});

test("serves frontend and blocks path traversal", async () => {
  const home = await fetch(base + "/");
  assert.equal(home.status, 200);
  assert.match(await home.text(), /TrueOutlay/);
  const evil = await fetch(base + "/..%2f..%2fserver.js");
  assert.notEqual(evil.status, 200);
});
