const { chromium } = require("playwright");

// ============================================
// Scrape ALL product data (Full Mode)
// ============================================
async function scrapeProducto(url) {
  if (!url) throw new Error("Se requiere la URL del producto");
  if (!url.includes("mercadolibre.com")) {
    throw new Error("La URL debe ser de MercadoLibre (mercadolibre.com)");
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    console.log(`[MercadoLibre] Navegando a: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page
      .waitForSelector(".ui-pdp-title", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(3000);

    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise((r) => setTimeout(r, 500));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(2000);

    const product = await page.evaluate(() => {
      const titleEl = document.querySelector(".ui-pdp-title");
      const title = titleEl ? titleEl.textContent.trim() : "";

      const priceContainer = document.querySelector(
        ".ui-pdp-price__second-line",
      );
      let currentPrice = "";
      if (priceContainer) {
        const frac = priceContainer.querySelector(
          ".andes-money-amount__fraction",
        );
        const cents = priceContainer.querySelector(
          ".andes-money-amount__cents",
        );
        const curr = priceContainer.querySelector(
          ".andes-money-amount__currency-symbol",
        );
        const c = curr ? curr.textContent.trim() : "$";
        const f = frac ? frac.textContent.trim() : "";
        const ce = cents ? cents.textContent.trim() : "";
        currentPrice = ce ? `${c}${f}.${ce}` : `${c}${f}`;
      }
      if (!currentPrice) {
        const fb = document.querySelector(".andes-money-amount__fraction");
        if (fb) currentPrice = `$${fb.textContent.trim()}`;
      }

      let originalPrice = "";
      const oc = document.querySelector(".ui-pdp-price__original-value");
      if (oc) {
        const of2 = oc.querySelector(".andes-money-amount__fraction");
        if (of2) originalPrice = `$${of2.textContent.trim()}`;
      }

      const de = document.querySelector(
        ".ui-pdp-price__second-line__label, .andes-money-amount__discount",
      );
      const discount = de ? de.textContent.trim() : "";

      const ce2 = document.querySelector(".ui-pdp-subtitle");
      const condition = ce2 ? ce2.textContent.trim() : "";

      const imgEls = document.querySelectorAll(".ui-pdp-gallery__figure img");
      const images = [];
      const seen = new Set();
      imgEls.forEach((img) => {
        const src =
          img.getAttribute("data-zoom") ||
          img.getAttribute("data-src") ||
          img.getAttribute("src") ||
          "";
        if (
          src &&
          !seen.has(src) &&
          src.startsWith("http") &&
          !src.includes("logos-api-admin") &&
          !src.endsWith(".svg") &&
          !src.includes("/logos/")
        ) {
          seen.add(src);
          images.push(src);
        }
      });

      const descEl = document.querySelector(".ui-pdp-description__content");
      const description = descEl ? descEl.textContent.trim() : "";

      const sellerEl = document.querySelector(
        ".ui-pdp-seller__header__title, .ui-pdp-seller__link-trigger",
      );
      const sellerName = sellerEl ? sellerEl.textContent.trim() : "";
      const sellerRepEl = document.querySelector(
        ".ui-pdp-seller__status-info, .ui-seller-info",
      );
      const sellerReputation = sellerRepEl
        ? sellerRepEl.textContent.trim()
        : "";

      const shipEls = document.querySelectorAll(".ui-pdp-media__title");
      const shipping = Array.from(shipEls)
        .map((el) => el.textContent.trim())
        .filter(Boolean);

      const ratingEl = document.querySelector(".ui-pdp-review__rating");
      const rating = ratingEl ? ratingEl.textContent.trim() : "";
      const reviewEl = document.querySelector(".ui-pdp-review__amount");
      const reviewCount = reviewEl ? reviewEl.textContent.trim() : "";

      const stockEl = document.querySelector(
        ".ui-pdp-buybox__quantity__available",
      );
      const stock = stockEl ? stockEl.textContent.trim() : "";

      const specs = [];
      document
        .querySelectorAll(".andes-table__row, .ui-pdp-specs__table tr")
        .forEach((row) => {
          const th = row.querySelector("th, td:first-child");
          const td = row.querySelector("td:last-child");
          if (th && td && th !== td) {
            const k = th.textContent.trim(),
              v = td.textContent.trim();
            if (k && v) specs.push({ key: k, value: v });
          }
        });

      const features = [];
      document
        .querySelectorAll(
          ".ui-pdp-highlighted-specs-attrs__attribute, .ui-pdp-features__item",
        )
        .forEach((el) => {
          const t = el.textContent.trim();
          if (t) features.push(t);
        });

      const warEl = document.querySelector(
        '.ui-pdp-warranty, [class*="warranty"]',
      );
      const warranty = warEl ? warEl.textContent.trim() : "";

      return {
        title,
        currentPrice,
        originalPrice,
        discount,
        condition,
        images,
        description,
        seller: { name: sellerName, reputation: sellerReputation },
        shipping,
        rating,
        reviewCount,
        stock,
        specs,
        features,
        warranty,
        url: window.location.href,
        scrapedAt: new Date().toISOString(),
      };
    });

    console.log(
      `[MercadoLibre] Producto extraído: ${product.title?.substring(0, 60)}...`,
    );
    return product;
  } finally {
    await browser.close();
  }
}

// ============================================
// Get preview HTML for the visual selector
// ============================================
async function getPreviewHTML(url) {
  const fs = require("fs");
  const path = require("path");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
    });
    const page = await context.newPage();

    console.log(`[Preview] Cargando: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page
      .waitForSelector(".ui-pdp-title", { timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(2000);

    // Scroll to load lazy images
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise((r) => setTimeout(r, 400));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1500);

    let html = await page.content();
    const origin = new URL(url).origin;

    // Strip scripts, noscript, CSP meta tags
    html = html.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      "",
    );
    html = html.replace(
      /<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi,
      "",
    );
    html = html.replace(
      /<meta[^>]*(?:Content-Security-Policy|X-Frame-Options|refresh)[^>]*>/gi,
      "",
    );

    // Add base tag for relative URLs (images, css)
    html = html.replace(
      /<head[^>]*>/i,
      (match) => match + `<base href="${origin}">`,
    );

    // Inject AGGRESSIVE selection styles
    const styles = `
<style id="ml-scraper-inject">
    * { cursor: crosshair !important; }
    body { overflow: auto !important; }
    a, a *, button, button * { pointer-events: auto !important; cursor: crosshair !important; }

    .ml-hover {
        outline: 4px dashed #ffe600 !important;
        outline-offset: 2px !important;
        background-color: rgba(255, 230, 0, 0.15) !important;
        box-shadow: inset 0 0 0 2000px rgba(255, 230, 0, 0.08) !important;
        position: relative !important;
        z-index: 99999 !important;
    }
    .ml-hover::after {
        content: '' !important;
        position: absolute !important;
        inset: 0 !important;
        background: rgba(255, 230, 0, 0.1) !important;
        pointer-events: none !important;
        z-index: 99999 !important;
    }

    .ml-selected {
        outline: 4px solid #818cf8 !important;
        outline-offset: 2px !important;
        background-color: rgba(129, 140, 248, 0.12) !important;
        box-shadow: inset 0 0 0 2000px rgba(129, 140, 248, 0.06), 0 0 20px rgba(129, 140, 248, 0.3) !important;
        position: relative !important;
        z-index: 99998 !important;
    }
</style>`;
    html = html.replace("</head>", styles + "</head>");

    // Read selector.js from disk and inject INLINE (not via src, because <base> breaks it)
    const selectorPath = path.join(__dirname, "..", "public", "selector.js");
    const selectorCode = fs.readFileSync(selectorPath, "utf-8");
    html = html.replace("</body>", `<script>${selectorCode}<\/script></body>`);

    console.log(`[Preview] HTML listo (${(html.length / 1024).toFixed(0)}KB)`);
    return html;
  } finally {
    await browser.close();
  }
}

// ============================================
// Scrape custom fields by CSS selectors
// ============================================
async function scrapeCustomFields(url, customFields) {
  if (!url || !customFields || customFields.length === 0) {
    throw new Error("Se requiere URL y al menos un campo seleccionado");
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    console.log(`[Custom] Navegando a: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise((r) => setTimeout(r, 500));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(2000);

    const results = await page.evaluate((fields) => {
      const data = {};
      fields.forEach((f) => {
        try {
          const el = document.querySelector(f.selector);
          if (!el) {
            data[f.name] = { value: "No encontrado", type: "error" };
            return;
          }

          const tag = el.tagName.toLowerCase();
          if (tag === "img") {
            data[f.name] = {
              value:
                el.src ||
                el.getAttribute("data-zoom") ||
                el.getAttribute("data-src") ||
                "",
              type: "image",
            };
          } else if (tag === "a") {
            data[f.name] = {
              value: el.textContent.trim(),
              href: el.href,
              type: "link",
            };
          } else {
            data[f.name] = { value: el.textContent.trim(), type: "text" };
          }
        } catch (err) {
          data[f.name] = { value: "Selector inválido", type: "error" };
        }
      });
      return data;
    }, customFields);

    console.log(`[Custom] ${Object.keys(results).length} campos extraídos`);
    return { url, data: results, scrapedAt: new Date().toISOString() };
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeProducto, getPreviewHTML, scrapeCustomFields };
