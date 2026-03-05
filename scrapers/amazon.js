const { chromium } = require("playwright");

async function scrapeAmazon(query) {
  if (!query) throw new Error("Se requiere un término de búsqueda");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "es-MX",
    });
    const page = await context.newPage();

    const searchUrl = `https://www.amazon.com.mx/s?k=${encodeURIComponent(query)}`;
    console.log(`[Amazon] Navegando a: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for product results
    await page
      .waitForSelector('[data-component-type="s-search-result"]', {
        timeout: 15000,
      })
      .catch(() => {
        console.log(
          "[Amazon] No se encontró el selector principal, intentando alternativo...",
        );
      });

    await page.waitForTimeout(2000);

    const products = await page.evaluate(() => {
      const items = document.querySelectorAll(
        '[data-component-type="s-search-result"]',
      );
      const results = [];

      items.forEach((item, index) => {
        if (index >= 20) return; // Limit to 20 results

        try {
          // Skip sponsored/ad results that don't have product info
          const titleEl = item.querySelector("h2 a span, h2 span");
          if (!titleEl) return;

          const title = titleEl.textContent.trim();
          if (!title) return;

          const linkEl = item.querySelector("h2 a");
          const priceWholeEl = item.querySelector(".a-price .a-price-whole");
          const priceFractionEl = item.querySelector(
            ".a-price .a-price-fraction",
          );
          const imgEl = item.querySelector(".s-image");
          const ratingEl = item.querySelector(".a-icon-alt");
          const reviewCountEl = item.querySelector(
            '.a-size-base.s-underline-text, [aria-label*="estrellas"] + span',
          );
          const primeEl = item.querySelector(
            '.a-icon-prime, [aria-label="Amazon Prime"]',
          );

          let price = "N/A";
          if (priceWholeEl) {
            const whole = priceWholeEl.textContent.trim().replace(".", "");
            const fraction = priceFractionEl
              ? priceFractionEl.textContent.trim()
              : "00";
            price = `$${whole}${fraction}`;
          }

          let link = "";
          if (linkEl) {
            link = linkEl.href;
            if (link.startsWith("/")) {
              link = `https://www.amazon.com.mx${link}`;
            }
          }

          results.push({
            title,
            price,
            link,
            image: imgEl ? imgEl.src : "",
            rating: ratingEl ? ratingEl.textContent.trim() : "",
            reviews: reviewCountEl ? reviewCountEl.textContent.trim() : "",
            prime: primeEl ? "✓ Prime" : "",
            source: "Amazon",
          });
        } catch (e) {
          // Skip problematic items
        }
      });

      return results;
    });

    console.log(`[Amazon] Se encontraron ${products.length} productos`);
    return products;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeAmazon };
