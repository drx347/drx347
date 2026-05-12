import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.GITHUB_USERNAME || "drx347";
const token = process.env.GITHUB_TOKEN || "";
const languageOutput =
  process.env.LANGUAGE_OUTPUT_FILE ||
  process.env.OUTPUT_FILE ||
  "assets/github-languages.svg";
const overviewOutput =
  process.env.OVERVIEW_OUTPUT_FILE || "assets/github-overview.svg";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "ridmi-github-stats",
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

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
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

    repos.push(...batch.filter((repo) => !repo.fork && !repo.archived));
  }

  return repos;
}

async function getLanguageTotals(repositories) {
  const totals = new Map();

  await Promise.all(
    repositories
      .filter((repo) => repo.size > 0)
      .map(async (repo) => {
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

function animatedShell(width, height, title, desc) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">${escapeXml(desc)}</desc>
  <style>
    .title { fill: #02731B; font: 700 18px Segoe UI, Ubuntu, Sans-Serif; }
    .subtitle { fill: #57606a; font: 500 12px Segoe UI, Ubuntu, Sans-Serif; }
    .label { fill: #24292f; font: 600 13px Segoe UI, Ubuntu, Sans-Serif; }
    .value { fill: #02731B; font: 700 22px Segoe UI, Ubuntu, Sans-Serif; }
    .small { fill: #57606a; font: 600 12px Segoe UI, Ubuntu, Sans-Serif; }
    .bar-value { fill: #57606a; font: 600 12px Segoe UI, Ubuntu, Sans-Serif; text-anchor: end; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="#ffffff" stroke="#d0d7de" />
  <g id="loader">
    <rect x="24" y="25" width="180" height="18" rx="9" fill="#eaeef2" />
    <rect x="24" y="60" width="${width - 48}" height="14" rx="7" fill="#eaeef2" />
    <rect x="24" y="92" width="${width - 92}" height="14" rx="7" fill="#eaeef2" />
    <rect x="24" y="124" width="${width - 138}" height="14" rx="7" fill="#eaeef2" />
    <rect x="-120" y="0" width="90" height="${height}" fill="#ffffff" opacity=".55">
      <animate attributeName="x" values="-120;${width + 80}" dur="1.15s" repeatCount="2" />
    </rect>
    <animate attributeName="opacity" values="1;1;0" keyTimes="0;.72;1" dur="1.45s" fill="freeze" />
  </g>
  <g id="content" opacity="0" transform="translate(0 8)">
    <animate attributeName="opacity" values="0;1" begin=".95s" dur=".45s" fill="freeze" />
    <animateTransform attributeName="transform" type="translate" values="0 8;0 0" begin=".95s" dur=".45s" fill="freeze" />`;
}

function closeSvg() {
  return `
  </g>
</svg>
`;
}

function renderOverview(user, repositories, languageTotals) {
  const width = 460;
  const height = 195;
  const totalStars = repositories.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const totalForks = repositories.reduce((sum, repo) => sum + repo.forks_count, 0);
  const totalSize = repositories.reduce((sum, repo) => sum + repo.size * 1024, 0);
  const publicRepos = user.public_repos ?? repositories.length;
  const topLanguage = languageTotals[0]?.language || "Code";

  const stats = [
    ["Repositories", publicRepos],
    ["Stars", totalStars],
    ["Followers", user.followers || 0],
    ["Forks", totalForks],
  ];

  const statBlocks = stats
    .map(([label, value], index) => {
      const x = 24 + (index % 2) * 210;
      const y = 72 + Math.floor(index / 2) * 56;

      return `
    <g transform="translate(${x} ${y})">
      <text x="0" y="0" class="small">${escapeXml(label)}</text>
      <text x="0" y="27" class="value">${formatNumber(value)}</text>
    </g>`;
    })
    .join("");

  return `${animatedShell(
    width,
    height,
    `${username} GitHub overview`,
    "Animated GitHub overview card."
  )}
    <text x="24" y="30" class="title">${escapeXml(username)}'s GitHub Stats</text>
    <text x="24" y="50" class="subtitle">top language ${escapeXml(topLanguage)} - ${formatBytes(totalSize)} tracked</text>
    ${statBlocks}
${closeSvg()}`;
}

function renderLanguages(languageTotals) {
  const topLanguages = languageTotals.slice(0, 6);
  const totalBytes = languageTotals.reduce((sum, item) => sum + item.bytes, 0);
  const width = 460;
  const height = 195;

  const rows = topLanguages
    .map((item, index) => {
      const percent = totalBytes ? (item.bytes / totalBytes) * 100 : 0;
      const y = 66 + index * 20;
      const color = colors[item.language] || fallbackColors[index % fallbackColors.length];
      const barWidth = Math.max(4, Math.round((percent / 100) * 150));

      return `
    <g transform="translate(24 ${y})">
      <circle cx="5" cy="7" r="4.5" fill="${color}" />
      <text x="18" y="12" class="label">${escapeXml(item.language)}</text>
      <rect x="150" y="1" width="150" height="11" rx="5.5" fill="#eaeef2" />
      <rect x="150" y="1" width="0" height="11" rx="5.5" fill="${color}">
        <animate attributeName="width" values="0;${barWidth}" begin="1.05s" dur=".7s" fill="freeze" />
      </rect>
      <text x="348" y="12" class="bar-value">${percent.toFixed(1)}%</text>
    </g>`;
    })
    .join("");

  const emptyState = '<text x="24" y="92" class="label">No language data found yet.</text>';

  return `${animatedShell(
    width,
    height,
    `${username} language statistics`,
    "Animated language card calculated from repository file sizes."
  )}
    <text x="24" y="30" class="title">Most Used Languages</text>
    <text x="24" y="50" class="subtitle">calculated by file size - ${formatBytes(totalBytes)} total</text>
    ${topLanguages.length ? rows : emptyState}
${closeSvg()}`;
}

async function writeSvg(path, svg) {
  const outputDirectory = path.split("/").slice(0, -1).join("/") || ".";

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path, svg, "utf8");
}

const [user, repositories] = await Promise.all([
  github(`/users/${username}`),
  getRepositories(),
]);
const languageTotals = await getLanguageTotals(repositories);

await writeSvg(overviewOutput, renderOverview(user, repositories, languageTotals));
await writeSvg(languageOutput, renderLanguages(languageTotals));

if (languageOutput !== "assets/github-language-stats.svg") {
  await writeSvg("assets/github-language-stats.svg", renderLanguages(languageTotals));
}

console.log(
  `Generated ${overviewOutput} and ${languageOutput} for ${username} from ${repositories.length} repositories.`
);
