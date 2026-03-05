const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const {
  scrapeProducto,
  getPreviewHTML,
  scrapeCustomFields,
} = require("./scrapers/mercadolibre");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Data directory & history
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let history = [];
const historyFile = path.join(dataDir, "history.json");
if (fs.existsSync(historyFile)) {
  try {
    history = JSON.parse(fs.readFileSync(historyFile, "utf-8"));
  } catch (e) {
    history = [];
  }
}
function saveHistory() {
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
}

// ======================
// API Routes
// ======================

// ── Full-mode scrape ──
app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url)
    return res.status(400).json({ error: "Se requiere la URL del producto" });
  if (!url.includes("mercadolibre.com"))
    return res.status(400).json({ error: "La URL debe ser de MercadoLibre" });

  try {
    const t = Date.now();
    const product = await scrapeProducto(url);
    const dur = ((Date.now() - t) / 1000).toFixed(2);

    const record = {
      id: Date.now().toString(),
      url,
      mode: "full",
      title: product.title,
      price: product.currentPrice,
      image: product.images?.[0] || "",
      duration: `${dur}s`,
      timestamp: new Date().toISOString(),
      product,
    };
    history.unshift(record);
    if (history.length > 30) history = history.slice(0, 30);
    saveHistory();
    res.json(record);
  } catch (err) {
    console.error("Error scraping:", err);
    res
      .status(500)
      .json({ error: "Error al realizar el scraping", details: err.message });
  }
});

// ── Preview (for visual selector) ──
app.get("/api/preview", async (req, res) => {
  const url = req.query.url;
  if (!url || !url.includes("mercadolibre.com")) {
    return res.status(400).send("URL inválida");
  }

  try {
    const html = await getPreviewHTML(url);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("Error preview:", err);
    res
      .status(500)
      .send(
        "<h2>Error al cargar la vista previa</h2><p>" + err.message + "</p>",
      );
  }
});

// ── Custom-mode scrape ──
app.post("/api/scrape-custom", async (req, res) => {
  const { url, fields } = req.body;
  // fields = [{name: "precio", selector: ".andes-money-amount__fraction"}, ...]
  if (!url) return res.status(400).json({ error: "Se requiere la URL" });
  if (!fields || fields.length === 0)
    return res.status(400).json({ error: "Se requiere al menos un campo" });

  try {
    const t = Date.now();
    const result = await scrapeCustomFields(url, fields);
    const dur = ((Date.now() - t) / 1000).toFixed(2);

    // Find first text value for title, and first image for thumbnail
    let title = "",
      image = "";
    for (const key of Object.keys(result.data)) {
      const d = result.data[key];
      if (!title && d.type === "text" && d.value)
        title = d.value.substring(0, 100);
      if (!image && d.type === "image" && d.value) image = d.value;
    }

    const record = {
      id: Date.now().toString(),
      url,
      mode: "custom",
      title: title || "Personalizado",
      price: "",
      image,
      duration: `${dur}s`,
      timestamp: new Date().toISOString(),
      customFields: fields,
      customData: result.data,
    };
    history.unshift(record);
    if (history.length > 30) history = history.slice(0, 30);
    saveHistory();
    res.json(record);
  } catch (err) {
    console.error("Error custom scraping:", err);
    res
      .status(500)
      .json({ error: "Error al extraer datos", details: err.message });
  }
});

// ── History ──
app.get("/api/history", (req, res) => {
  const summary = history.map(
    ({ id, url, title, price, image, duration, timestamp, mode }) => ({
      id,
      url,
      title,
      price,
      image,
      duration,
      timestamp,
      mode,
    }),
  );
  res.json(summary);
});

app.get("/api/history/:id", (req, res) => {
  const r = history.find((r) => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: "No encontrado" });
  res.json(r);
});

app.delete("/api/history/:id", (req, res) => {
  const i = history.findIndex((r) => r.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "No encontrado" });
  history.splice(i, 1);
  saveHistory();
  res.json({ message: "Eliminado" });
});

app.get("/api/export/:id", (req, res) => {
  const r = history.find((r) => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: "No encontrado" });
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=producto-${r.id}.json`,
  );
  res.setHeader("Content-Type", "application/json");
  res.json(r.product || r.customData || {});
});

app.listen(PORT, () => {
  console.log(
    `\n🛒 MercadoLibre Scraper corriendo en http://localhost:${PORT}`,
  );
  console.log(`📊 Dashboard: http://localhost:${PORT}\n`);
});
