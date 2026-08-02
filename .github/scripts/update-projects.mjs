/**
 * Rebuilds the projects section of README.md from the GitHub API.
 *
 * Everything between the START and END markers is regenerated, so don't hand-edit
 * inside them — your changes get overwritten on the next run. To change how a repo
 * is presented, edit the CONFIG block below instead.
 *
 * Run locally with:  GH_USER=fawziatahia node .github/scripts/update-projects.mjs
 */

import { readFile, writeFile } from "node:fs/promises";

/* ────────────────────────── CONFIG — edit this ────────────────────────── */

// How many repos get the big card treatment. The rest go in the collapsible list.
const FEATURED_COUNT = 4;

// Repos listed here are always featured first, in this order, no matter when they
// were last pushed. Leave the array empty to go purely by most-recently-pushed.
const ALWAYS_FEATURE = ["DocSlot"];

// Never show these (case-insensitive). The profile repo itself is skipped already.
const HIDE = ["test", "hello-world"];

// Your own wording, used instead of the repo's GitHub description.
// Anything not listed here falls back to the GitHub description.
const DESCRIPTIONS = {
  docslot:
    "A full-stack healthcare app: patients book open slots, doctors manage their schedule, admins keep the whole thing honest.",
  "travelagent.ai":
    "Turns a loose travel idea into a usable plan. Built in Python, driven by an LLM.",
  "webdev-project-php":
    "Profiles, posts, and interactions built on a hand-rolled PHP backend.",
  "profile-ui":
    "A mobile profile screen built to practise layout, theming, and responsive widgets.",
};

// Pretty display names. Without an entry here the repo name is used with
// dashes and underscores turned into spaces.
const NAMES = {
  "webdev-project-php": "Social Media App",
  "c-programming-problems": "C Programming Problems",
};

// Icon per repo. Falls back to a language icon, then a generic one.
const EMOJI = {
  docslot: "🩺",
  "travelagent.ai": "✈️",
  "webdev-project-php": "🌐",
  "profile-ui": "📱",
  portfolio: "🎨",
  "quiz-app": "❓",
};

const LANG_EMOJI = {
  PHP: "🐘", Python: "🐍", Java: "☕", C: "🔧", "C++": "⚙️",
  JavaScript: "📜", TypeScript: "📘", Dart: "📱", HTML: "🎨", CSS: "🎨",
  Blade: "🐘", Shell: "🖥️", "Jupyter Notebook": "📊",
};

const LANG_COLOR = {
  PHP: "777BB4", Python: "3776AB", Java: "ED8B00", C: "A8B9CC", "C++": "00599C",
  JavaScript: "F7DF1E", TypeScript: "3178C6", Dart: "0175C2", HTML: "E34F26",
  CSS: "1572B6", Blade: "F7523F", Shell: "89E051", Vue: "41B883", Go: "00ADD8",
  Kotlin: "A97BFF", Swift: "F05138", Ruby: "CC342D", "C#": "239120",
  SCSS: "CC6699", "Jupyter Notebook": "F37626",
};

/* ──────────────────────────── implementation ──────────────────────────── */

const USER = process.env.GH_USER;
const TOKEN = process.env.GITHUB_TOKEN;
const README = process.env.README_PATH || "README.md";
const START = "<!-- PROJECTS:START -->";
const END = "<!-- PROJECTS:END -->";

if (!USER) {
  console.error("GH_USER is not set. Pass it from the workflow.");
  process.exit(1);
}

