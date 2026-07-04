// Tiny DOM helpers. Framework-free, safe by default (text nodes escape).

/**
 * Escape a value for safe interpolation into an HTML string context.
 * @param {unknown} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ||
      c,
  );
}

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set(["svg", "path", "circle", "g", "line", "polyline", "rect"]);

/**
 * Hyperscript-style element factory.
 *
 *   el("button", { class: "ssl-btn", onClick: fn, "aria-label": "Close" }, "×")
 *
 * - `class` / `className` set the class attribute.
 * - `style` accepts a string or an object of camelCase/kebab props.
 * - `dataset` accepts an object of data-* values.
 * - `onFoo` (function) attaches an event listener for "foo".
 * - `html` sets innerHTML (use only with pre-escaped/trusted content).
 * - Other attrs are set via setAttribute; `false`/`null`/`undefined` skip.
 * Children may be nodes, strings (text-escaped), arrays, or nullish (skipped).
 *
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {...any} children
 * @returns {HTMLElement | SVGElement}
 */
export function el(tag, attrs, ...children) {
  const node = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  if (attrs && typeof attrs === "object") {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;

      if (key === "class" || key === "className") {
        node.setAttribute("class", String(value));
      } else if (key === "style" && typeof value === "object") {
        for (const [prop, v] of Object.entries(value)) {
          node.style.setProperty(camelToKebab(prop), String(v));
        }
      } else if (key === "style") {
        node.setAttribute("style", String(value));
      } else if (key === "dataset" && typeof value === "object") {
        for (const [dk, dv] of Object.entries(value)) {
          if (dv != null) node.dataset[dk] = String(dv);
        }
      } else if (key === "html") {
        node.innerHTML = String(value);
      } else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) {
        node.setAttribute(key, "");
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }

  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(node, child);
    } else if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }
}

function camelToKebab(str) {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Remove all children from a node. Returns the node.
 * @template {Node} T
 * @param {T} node
 * @returns {T}
 */
export function clear(node) {
  if (node) while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}
