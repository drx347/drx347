import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.GITHUB_USERNAME || "drx347";
const token = process.env.GITHUB_TOKEN || "";
const output = process.env.OUTPUT_FILE || "assets/github-language-stats.svg";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "ridmi-language-stats",
  "X-GitHub-Api-Version": "2022-11-28",
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

const colors = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#663399",
  Python: "#3572A5",
  Java: "#b07219",
  PHP: "#4F5D95",
  Go: "#00ADD8",
  Rust: "#dea584",
  Vue: "#41b883",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Shell: "#89e051",
  Dockerfile: "#384d54",
  SCSS: "#c6538c",
  Svelte: "#ff3e00",
  Astro: "#ff5d01",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Ruby: "#701516",
};

const fallbackColors = [
  "#02731B",
  "#2ea043",
  "#56d364",
  "#238636",
  "#1f6feb",
  "#8957e5",
  "#db6d28",
  "#cf222e",
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units.shift();

  while (value >= 1024 && units.length) {
    value /= 1024;
    unit = units.shift();
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }

  return response.json();
}

async function getRepositories() {
  const repos = [];

  for (let page = 1; page <= 10; page += 1) {
    const batch = await github(
      `/users/${username}/repos?per_page=100&page=${page}&type=owner&sort=updated`
    );

    if (!batch.length) break;

    repos.push(
      ...batch.filter((repo) => !repo.fork && !repo.archived && repo.size > 0)
    );
  }

  return repos;
}

async function getLanguageTotals(repositories) {
  const totals = new Map();

  await Promise.all(
    repositories.map(async (repo) => {
      const languages = await github(`/repos/${username}/${repo.name}/languages`);

      for (const [language, bytes] of Object.entries(languages)) {
        totals.set(language, (totals.get(language) || 0) + bytes);
      }
    })
  );

  return [...totals.entries()]
    .map(([language, bytes]) => ({ language, bytes }))
    .sort((a, b) => b.bytes - a.bytes);
}

function renderSvg(languageTotals) {
  const topLanguages = languageTotals.slice(0, 8);
  const totalBytes = languageTotals.reduce((sum, item) => sum + item.bytes, 0);
  const width = 460;
  const headerHeight = 64;
  const rowHeight = 28;
  const bottomPadding = 24;
  const height = headerHeight + topLanguages.length * rowHeight + bottomPadding;

  const rows = topLanguages
    .map((item, index) => {
      const percent = totalBytes ? (item.bytes / totalBytes) * 100 : 0;
      const y = headerHeight + index * rowHeight;
      const color = colors[item.language] || fallbackColors[index % fallbackColors.length];
      const barWidth = Math.max(4, Math.round((percent / 100) * 170));

      return `
        <g transform="translate(24 ${y})">
          <circle cx="6" cy="9" r="5" fill="${color}" />
          <text x="20" y="14" class="label">${escapeXml(item.language)}</text>
          <rect x="164" y="3" width="170" height="12" rx="6" fill="#eaeef2" />
          <rect x="164" y="3" width="${barWidth}" height="12" rx="6" fill="${color}" />
          <text x="348" y="14" class="value">${percent.toFixed(1)}%</text>
        </g>`;
    })
    .join("");

  const emptyState = '<text x="24" y="92" class="label">No language data found yet.</text>';

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} language statistics</title>
  <desc id="desc">GitHub language usage calculated from repository file sizes.</desc>
  <style>
    .title { fill: #02731B; font: 700 18px Segoe UI, Ubuntu, Sans-Serif; }
    .subtitle { fill: #57606a; font: 500 12px Segoe UI, Ubuntu, Sans-Serif; }
    .label { fill: #24292f; font: 600 13px Segoe UI, Ubuntu, Sans-Serif; }
    .value { fill: #57606a; font: 600 12px Segoe UI, Ubuntu, Sans-Serif; text-anchor: end; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="#ffffff" stroke="#d0d7de" />
  <text x="24" y="30" class="title">Most Used Languages</text>
  <text x="24" y="50" class="subtitle">Calculated by file size (${formatBytes(totalBytes)} total)</text>
  ${topLanguages.length ? rows : emptyState}
</svg>
`;
}

const repositories = await getRepositories();
const languageTotals = await getLanguageTotals(repositories);
const svg = renderSvg(languageTotals);
const outputDirectory = output.split("/").slice(0, -1).join("/") || ".";

await mkdir(outputDirectory, { recursive: true });
await writeFile(output, svg, "utf8");

console.log(`Generated ${output} for ${username} from ${repositories.length} repositories.`);
