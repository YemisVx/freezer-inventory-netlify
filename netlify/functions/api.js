// Freezer inventory API — Netlify Function.
// Storage is Netlify Blobs, which is durable and persists between
// invocations (unlike a plain serverless function's local disk).

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

const FREEZER_IDS = ["freezer1", "freezer2"];
const FUNCTION_PREFIX = "/.netlify/functions/api";

// ---------- storage ----------

function emptyData() {
  return {
    freezer1: { name: "Freezer 1", items: [] },
    freezer2: { name: "Freezer 2", items: [] },
  };
}

async function loadData(store) {
  const data = await store.get("inventory", { type: "json" });
  return data || emptyData();
}

async function saveData(store, data) {
  await store.setJSON("inventory", data);
}

// ---------- name normalization ----------
// "chicken", "Chicken", "CHICKEN ", "chicken  " all collapse to the same
// entry so quantities merge instead of forking into duplicate rows.
// (Distinct items like "chicken breast" vs "chicken thighs" still stay
// separate — this only catches exact matches after trim/case-fold.)

function normalizeKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCase(name) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function findExisting(items, name) {
  const key = normalizeKey(name);
  return items.find((i) => i.key === key);
}

// ---------- response helper ----------

function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

// ---------- handler ----------

exports.handler = async (event) => {
  const store = getStore("freezer-inventory");
  const method = event.httpMethod;
  let path = event.path.startsWith(FUNCTION_PREFIX)
    ? event.path.slice(FUNCTION_PREFIX.length)
    : event.path;
  if (!path) path = "/";

  if (method === "GET" && path === "/inventory") {
    return json(200, await loadData(store));
  }

  // POST /freezers/:freezerId/items
  let m = path.match(/^\/freezers\/(freezer1|freezer2)\/items$/);
  if (method === "POST" && m) {
    const freezerId = m[1];
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON" });
    }
    const { name, category, qty } = body;
    if (!name || !String(name).trim()) {
      return json(400, { error: "Item name is required" });
    }

    const data = await loadData(store);
    const items = data[freezerId].items;
    const addQty = Math.max(1, Number(qty) || 1);
    const existing = findExisting(items, name);
    const today = new Date().toISOString().slice(0, 10);

    if (existing) {
      existing.qty += addQty;
      existing.lastAdded = today;
    } else {
      items.push({
        id: crypto.randomUUID(),
        key: normalizeKey(name),
        name: titleCase(name),
        category: category || "other",
        qty: addQty,
        dateAdded: today,
        lastAdded: today,
      });
    }
    await saveData(store, data);
    return json(200, data[freezerId]);
  }

  // PATCH /freezers/:freezerId/items/:itemId
  m = path.match(/^\/freezers\/(freezer1|freezer2)\/items\/([^/]+)$/);
  if (method === "PATCH" && m) {
    const [, freezerId, itemId] = m;
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON" });
    }
    const data = await loadData(store);
    const items = data[freezerId].items;
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1) return json(404, { error: "Item not found" });

    items[idx].qty += Number(body.delta) || 0;
    if (items[idx].qty <= 0) items.splice(idx, 1);

    await saveData(store, data);
    return json(200, data[freezerId]);
  }

  // DELETE /freezers/:freezerId/items/:itemId
  if (method === "DELETE" && m) {
    const [, freezerId, itemId] = m;
    const data = await loadData(store);
    data[freezerId].items = data[freezerId].items.filter((i) => i.id !== itemId);
    await saveData(store, data);
    return json(200, data[freezerId]);
  }

  return json(404, { error: "Not found" });
};
