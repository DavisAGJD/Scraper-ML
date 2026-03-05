// ============================================
// ML Scraper — Frontend Application
// ============================================

let currentMode = "full";
let currentRecord = null;
let selectedFields = []; // {selector, text, tag, name}

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initModeToggle();
  initForm();
  initVisualSelector();
  loadHistory();
});

// ═══════════════════════════════════
// Tabs
// ═══════════════════════════════════
function initTabs() {
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.getAttribute("data-tab");
      document
        .querySelectorAll(".nav-tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${id}`)?.classList.add("active");
    });
  });
}

// ═══════════════════════════════════
// Mode Toggle
// ═══════════════════════════════════
function initModeToggle() {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentMode = btn.getAttribute("data-mode");
      document
        .querySelectorAll(".mode-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const text = document.getElementById("btn-scrape-text");
      if (currentMode === "custom") {
        text.textContent = "Cargar Vista Previa";
      } else {
        text.textContent = "Scrapear";
      }
    });
  });
}

// ═══════════════════════════════════
// Form Submit
// ═══════════════════════════════════
function initForm() {
  document
    .getElementById("scraper-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const url = document.getElementById("product-url").value.trim();
      if (!url) return;
      if (!url.includes("mercadolibre.com")) {
        showToast("error", "URL inválida", "La URL debe ser de MercadoLibre");
        return;
      }

      if (currentMode === "full") {
        await scrapeFullMode(url);
      } else {
        await loadPreview(url);
      }
    });

  document.getElementById("btn-export")?.addEventListener("click", () => {
    if (currentRecord) window.open(`/api/export/${currentRecord.id}`, "_blank");
  });
  document
    .getElementById("btn-export-custom")
    ?.addEventListener("click", () => {
      if (currentRecord)
        window.open(`/api/export/${currentRecord.id}`, "_blank");
    });
}

// ═══════════════════════════════════
// Full Mode Scraping
// ═══════════════════════════════════
async function scrapeFullMode(url) {
  showLoading(true, "Extrayendo datos del producto...");
  setStatus("Scrapeando...", "loading");

  const msgs = [
    "Iniciando navegador",
    "Cargando página",
    "Esperando contenido",
    "Extrayendo datos",
    "Procesando",
  ];
  let mi = 0;
  const iv = setInterval(() => {
    mi = (mi + 1) % msgs.length;
    document.getElementById("loading-detail").textContent = msgs[mi];
  }, 2500);

  try {
    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    clearInterval(iv);
    if (!res.ok) throw new Error((await res.json()).details || "Error");

    const data = await res.json();
    currentRecord = data;
    showLoading(false);
    setStatus("Listo", "ready");
    showToast(
      "success",
      "¡Producto extraído!",
      `Datos obtenidos en ${data.duration}`,
    );
    renderFullProduct(data.product);
    loadHistory();
  } catch (err) {
    clearInterval(iv);
    showLoading(false);
    setStatus("Error", "error");
    showToast("error", "Error", err.message);
  }
}

// ═══════════════════════════════════
// Visual Selector
// ═══════════════════════════════════
function initVisualSelector() {
  // Close preview
  document
    .getElementById("btn-close-preview")
    ?.addEventListener("click", closePreview);

  // Extract custom data
  document
    .getElementById("btn-extract-custom")
    ?.addEventListener("click", extractCustomData);

  // Listen for messages from the iframe
  window.addEventListener("message", (e) => {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case "preview-ready":
        showLoading(false);
        setStatus("Vista previa lista", "ready");
        showToast(
          "success",
          "Vista previa cargada",
          "Haz clic en los elementos que quieras extraer",
        );
        break;

      case "select":
        addSelectedField(e.data);
        break;

      case "deselect":
        removeSelectedField(e.data.selector);
        break;
    }
  });
}

async function loadPreview(url) {
  showLoading(true, "Cargando vista previa...");
  setStatus("Cargando preview...", "loading");

  const msgs = [
    "Iniciando navegador",
    "Navegando a MercadoLibre",
    "Renderizando página",
    "Preparando vista previa",
  ];
  let mi = 0;
  const iv = setInterval(() => {
    mi = (mi + 1) % msgs.length;
    document.getElementById("loading-detail").textContent = msgs[mi];
  }, 2500);

  try {
    const iframe = document.getElementById("preview-iframe");
    iframe.src = `/api/preview?url=${encodeURIComponent(url)}`;

    // Wait for iframe load OR timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout al cargar la vista previa")),
        60000,
      );
      iframe.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      iframe.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Error cargando iframe"));
      };
    });

    clearInterval(iv);
    selectedFields = [];
    updateFieldsPanel();

    // Show workspace, hide hero
    document.getElementById("hero-section").style.display = "none";
    document.getElementById("product-result").style.display = "none";
    document.getElementById("custom-result").style.display = "none";
    document.getElementById("visual-workspace").style.display = "block";

    showLoading(false);
    setStatus("Selector visual activo", "ready");
  } catch (err) {
    clearInterval(iv);
    showLoading(false);
    setStatus("Error", "error");
    showToast("error", "Error", err.message);
  }
}

