import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const QUOTES_PATH = path.join(ROOT, "quotes.json");
const OUT_DIR = path.join(ROOT, "assets");
const OUT_PATH = path.join(OUT_DIR, "quote-of-the-day.svg");

function escapeXml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function getJakartaDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date); // YYYY-MM-DD
}

function stableIndex(key, length) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return length === 0 ? 0 : hash % length;
}

const quotes = JSON.parse(fs.readFileSync(QUOTES_PATH, "utf8"));
if (!Array.isArray(quotes) || quotes.length === 0) {
  throw new Error("quotes.json must be a non-empty array");
}

const dateKey = getJakartaDateKey();
const picked = quotes[stableIndex(dateKey, quotes.length)];
const quote = String(picked.quote ?? "").trim();
const author = String(picked.author ?? "").trim();
if (!quote || !author) throw new Error("Each quote must have quote and author fields");

const maxCharsPerLine = 62;
const quoteLines = wrapText(quote, maxCharsPerLine).slice(0, 4);
const ellipsis = wrapText(quote, maxCharsPerLine).length > quoteLines.length ? "…" : "";
if (ellipsis) quoteLines[quoteLines.length - 1] = `${quoteLines[quoteLines.length - 1]}${ellipsis}`;

const title = "◇ Quote of the Day";

const svgWidth = 1200;
const svgHeight = 240;
const paddingX = 70;
const cardX = 40;
const cardY = 70;
const cardW = svgWidth - 80;
const cardH = 150;

const titleX = 60;
const titleY = 48;

const quoteStartX = cardX + paddingX;
const quoteStartY = cardY + 56;
const lineHeight = 30;

const authorX = cardX + cardW - paddingX;
const authorY = cardY + cardH - 30;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0f16"/>
      <stop offset="100%" stop-color="#05070b"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#141a25"/>
      <stop offset="100%" stop-color="#0f1420"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="url(#bg)"/>

  <text x="${titleX}" y="${titleY}" font-family="VT323, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="44" fill="#ff4d4d">
    ${escapeXml(title)}
  </text>

  <g filter="url(#shadow)">
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="18" fill="url(#card)" stroke="#1f2937" stroke-width="2"/>
  </g>

  <text x="${quoteStartX}" y="${quoteStartY}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="30" fill="#22d3ee">
    <tspan fill="#a855f7">“</tspan>
    ${quoteLines.map((l, idx) => {
      const y = quoteStartY + idx * lineHeight;
      const prefix = idx === 0 ? "" : `  <tspan x="${quoteStartX}" y="${y}">`;
      const suffix = idx === 0 ? "" : "</tspan>";
      return `${prefix}${escapeXml(l)}${suffix}`;
    }).join("\n")}
    <tspan fill="#a855f7">”</tspan>
  </text>

  <text x="${authorX}" y="${authorY}" text-anchor="end" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="28" fill="#60a5fa">
    ${escapeXml(`- ${author}`)}
  </text>
</svg>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, svg, "utf8");
console.log(`Generated ${path.relative(ROOT, OUT_PATH)} for ${dateKey}`);
