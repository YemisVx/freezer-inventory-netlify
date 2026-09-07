const CATEGORIES = [
  { id: "bread", label: "Bread & rolls", emoji: "🍞" },
  { id: "baked", label: "Baked goods", emoji: "🥐" },
  { id: "meat", label: "Meat", emoji: "🥩" },
  { id: "poultry", label: "Poultry", emoji: "🍗" },
  { id: "veg", label: "Vegetables", emoji: "🥕" },
  { id: "other", label: "Other", emoji: "📦" },
];
const catMeta = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

const app = document.getElementById("app");
let data = null;
let view = pathToView(location.pathname);
let query = "";
let addForm = { name: "", category: "other", qty: 1 };
let showAdd = false;
let toast = "";

function pathToView(path) {
  if (path === "/freezer1") return "freezer1";
  if (path === "/freezer2") return "freezer2";
  return "home";
}

function goTo(v) {
  view = v;
  showAdd = false;
  query = "";
  const path = v === "home" ? "/" : `/${v}`;
  history.pushState({}, "", path);
  render();
}

window.addEventListener("popstate", () => {
  view = pathToView(location.pathname);
  render();
});

function monthsAgo(dateStr) {
  if (!dateStr) return 0;
  const then = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

async function loadData() {
  const res = await fetch("/api/inventory");
  data = await res.json();
  render();
}

async function addItem() {
  if (!addForm.name.trim() || view === "home") return;
  try {
    const res = await fetch(`/api/freezers/${view}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    if (!res.ok) throw new Error();
    data[view] = await res.json();
  } catch {
    toast = "Couldn't save — check the connection.";
  }
  addForm = { name: "", category: "other", qty: 1 };
  showAdd = false;
  render();
}

async function changeQty(freezerId, itemId, delta) {
  try {
    const res = await fetch(`/api/freezers/${freezerId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta }),
    });
    if (!res.ok) throw new Error();
    data[freezerId] = await res.json();
  } catch {
    toast = "Couldn't save — check the connection.";
  }
  render();
}