function addSelectedField(data) {
  // Check for duplicate selector
  if (selectedFields.some((f) => f.selector === data.selector)) return;

  const id = "field_" + Date.now();
  selectedFields.push({
    id,
    selector: data.selector,
    text: data.text,
    tag: data.tag,
    isImg: data.isImg,
    imgSrc: data.imgSrc || "",
    name: "", // user fills this in
  });

  updateFieldsPanel();
  updateExtractButton();
}

function removeSelectedField(selector) {
  selectedFields = selectedFields.filter((f) => f.selector !== selector);
  updateFieldsPanel();
  updateExtractButton();
}

function updateFieldsPanel() {
  const list = document.getElementById("vs-fields-list");
  const counter = document.getElementById("vs-panel-count");

  if (selectedFields.length === 0) {
    list.innerHTML = `
            <div class="vs-empty">
                <div class="vs-empty-icon">👆</div>
                <p>Haz clic en un elemento de la página para agregarlo aquí</p>
            </div>`;
    counter.textContent = "0 campos";
    return;
  }

  counter.textContent = `${selectedFields.length} campo${selectedFields.length !== 1 ? "s" : ""}`;

  list.innerHTML = selectedFields
    .map((f, i) => {
      const preview = f.isImg
        ? `<div class="vsf-preview-img"><img src="${esc(f.imgSrc)}" alt="" /></div>`
        : `<div class="vsf-preview-text">${esc(f.text.substring(0, 80))}${f.text.length > 80 ? "..." : ""}</div>`;

      return `
            <div class="vs-field-card" style="animation-delay:${i * 0.05}s">
                <div class="vsf-header">
                    <span class="vsf-tag">&lt;${f.tag}&gt;</span>
                    <button class="vsf-remove" onclick="removeFieldById('${f.id}')" title="Quitar">✕</button>
                </div>

                <input
                    type="text"
                    class="vsf-name-input"
                    placeholder="Nombre del campo (ej: Precio, Título...)"
                    value="${esc(f.name)}"
                    data-field-id="${f.id}"
                    oninput="updateFieldName('${f.id}', this.value)"
                />

                ${preview}
                <div class="vsf-selector">${esc(f.selector)}</div>
            </div>
        `;
    })
    .join("");
}

function updateFieldName(id, name) {
  const field = selectedFields.find((f) => f.id === id);
  if (field) field.name = name.trim();
  updateExtractButton();
}

function removeFieldById(id) {
  const field = selectedFields.find((f) => f.id === id);
  if (!field) return;

  // Tell iframe to remove visual highlight
  const iframe = document.getElementById("preview-iframe");
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(
      { type: "remove-selection", selector: field.selector },
      "*",
    );
  }

  selectedFields = selectedFields.filter((f) => f.id !== id);
  updateFieldsPanel();
  updateExtractButton();
}

function updateExtractButton() {
  const btn = document.getElementById("btn-extract-custom");
  const count = document.getElementById("vs-count");
  const namedCount = selectedFields.filter((f) => f.name).length;

  count.textContent = namedCount;
  btn.disabled = namedCount === 0;
}

async function extractCustomData() {
  const namedFields = selectedFields.filter((f) => f.name);
  if (namedFields.length === 0) {
    showToast(
      "error",
      "Sin campos",
      "Pon nombre a al menos un campo seleccionado",
    );
    return;
  }

  const url = document.getElementById("product-url").value.trim();
  if (!url) return;

  closePreview();
  showLoading(true, "Extrayendo datos personalizados...");
  setStatus("Extrayendo...", "loading");

  const msgs = [
    "Navegando a la página",
    "Buscando selectores",
    "Extrayendo datos",
  ];
  let mi = 0;
  const iv = setInterval(() => {
    mi = (mi + 1) % msgs.length;
    document.getElementById("loading-detail").textContent = msgs[mi];
  }, 2000);

  try {
    const res = await fetch("/api/scrape-custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        fields: namedFields.map((f) => ({
          name: f.name,
          selector: f.selector,
        })),
      }),
    });
    clearInterval(iv);
    if (!res.ok) throw new Error((await res.json()).details || "Error");

    const data = await res.json();
    currentRecord = data;
    showLoading(false);
    setStatus("Listo", "ready");
    showToast(
      "success",
      "¡Datos extraídos!",
      `${namedFields.length} campos en ${data.duration}`,
    );
    renderCustomResult(data.customData);
    loadHistory();
  } catch (err) {
    clearInterval(iv);
    showLoading(false);
    setStatus("Error", "error");
    showToast("error", "Error", err.message);
  }
}

