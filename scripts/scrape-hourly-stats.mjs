import { mkdir, writeFile } from "node:fs/promises";

const outputPath = new URL("../data/hourly-stats.json", import.meta.url);
const sourceUrl = process.env.STATS_SOURCE_URL || "";

async function main() {
  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: sourceUrl || null,
    matches: [],
  };

  if (!sourceUrl) {
    snapshot.note = "Set STATS_SOURCE_URL after choosing the fixed stats website.";
    await writeSnapshot(snapshot);
    return;
  }

  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "Kenhsieh1211 World Cup tracker (+https://kenhsieh1211.github.io/)",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: HTTP ${response.status}`);
  }

  const html = await response.text();
  snapshot.matches = parseStatsPage(html);
  await writeSnapshot(snapshot);
}

function parseStatsPage(html) {
  // The exact selectors depend on the fixed source website we choose.
  // Keep this empty until we confirm a page whose terms allow hourly fetching.
  void html;
  return [];
}

async function writeSnapshot(snapshot) {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