async function removeItem(freezerId, itemId) {
  try {
    const res = await fetch(`/api/freezers/${freezerId}/items/${itemId}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    data[freezerId] = await res.json();
  } catch {
    toast = "Couldn't save — check the connection.";
  }
  render();
}

function existingMatch() {
  if (!addForm.name.trim() || !data || view === "home") return null;
  const key = addForm.name.trim().toLowerCase().replace(/\s+/g, " ");
  return data[view].items.find((i) => i.key === key) || null;
}

function render() {
  if (!data) {
    app.innerHTML = `<div class="empty-state">Loading inventory…</div>`;
    return;
  }
  app.innerHTML = view === "home" ? renderHome() : renderFreezer();
  attachHandlers();
}

function renderHome() {
  const total = (f) => data[f].items.reduce((s, i) => s + i.qty, 0);
  const cardHtml = (fid) => {
    const items = data[fid].items;
    const topCats = [...new Set(items.map((i) => i.category))].slice(0, 3);
    return `
      <button class="freezer-card" data-goto="${fid}">
        <div class="freezer-card-top">
          <span>❄️</span>
          <span class="freezer-count">${total(fid)}</span>
        </div>
        <div class="freezer-name">${data[fid].name}</div>
        <div class="freezer-cat-row">
          ${topCats.length === 0 ? `<span class="empty-tag">Empty</span>` :
            topCats.map((c) => `<span class="cat-pill">${catMeta(c).emoji} ${catMeta(c).label}</span>`).join("")}
        </div>
      </button>`;
  };

  return `
    <div class="header"><span>❄️</span><h1>Chest freezers</h1></div>
    <p class="sub">Tap a freezer to see what's inside.</p>
    <div class="freezer-grid">
      ${cardHtml("freezer1")}
      ${cardHtml("freezer2")}
    </div>
    <div class="qr-note">
      <div class="qr-note-title">Freezer door stickers</div>
      <p class="qr-note-body">
        Generate a QR code for <strong>yourhost:PORT/freezer1</strong> and another for
        <strong>/freezer2</strong> — each opens straight to that freezer's list, no
        home screen tap needed.
      </p>
    </div>
    ${toast ? `<div class="toast">${toast}</div>` : ""}
  `;
}

function renderFreezer() {
  const freezer = data[view];
  const filtered = freezer.items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
  const grouped = CATEGORIES.map((c) => ({ ...c, items: filtered.filter((i) => i.category === c.id) }))
    .filter((c) => c.items.length > 0);

  const itemsHtml = grouped.map((cat) => `
    <div style="margin-bottom:18px">
      <div class="cat-header"><span>${cat.emoji}</span><span>${cat.label}</span></div>
      ${cat.items.map((item) => {
        const age = monthsAgo(item.dateAdded);
        return `
        <div class="item-row">
          <div style="flex:1;min-width:0">
            <div class="item-name">${item.name}</div>
            <div class="item-meta">
              🕒 ${age <= 0 ? "added this month" : `${age} mo ago`}
              ${age >= 6 ? `<span class="aged-tag">use soon</span>` : ""}
            </div>
          </div>
          <div class="qty-controls">
            <button class="qty-btn" data-qty="${view}|${item.id}|-1">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" data-qty="${view}|${item.id}|1">+</button>
          </div>
          <button class="delete-btn" data-delete="${view}|${item.id}">🗑</button>
        </div>`;
      }).join("")}
    </div>`).join("");

  const match = existingMatch();

  return `
    <div class="header-row">
      <button class="back-btn" data-goto="home">‹</button>
      <h1>${freezer.name}</h1>
    </div>
    <div class="search-wrap">
      <span>🔍</span>
      <input id="search" placeholder="Search items…" value="${query}" />
    </div>
    ${grouped.length === 0 ? `<div class="empty-state">${freezer.items.length === 0 ? "Nothing logged yet." : "No matches."}</div>` : itemsHtml}
    <button class="fab" id="openAdd">+</button>
    ${showAdd ? `
      <div class="modal-overlay" id="overlay">
        <div class="modal" id="modalBox">
          <div class="modal-header">
            <span class="modal-title">Add to ${freezer.name}</span>
            <button class="icon-btn" id="closeAdd">✕</button>
          </div>
          <label class="field-label">What is it?</label>
          <input id="itemName" class="text-input" placeholder="e.g. Challah rolls" value="${addForm.name}" autofocus />
          ${match ? `<p class="merge-hint">Already have "${match.name}" (${match.qty}) — this'll add to it, not duplicate it.</p>` : ""}
          <label class="field-label">Category</label>
          <div class="cat-grid">
            ${CATEGORIES.map((c) => `
              <button class="cat-choice ${addForm.category === c.id ? "active" : ""}" data-cat="${c.id}">
                ${c.emoji} ${c.label}
              </button>`).join("")}
          </div>
          <label class="field-label">Quantity</label>
          <div class="qty-controls">
            <button class="qty-btn" id="qtyMinus">−</button>
            <span class="qty-num">${addForm.qty}</span>
            <button class="qty-btn" id="qtyPlus">+</button>
          </div>
          <button class="save-btn" id="saveItem">Add item</button>
        </div>
      </div>` : ""}
    ${toast ? `<div class="toast">${toast}</div>` : ""}
  `;
}

function attachHandlers() {
  app.querySelectorAll("[data-goto]").forEach((el) =>
    el.addEventListener("click", () => goTo(el.dataset.goto))
  );
  app.querySelectorAll("[data-qty]").forEach((el) =>
    el.addEventListener("click", () => {
      const [fid, id, delta] = el.dataset.qty.split("|");
      changeQty(fid, id, Number(delta));
    })
  );
  app.querySelectorAll("[data-delete]").forEach((el) =>
    el.addEventListener("click", () => {
      const [fid, id] = el.dataset.delete.split("|");
      removeItem(fid, id);
    })
  );

  const search = document.getElementById("search");
  if (search) {
    search.addEventListener("input", (e) => {
      query = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const el = document.getElementById("search");
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  const openAdd = document.getElementById("openAdd");
  if (openAdd) openAdd.addEventListener("click", () => { showAdd = true; render(); });

  const closeAdd = document.getElementById("closeAdd");
  if (closeAdd) closeAdd.addEventListener("click", () => { showAdd = false; render(); });

  const overlay = document.getElementById("overlay");
  if (overlay) overlay.addEventListener("click", (e) => {
    if (e.target.id === "overlay") { showAdd = false; render(); }
  });

  const itemName = document.getElementById("itemName");
  if (itemName) {
    itemName.addEventListener("input", (e) => {
      addForm.name = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const el = document.getElementById("itemName");
      el.focus();
      el.setSelectionRange(pos, pos);
    });
    itemName.addEventListener("keydown", (e) => { if (e.key === "Enter") addItem(); });
  }

  app.querySelectorAll("[data-cat]").forEach((el) =>
    el.addEventListener("click", () => { addForm.category = el.dataset.cat; render(); })
  );

  const qtyMinus = document.getElementById("qtyMinus");
  if (qtyMinus) qtyMinus.addEventListener("click", () => { addForm.qty = Math.max(1, addForm.qty - 1); render(); });
  const qtyPlus = document.getElementById("qtyPlus");
  if (qtyPlus) qtyPlus.addEventListener("click", () => { addForm.qty += 1; render(); });

  const saveItem = document.getElementById("saveItem");
  if (saveItem) saveItem.addEventListener("click", addItem);
}

loadData();