/** shields.io escaping: dashes double, underscores double, spaces become underscores. */
const shield = (s) =>
  encodeURIComponent(String(s).replace(/-/g, "--").replace(/_/g, "__")).replace(/%20/g, "_");

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function agoLabel(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function titleise(name) {
  return (
    NAMES[name.toLowerCase()] ||
    name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
  );
}

async function fetchRepos() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": `${USER}-profile-readme`,
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const all = [];
  for (let page = 1; page <= 4; page++) {
    const url = `https://api.github.com/users/${USER}/repos?per_page=100&page=${page}&sort=pushed&direction=desc&type=owner`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} ${res.statusText} — ${await res.text()}`);
    }
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

function describe(repo) {
  const custom = DESCRIPTIONS[repo.name.toLowerCase()];
  if (custom) return custom;
  if (repo.description) return repo.description;
  if (repo.language) return `A ${repo.language} project.`;
  return "Source available on GitHub.";
}

function iconFor(repo) {
  return EMOJI[repo.name.toLowerCase()] || LANG_EMOJI[repo.language] || "📦";
}

function langBadge(lang) {
  if (!lang) return "";
  const color = LANG_COLOR[lang] || "7AA2F7";
  return `<img src="https://img.shields.io/badge/${shield(lang)}-${color}?style=flat-square" alt="${esc(lang)}" />`;
}

function starBadge(count) {
  if (!count) return "";
  return `<img src="https://img.shields.io/badge/${shield(`★ ${count}`)}-1A1B27?style=flat-square" alt="${count} star${count === 1 ? "" : "s"}" />`;
}

function card(repo) {
  const badges = [langBadge(repo.language), starBadge(repo.stargazers_count)]
    .filter(Boolean)
    .join("\n        ");

  return `    <td width="50%" valign="top">
      <h3>${iconFor(repo)} ${esc(titleise(repo.name))}</h3>
      <p>${esc(describe(repo))}</p>
      <p>
        ${badges || "&nbsp;"}
      </p>
      <p>
        <a href="${repo.html_url}">→ View repo</a>
        <sub>· updated ${agoLabel(repo.pushed_at)}</sub>
      </p>
    </td>`;
}

function buildSection(repos) {
  const featured = [];
  const seen = new Set();

  for (const wanted of ALWAYS_FEATURE) {
    const hit = repos.find((r) => r.name.toLowerCase() === wanted.toLowerCase());
    if (hit) {
      featured.push(hit);
      seen.add(hit.id);
    }
  }
  for (const repo of repos) {
    if (featured.length >= FEATURED_COUNT) break;
    if (!seen.has(repo.id)) {
      featured.push(repo);
      seen.add(repo.id);
    }
  }

  const rest = repos.filter((r) => !seen.has(r.id));

  // featured grid, two cards per row
  const rows = [];
  for (let i = 0; i < featured.length; i += 2) {
    rows.push(`  <tr>\n${featured.slice(i, i + 2).map(card).join("\n")}\n  </tr>`);
  }
  const grid = `<table>\n${rows.join("\n")}\n</table>`;

  // everything else, collapsed
  let archive = "";
  if (rest.length) {
    const items = rest
      .map(
        (r) =>
          `      <tr><td>${iconFor(r)} <a href="${r.html_url}"><b>${esc(titleise(r.name))}</b></a></td>` +
          `<td>${esc(describe(r))}</td>` +
          `<td align="right"><sub>${esc(r.language || "—")}</sub></td></tr>`
      )
      .join("\n");

    archive = `

<details>
  <summary><b>🗂️ Everything else</b> — ${rest.length} more ${rest.length === 1 ? "repository" : "repositories"}</summary>
  <br />
  <table>
${items}
  </table>
</details>`;
  }

  const synced = new Date().toISOString().slice(0, 10);
  const footer = `

<sub>📂 ${repos.length} public ${repos.length === 1 ? "repository" : "repositories"} · auto-synced from the GitHub API on ${synced}</sub>`;

  return `${grid}${archive}${footer}`;
}

/* ──────────────────────────────── main ──────────────────────────────── */

const raw = await fetchRepos();

const repos = raw
  .filter((r) => !r.fork && !r.archived && !r.private && !r.disabled)
  .filter((r) => r.name.toLowerCase() !== USER.toLowerCase())
  .filter((r) => !HIDE.includes(r.name.toLowerCase()))
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

if (!repos.length) {
  console.error("No repositories came back — leaving the README untouched.");
  process.exit(0);
}

const readme = await readFile(README, "utf8");
const startAt = readme.indexOf(START);
const endAt = readme.indexOf(END);

if (startAt === -1 || endAt === -1) {
  console.error(`Could not find the ${START} / ${END} markers in ${README}.`);
  process.exit(1);
}

const next =
  readme.slice(0, startAt + START.length) +
  "\n" +
  buildSection(repos) +
  "\n" +
  readme.slice(endAt);

if (next === readme) {
  console.log("Projects section already up to date.");
} else {
  await writeFile(README, next);
  console.log(`Updated ${README} — ${repos.length} repos, ${Math.min(FEATURED_COUNT, repos.length)} featured.`);
}
