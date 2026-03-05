// ============================================
// ML Scraper — Visual Element Selector
// Injected into the preview iframe
// ============================================
(function () {
  const IGNORE = new Set([
    "HTML",
    "BODY",
    "HEAD",
    "SCRIPT",
    "STYLE",
    "META",
    "LINK",
    "BR",
    "HR",
    "NOSCRIPT",
  ]);
  let hoveredEl = null;
  const selectedEls = new Map(); // element -> selector

  // ── Prevent ALL navigation ──
  document.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  document.addEventListener(
    "dblclick",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  document.addEventListener(
    "submit",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  document.querySelectorAll("a").forEach((a) => a.removeAttribute("href"));

  // ── Hover highlight ──
  document.addEventListener(
    "mouseover",
    function (e) {
      const el = e.target;
      if (!el || IGNORE.has(el.tagName) || selectedEls.has(el)) return;
      if (hoveredEl && hoveredEl !== el) hoveredEl.classList.remove("ml-hover");
      hoveredEl = el;
      el.classList.add("ml-hover");
    },
    true,
  );

  document.addEventListener(
    "mouseout",
    function (e) {
      if (e.target && e.target.classList) e.target.classList.remove("ml-hover");
    },
    true,
  );

  // ── Click to select / deselect ──
  document.addEventListener(
    "click",
    function (e) {
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      if (!el || IGNORE.has(el.tagName)) return;

      // Deselect
      if (selectedEls.has(el)) {
        const sel = selectedEls.get(el);
        selectedEls.delete(el);
        el.classList.remove("ml-selected");
        window.parent.postMessage({ type: "deselect", selector: sel }, "*");
        return;
      }

      // Select
      el.classList.remove("ml-hover");
      el.classList.add("ml-selected");
      const selector = makeSelector(el);
      selectedEls.set(el, selector);

      const tag = el.tagName.toLowerCase();
      const isImg = tag === "img";
      const text = isImg
        ? el.alt || el.title || "Imagen"
        : el.innerText.trim().substring(0, 250);
      const imgSrc = isImg
        ? el.src ||
          el.getAttribute("data-zoom") ||
          el.getAttribute("data-src") ||
          ""
        : "";

      window.parent.postMessage(
        {
          type: "select",
          selector,
          text,
          tag,
          isImg,
          imgSrc,
        },
        "*",
      );
    },
    true,
  );

  // ── CSS Selector Generator ──
  function makeSelector(el) {
    // Try ID first
    if (el.id && /^[a-zA-Z]/.test(el.id)) {
      const esc = CSS.escape(el.id);
      if (document.querySelectorAll("#" + esc).length === 1) return "#" + esc;
    }

    const parts = [];
    let cur = el;

    while (cur && cur !== document.body && cur !== document.documentElement) {
      let seg = cur.tagName.toLowerCase();

      // ID shortcut
      if (cur.id && /^[a-zA-Z]/.test(cur.id)) {
        const esc = CSS.escape(cur.id);
        if (document.querySelectorAll("#" + esc).length === 1) {
          parts.unshift("#" + esc);
          break;
        }
      }

      // Classes (skip internal/generated ones)
      if (cur.className && typeof cur.className === "string") {
        const cls = cur.className
          .trim()
          .split(/\s+/)
          .filter(
            (c) =>
              c && c.length < 50 && !c.startsWith("ml-") && !c.startsWith("_"),
          );
        if (cls.length > 0)
          seg +=
            "." +
            cls
              .slice(0, 2)
              .map((c) => CSS.escape(c))
              .join(".");
      }

      // nth-of-type for disambiguation
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === cur.tagName,
        );
        if (siblings.length > 1) {
          seg += ":nth-of-type(" + (siblings.indexOf(cur) + 1) + ")";
        }
      }

      parts.unshift(seg);
      cur = cur.parentElement;
      if (parts.length >= 6) break; // limit depth
    }

    return parts.join(" > ");
  }

  // ── External deselect via parent ──
  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "remove-selection") {
      for (const [el, sel] of selectedEls) {
        if (sel === e.data.selector) {
          el.classList.remove("ml-selected");
          selectedEls.delete(el);
          break;
        }
      }
    }
  });

  // ── Notify parent we're ready ──
  window.parent.postMessage({ type: "preview-ready" }, "*");
})();
