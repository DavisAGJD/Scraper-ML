const { chromium } = require("playwright");

async function scrapeGeneric({
  url,
  itemSelector,
  titleSelector,
  priceSelector,
  imageSelector,
  linkSelector,
}) {
  if (!url) throw new Error("Se requiere una URL");
  if (!itemSelector) throw new Error("Se requiere un selector de elementos");

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

    console.log(`[Generic] Navegando a: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for items to appear
    await page.waitForSelector(itemSelector, { timeout: 15000 }).catch(() => {
      console.log(
        "[Generic] Selector no encontrado, intentando con el contenido cargado...",
      );
    });

    await page.waitForTimeout(2000);

    const results = await page.evaluate(
      ({
        itemSelector,
        titleSelector,
        priceSelector,
        imageSelector,
        linkSelector,
        pageUrl,
      }) => {
        const items = document.querySelectorAll(itemSelector);
        const data = [];

        items.forEach((item, index) => {
          if (index >= 30) return; // Limit to 30 results

          try {
            // Title - required
            let title = "";
            if (titleSelector) {
              const titleEl = item.querySelector(titleSelector);
              title = titleEl ? titleEl.textContent.trim() : "";
            }
            if (!title) {
              // Fallback: get main text content
              title = item.textContent.trim().substring(0, 150);
            }
            if (!title) return;

            // Price - optional
            let price = "";
            if (priceSelector) {
              const priceEl = item.querySelector(priceSelector);
              price = priceEl ? priceEl.textContent.trim() : "";
            }

            // Image - optional
            let image = "";
            if (imageSelector) {
              const imgEl = item.querySelector(imageSelector);
              if (imgEl) {
                image =
                  imgEl.getAttribute("data-src") ||
                  imgEl.getAttribute("src") ||
                  imgEl.getAttribute("data-lazy-src") ||
                  "";
                // Handle relative URLs
                if (
                  image &&
                  !image.startsWith("http") &&
                  !image.startsWith("data:")
                ) {
                  try {
                    image = new URL(image, pageUrl).href;
                  } catch (e) {}
                }
              }
            }

            // Link - optional
            let link = "";
            if (linkSelector) {
              const linkEl = item.querySelector(linkSelector);
              if (linkEl) {
                link = linkEl.href || linkEl.getAttribute("href") || "";
                if (link && !link.startsWith("http")) {
                  try {
                    link = new URL(link, pageUrl).href;
                  } catch (e) {}
                }
              }
            }

            data.push({
              title,
              price: price || "N/A",
              link,
              image,
              source: "Genérico",
            });
          } catch (e) {
            // Skip problematic items
          }
        });

        return data;
      },
      {
        itemSelector,
        titleSelector,
        priceSelector,
        imageSelector,
        linkSelector,
        pageUrl: url,
      },
    );

    console.log(`[Generic] Se encontraron ${results.length} elementos`);
    return results;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeGeneric };
