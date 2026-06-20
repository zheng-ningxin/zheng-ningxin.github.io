import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const outputPath = path.join(repoRoot, "data", "citations.json");
const shieldsOutputPath = path.join(repoRoot, "data", "gs_data_shieldsio.json");
const scholarUrl = "https://scholar.google.com/citations?user=ND2CeBkAAAAJ&hl=en";
const openAlexUrl = "https://api.openalex.org/authors/A5018118687";

const nowIso = new Date().toISOString();

const normalizeNumber = (value) => {
  const text = String(value || "").replace(/,/g, "").trim();
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const fetchGoogleScholar = async () => {
  const response = await fetchWithTimeout(
    `${scholarUrl}&_=${Date.now()}`,
    {
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
      }
    },
    15000
  );

  const html = await response.text();
  if (!response.ok || /automated queries|We're sorry|unusual traffic|captcha/i.test(html)) {
    throw new Error(`Google Scholar blocked or unavailable: HTTP ${response.status}`);
  }

  const stats = [...html.matchAll(/<td[^>]*class=["'][^"']*gsc_rsb_std[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi)]
    .map((match) => match[1].replace(/<[^>]*>/g, "").trim())
    .map(normalizeNumber)
    .filter((value) => value !== null);

  if (stats.length < 5) {
    throw new Error("Google Scholar citation table not found");
  }

  return {
    source: "google_scholar",
    sourceLabel: "Google Scholar",
    sourceUrl: scholarUrl,
    citations: stats[0],
    hIndex: stats[2],
    i10Index: stats[4],
    updatedAt: nowIso
  };
};

const fetchOpenAlex = async (reason) => {
  const response = await fetchWithTimeout(openAlexUrl, { headers: { "accept": "application/json" } }, 15000);
  if (!response.ok) throw new Error(`OpenAlex fallback failed: HTTP ${response.status}`);

  const data = await response.json();
  const stats = data.summary_stats || {};

  return {
    source: "openalex",
    sourceLabel: "OpenAlex",
    sourceUrl: "https://openalex.org/A5018118687",
    citations: Number(data.cited_by_count || 0),
    hIndex: stats.h_index ?? null,
    i10Index: stats.i10_index ?? null,
    updatedAt: data.updated_date || nowIso,
    note: reason ? `Google Scholar unavailable during scheduled update: ${reason}` : undefined,
    googleScholarUrl: scholarUrl
  };
};

let citationData;
try {
  citationData = await fetchGoogleScholar();
  console.log(`Google Scholar citations: ${citationData.citations}`);
} catch (error) {
  console.warn(error.message);
  citationData = await fetchOpenAlex(error.message);
  console.log(`OpenAlex fallback citations: ${citationData.citations}`);
}

const shieldsData = {
  schemaVersion: 1,
  label: "citations",
  message: Number(citationData.citations || 0).toLocaleString("en-US"),
  color: "9cf",
  namedLogo: "Google Scholar",
  labelColor: "f6f6f6"
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(citationData, null, 2)}\n`, "utf8");
await writeFile(shieldsOutputPath, `${JSON.stringify(shieldsData, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
console.log(`Wrote ${path.relative(repoRoot, shieldsOutputPath)}`);