function closePreview() {
  document.getElementById("visual-workspace").style.display = "none";
  document.getElementById("hero-section").style.display = "";
  document.getElementById("preview-iframe").src = "about:blank";
  selectedFields = [];
}

// ═══════════════════════════════════
// Render Full Product (same as before)
// ═══════════════════════════════════
function renderFullProduct(p) {
  const container = document.getElementById("product-result");
  document.getElementById("custom-result").style.display = "none";
  container.style.display = "block";
  container.scrollIntoView({ behavior: "smooth", block: "start" });

  document.getElementById("result-mode-badge").className =
    "result-mode-badge full";
  document.getElementById("result-mode-badge").textContent = "🔥 Modo Completo";
  document.getElementById("btn-visit").href = p.url || "#";
  document.getElementById("p-title").textContent = p.title || "Sin título";
  document.getElementById("p-condition").textContent = p.condition || "";

  const rc = document.getElementById("p-rating-container");
  if (p.rating) {
    rc.style.display = "flex";
    document.getElementById("p-rating").textContent = `⭐ ${p.rating}`;
    document.getElementById("p-review-count").textContent = p.reviewCount || "";
  } else {
    rc.style.display = "none";
  }

  const gallery = document.getElementById("p-gallery");
  const mainImg = document.getElementById("p-main-image");
  const thumbs = document.getElementById("p-thumbs");
  if (p.images && p.images.length > 0) {
    gallery.style.display = "";
    mainImg.src = p.images[0];
    mainImg.alt = p.title || "";
    thumbs.innerHTML = p.images
      .map(
        (s, i) =>
          `<div class="gallery-thumb ${i === 0 ? "active" : ""}" onclick="changeImage('${esc(s)}', this)"><img src="${esc(s)}" alt="" loading="lazy" /></div>`,
      )
      .join("");
  } else {
    gallery.style.display = "none";
  }

  document.getElementById("p-price").textContent = p.currentPrice || "N/A";
  const op = document.getElementById("p-original-price");
  if (p.originalPrice) {
    op.textContent = p.originalPrice;
    op.style.display = "block";
  } else {
    op.style.display = "none";
  }
  const db = document.getElementById("p-discount");
  if (p.discount) {
    db.textContent = p.discount;
    db.style.display = "inline-flex";
  } else {
    db.style.display = "none";
  }

  const sc = document.getElementById("shipping-card");
  if (p.shipping?.length > 0) {
    sc.style.display = "block";
    document.getElementById("p-shipping").innerHTML = p.shipping
      .map((s) => `<div class="shipping-item">${esc(s)}</div>`)
      .join("");
  } else {
    sc.style.display = "none";
  }

  const selC = document.getElementById("seller-card");
  if (p.seller?.name) {
    selC.style.display = "block";
    document.getElementById("p-seller-name").textContent = p.seller.name;
    document.getElementById("p-seller-rep").textContent =
      p.seller.reputation || "";
  } else {
    selC.style.display = "none";
  }

  const stC = document.getElementById("stock-card");
  if (p.stock || p.warranty) {
    stC.style.display = "block";
    document.getElementById("p-stock").textContent = p.stock || "";
    document.getElementById("p-warranty").textContent = p.warranty || "";
  } else {
    stC.style.display = "none";
  }

  const spSec = document.getElementById("specs-section");
  if (p.specs?.length > 0) {
    spSec.style.display = "block";
    document.getElementById("p-specs").innerHTML = p.specs
      .map(
        (s) =>
          `<div class="spec-item"><span class="spec-key">${esc(s.key)}</span><span class="spec-value">${esc(s.value)}</span></div>`,
      )
      .join("");
  } else {
    spSec.style.display = "none";
  }

  const dSec = document.getElementById("desc-section");
  if (p.description) {
    dSec.style.display = "block";
    document.getElementById("p-description").textContent = p.description;
  } else {
    dSec.style.display = "none";
  }
}

// ═══════════════════════════════════
// Render Custom Result
// ═══════════════════════════════════
function renderCustomResult(data) {
  document.getElementById("product-result").style.display = "none";
  const container = document.getElementById("custom-result");
  container.style.display = "block";
  container.scrollIntoView({ behavior: "smooth", block: "start" });

  const grid = document.getElementById("custom-data-grid");
  grid.innerHTML = Object.entries(data)
    .map(([name, info], i) => {
      let valueHtml = "";
      if (info.type === "image") {
        valueHtml = `<div class="cd-image"><img src="${esc(info.value)}" alt="${esc(name)}" /></div>`;
      } else if (info.type === "link") {
        valueHtml = `<div class="cd-text">${esc(info.value)}</div><a class="cd-link" href="${esc(info.href)}" target="_blank" rel="noopener">Abrir enlace →</a>`;
      } else if (info.type === "error") {
        valueHtml = `<div class="cd-error">${esc(info.value)}</div>`;
      } else {
        valueHtml = `<div class="cd-text">${esc(info.value)}</div>`;
      }

      return `
            <div class="custom-data-card" style="animation-delay:${i * 0.06}s">
                <div class="cd-name">${esc(name)}</div>
                ${valueHtml}
            </div>
        `;
    })
    .join("");
}

