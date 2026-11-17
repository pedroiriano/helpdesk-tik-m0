import { iconHref } from './environment.js';
const SVG_NS="http://www.w3.org/2000/svg";
export function createSpriteIcon(symbolId, size = 18) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", iconHref(symbolId));
  svg.appendChild(use);
  return svg;
}

