// TrueOutlay frontend — talks to the SmartBuy backend API (same origin by default).
// If you host the frontend separately, set API_BASE to e.g. "http://localhost:3000".
const API_BASE = "";

let activeProductForModal = null;
let currentProducts = new Map(); // id -> product, for the most recent results
let searchTimer = null;
let emiTimer = null;

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatINR(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

async function api(path, options) {
  const res = await fetch(API_BASE + path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Request failed (" + res.status + ")");
  return body;
}

function getUserId() {
  let id = localStorage.getItem("trueOutlayUserId");
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
    localStorage.setItem("trueOutlayUserId", id);
  }
  return id;
}

function renderCards(productList, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (productList.length === 0) {
    container.innerHTML = "<p style='color: var(--text-muted);'>No products found matching your search criteria.</p>";
    return;
  }

  productList.forEach(function (product) {
    currentProducts.set(String(product.id), product);
    const lowestPrice = Math.min.apply(null, product.merchants.map((m) => m.price));
    const wasDropping = product.history[0] > product.history[product.history.length - 1];

    const merchantRowsHtml = product.merchants.map(function (m) {
      const isBestDeal = m.price === lowestPrice;
      return `
        <div class="merchant-row ${isBestDeal ? "best-deal-row" : ""}">
          <span>${esc(m.name)} ${isBestDeal ? '<span class="best-badge">Best Deal</span>' : ""}</span>
          <span><strong>${formatINR(m.price)}</strong> (${esc(m.discount)}% Off)</span>
        </div>`;
    }).join("");

    const card = document.createElement("div");
    card.className = "deal-card";
    card.innerHTML = `
      <div>
        <span class="card-category">${esc(product.category)}</span>
        <h3 class="card-title">${esc(product.name)}</h3>
        ${wasDropping ? '<span class="trend-tag">📉 Historic Price Dropping</span>' : ""}
        <div class="merchant-list">${merchantRowsHtml}</div>
      </div>
      <button class="btn primary-btn">Compare EMI Plans</button>`;
    card.querySelector("button").addEventListener("click", () => handleCardClick(product.id));
    container.appendChild(card);
  });
}

// Debounced so we don't hit the API on every keystroke
function applyFilters() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadProducts, 250);
}

async function loadProducts() {
  const params = new URLSearchParams();
  const q = document.getElementById("searchBox").value.trim();
  const cat = document.getElementById("categorySelect").value;
  const merchant = document.getElementById("merchantSelect").value;
  const minDisc = document.getElementById("minDiscountInput").value;
  const maxPrice = document.getElementById("maxPriceInput").value;
  if (q) params.set("q", q);
  if (cat !== "All") params.set("category", cat);
  if (merchant !== "All") params.set("merchant", merchant);
  if (minDisc) params.set("minDiscount", minDisc);
  if (maxPrice) params.set("maxPrice", maxPrice);

  try {
    const data = await api("/api/products?" + params.toString());
    renderCards(data.products, "dealsGrid");
  } catch (e) {
    document.getElementById("dealsGrid").innerHTML =
      "<p style='color: var(--text-muted);'>Could not load deals: " + esc(e.message) + "</p>";
  }
}

async function handleCardClick(productId) {
  const product = currentProducts.get(String(productId));
  if (!product) return;
  openModal(product);
  try {
    await api("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: getUserId(), productId: product.id })
    });
    updateRecommendations();
  } catch (e) {
    console.warn("Activity tracking failed:", e.message);
  }
}

async function updateRecommendations() {
  try {
    const data = await api("/api/recommendations?userId=" + encodeURIComponent(getUserId()));
    if (data.products.length > 0) {
      document.getElementById("recommendedSection").classList.remove("hidden");
      renderCards(data.products, "recommendedGrid");
    }
  } catch (e) {
    console.warn("Recommendations failed:", e.message);
  }
}

function openModal(product) {
  activeProductForModal = product;
  document.getElementById("modalTitle").innerText = product.name;
  document.getElementById("downPaymentInput").value = 0;
  document.getElementById("emiModal").classList.remove("hidden");
  fetchEmiTable();
}

function closeModal() {
  document.getElementById("emiModal").classList.add("hidden");
  activeProductForModal = null;
}

function updateEmiTable() {
  clearTimeout(emiTimer);
  emiTimer = setTimeout(fetchEmiTable, 200);
}

async function fetchEmiTable() {
  if (!activeProductForModal) return;
  const productId = activeProductForModal.id;
  const down = parseFloat(document.getElementById("downPaymentInput").value) || 0;
  const tbody = document.getElementById("emiTableBody");

  try {
    const data = await api("/api/products/" + encodeURIComponent(productId) + "/emi?downPayment=" + encodeURIComponent(Math.max(0, down)));
    if (!activeProductForModal || activeProductForModal.id !== productId) return; // modal changed meanwhile
    tbody.innerHTML = data.rows.map((r) => `
      <tr>
        <td><strong>${esc(r.platform)}</strong></td>
        <td>${r.tenureMonths} Months</td>
        <td>${r.noCostEmi ? '<span class="best-badge">0% No-Cost EMI</span>' : esc(r.apr) + "%"}</td>
        <td><strong>${formatINR(r.monthlyInstallment)}</strong>/mo</td>
        <td>${formatINR(r.processingFee)}</td>
        <td><strong>${formatINR(r.totalOutlay)}</strong></td>
      </tr>`).join("");
  } catch (e) {
    tbody.innerHTML = "<tr><td colspan='6'>Could not load EMI plans: " + esc(e.message) + "</td></tr>";
  }
}

function toggleTheme() {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  document.body.setAttribute("data-theme", isDark ? "light" : "dark");
  document.getElementById("themeToggleBtn").innerText = isDark ? "🌙 Dark Mode" : "☀️ Light Mode";
}

// Initialize page
const splashScreen = document.getElementById("splashScreen");
const splashWordmark = splashScreen?.querySelector(".splash-wordmark");
if (splashWordmark) {
  Array.from("TrueOutlay").forEach((character, index) => {
    const letter = document.createElement("span");
    letter.className = "splash-letter" + (index >= 4 ? " splash-letter-accent" : "");
    letter.style.setProperty("--letter-index", index);
    letter.textContent = character;
    splashWordmark.appendChild(letter);
  });
}
window.setTimeout(() => splashScreen?.remove(), 1500);
loadProducts();
updateRecommendations();
