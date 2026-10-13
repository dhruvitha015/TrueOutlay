// Tiny JSON-file store for user activity (category click counts).
// Writes are atomic (temp file + rename) and serialized through a promise chain.
const fs = require("fs");
const path = require("path");

function createStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "activity.json");
  let db = { users: {} };
  try {
    db = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!db.users) db = { users: {} };
  } catch { /* first run or unreadable file: start fresh */ }

  let queue = Promise.resolve();
  function persist() {
    queue = queue.then(async () => {
      const tmp = file + ".tmp";
      await fs.promises.writeFile(tmp, JSON.stringify(db));
      await fs.promises.rename(tmp, file);
    }).catch((e) => console.error("persist failed:", e.message));
    return queue;
  }

  return {
    recordClick(userId, product) {
      const u = (db.users[userId] ||= { categories: {}, events: [] });
      u.categories[product.category] = (u.categories[product.category] || 0) + 1;
      u.events.push({ productId: product.id, category: product.category, at: new Date().toISOString() });
      if (u.events.length > 100) u.events = u.events.slice(-100);
      persist();
      return u;
    },
    getUser(userId) { return db.users[userId] || null; },
    flush() { return queue; }
  };
}

module.exports = { createStore };
