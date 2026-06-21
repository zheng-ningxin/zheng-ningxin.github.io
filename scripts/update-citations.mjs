import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const outputPath = path.join(repoRoot, "data", "citations.json");
const shieldsOutputPath = path.join(repoRoot, "data", "gs_data_shieldsio.json");
const scholarUrl = "https://scholar.google.com/citations?user=ND2CeBkAAAAJ&hl=en";

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

let citationData;
try {
  citationData = await fetchGoogleScholar();
  console.log(`Google Scholar citations: ${citationData.citations}`);
} catch (error) {
  console.warn(error.message);
  console.warn("Google Scholar unavailable. Keeping existing citation data instead of falling back to another source.");
  process.exit(0);
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