// ═══════════════════════════════════
// Gallery
// ═══════════════════════════════════
function changeImage(src, thumbEl) {
  document.getElementById("p-main-image").src = src;
  document
    .querySelectorAll(".gallery-thumb")
    .forEach((t) => t.classList.remove("active"));
  if (thumbEl) thumbEl.classList.add("active");
}

// ═══════════════════════════════════
// History
// ═══════════════════════════════════
async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    renderHistory(await res.json());
  } catch (e) {
    console.error("History error:", e);
  }
}

function renderHistory(items) {
  const c = document.getElementById("history-list");
  if (!items?.length) {
    c.innerHTML = `<div class="history-empty"><div class="history-empty-icon">📦</div><h3>Sin historial</h3><p>Aquí aparecerán los productos que scrapees</p></div>`;
    return;
  }
  c.innerHTML = items
    .map((item, i) => {
      const d = new Date(item.timestamp).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const badge =
        item.mode === "custom"
          ? `<span class="history-mode-tag custom">🎯 Visual</span>`
          : `<span class="history-mode-tag full">🔥 Completo</span>`;
      return `
        <div class="history-item" style="animation-delay:${i * 0.04}s" onclick="viewHistoryItem('${item.id}')">
            <div class="history-thumb">${item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='🛒'" />` : "🛒"}</div>
            <div class="history-info">
                <div class="history-title">${esc(item.title || "Producto")}</div>
                <div class="history-meta"><span class="history-price">${esc(item.price || "")}</span><span>${d}</span><span>${item.duration}</span>${badge}</div>
            </div>
            <div class="history-actions">
                <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); viewHistoryItem('${item.id}')">Ver</button>
                <button class="btn btn-outline btn-sm btn-danger" onclick="event.stopPropagation(); deleteItem('${item.id}')">✕</button>
            </div>
        </div>`;
    })
    .join("");
}

async function viewHistoryItem(id) {
  try {
    const res = await fetch(`/api/history/${id}`);
    const data = await res.json();
    currentRecord = data;

    // Switch to scraper tab
    document
      .querySelectorAll(".nav-tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((t) => t.classList.remove("active"));
    document.querySelector('[data-tab="scraper"]').classList.add("active");
    document.getElementById("tab-scraper").classList.add("active");

    if (data.mode === "custom" && data.customData) {
      renderCustomResult(data.customData);
    } else if (data.product) {
      renderFullProduct(data.product);
    }
  } catch (err) {
    showToast("error", "Error", "No se pudo cargar");
  }
}

async function deleteItem(id) {
  try {
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    showToast("success", "Eliminado", "Borrado del historial");
    loadHistory();
  } catch (e) {
    showToast("error", "Error", "No se pudo eliminar");
  }
}

// ═══════════════════════════════════
// Helpers
// ═══════════════════════════════════
function showLoading(show, title) {
  document.getElementById("loading-section").style.display = show
    ? "flex"
    : "none";
  if (title) document.getElementById("loading-title").textContent = title;
  if (!show) return;
  document.getElementById("product-result").style.display = "none";
  document.getElementById("custom-result").style.display = "none";
  document.getElementById("btn-scrape").disabled = true;
}

function setStatus(text, type) {
  document.getElementById("status-text").textContent = text;
  const chip = document.getElementById("status-chip");
  const c = {
    ready: ["rgba(16,185,129,0.1)", "rgba(16,185,129,0.2)", "#10b981"],
    loading: ["rgba(255,230,0,0.1)", "rgba(255,230,0,0.2)", "#ffe600"],
    error: ["rgba(244,63,94,0.1)", "rgba(244,63,94,0.2)", "#f43f5e"],
  }[type] || ["rgba(16,185,129,0.1)", "rgba(16,185,129,0.2)", "#10b981"];
  chip.style.background = c[0];
  chip.style.borderColor = c[1];
  chip.style.color = c[2];
  document.getElementById("btn-scrape").disabled = type === "loading";
}

function showToast(type, title, msg) {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-icon">${type === "success" ? "✅" : "❌"}</div><div><div class="toast-title">${esc(title)}</div><div class="toast-message">${esc(msg)}</div></div>`;
  document.getElementById("toast-container").appendChild(t);
  setTimeout(() => {
    t.classList.add("removing");
    setTimeout(() => t.remove(), 300);
  }, 4500);
}

function esc(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}
