import { mkdir, writeFile } from "node:fs/promises";

const outputPath = new URL("../data/hourly-stats.json", import.meta.url);
const primaryGamesUrl = process.env.PRIMARY_GAMES_URL || "https://worldcup26.ir/get/games";
const espnDates = process.env.ESPN_SCOREBOARD_DATES || "20260611-20260719";
const espnScoreboardUrl =
  process.env.ESPN_SCOREBOARD_URL ||
  `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${espnDates}`;
const espnSummaryBaseUrl =
  process.env.ESPN_SUMMARY_BASE_URL ||
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=";

const headers = {
  "user-agent": "GGPowermax World Cup tracker (+https://ggpowermax.github.io/)",
  "accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
};

const statMap = {
  possession: "possessionPct",
  shots: "totalShots",
  shotsOnTarget: "shotsOnTarget",
  corners: "wonCorners",
  yellowCards: "yellowCards",
  redCards: "redCards",
  fouls: "foulsCommitted",
  offsides: "offsides",
};

const teamAliases = new Map([
  ["bosnia-herzegovina", "bosnia and herzegovina"],
  ["bosnia herz", "bosnia and herzegovina"],
  ["cabo verde", "cape verde"],
  ["czechia", "czech republic"],
  ["curaçao", "curacao"],
  ["côte d'ivoire", "ivory coast"],
  ["cote d'ivoire", "ivory coast"],
  ["ivory coast", "ivory coast"],
  ["korea republic", "south korea"],
  ["usa", "united states"],
]);

async function main() {
  const [primaryGames, scoreboard] = await Promise.all([
    fetchJson(primaryGamesUrl),
    fetchJson(espnScoreboardUrl),
  ]);

  const localMatches = normalizePrimaryGames(primaryGames);
  const matchesByTeams = new Map(localMatches.map((match) => [matchKey(match.home, match.away), match]));
  const espnEvents = (scoreboard.events || []).filter((event) => shouldFetchSummary(event));
  const snapshotMatches = [];

  for (const event of espnEvents) {
    const mapped = mapEspnEventToLocalMatch(event, matchesByTeams);
    if (!mapped) continue;

    try {
      const summary = await fetchJson(`${espnSummaryBaseUrl}${event.id}`);
      const snapshot = buildSnapshotMatch(mapped, event, summary);
      if (snapshot) snapshotMatches.push(snapshot);
    } catch (error) {
      console.warn(`Skipping ESPN event ${event.id}: ${error.message}`);
    }
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "ESPN public scoreboard and summary JSON",
    sourceUrl: espnScoreboardUrl,
    matches: snapshotMatches,
    note: "Generated hourly from ESPN public JSON endpoints and mapped to worldcup26.ir match ids. Empty fields mean the source did not provide reliable data.",
  };

  await writeSnapshot(snapshot);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

function normalizePrimaryGames(payload) {
  const games = payload.games || payload || [];
  return games.map((game) => ({
    id: String(game.id || game._id),
    home: game.home_team_name_en || game.home_team_label,
    away: game.away_team_name_en || game.away_team_label,
  })).filter((match) => match.id && match.home && match.away);
}

function shouldFetchSummary(event) {
  const type = event.status?.type || {};
  return Boolean(type.completed || type.name === "STATUS_FULL_TIME" || type.state === "in");
}

function mapEspnEventToLocalMatch(event, matchesByTeams) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find((item) => item.homeAway === "home")?.team?.displayName;
  const away = competitors.find((item) => item.homeAway === "away")?.team?.displayName;
  if (!home || !away) return null;
  return matchesByTeams.get(matchKey(home, away)) || null;
}

function buildSnapshotMatch(localMatch, event, summary) {
  const competition = summary.header?.competitions?.[0] || event.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find((item) => item.homeAway === "home");
  const away = competitors.find((item) => item.homeAway === "away");
  if (!home || !away) return null;

  const status = competition.status?.type || event.status?.type || {};
  const stats = extractTeamStats(summary.boxscore?.teams || [], home.team?.displayName, away.team?.displayName);
  const scorers = extractScorers(summary.keyEvents || [], home.team?.displayName, away.team?.displayName);

  return {
    id: localMatch.id,
    updatedAt: new Date().toISOString(),
    source: "ESPN public summary JSON",
    sourceUrl: `https://www.espn.com/soccer/match/_/gameId/${event.id}`,
    espnEventId: String(event.id),
    homeScore: toNumber(home.score),
    awayScore: toNumber(away.score),
    finished: Boolean(status.completed || status.name === "STATUS_FULL_TIME"),
    timeElapsed: status.completed || status.name === "STATUS_FULL_TIME" ? "finished" : "live",
    homeScorers: formatScorers(scorers.home),
    awayScorers: formatScorers(scorers.away),
    stats,
  };
}

function extractTeamStats(teams, homeName, awayName) {
  const homeStats = statsByTeamName(teams, homeName);
  const awayStats = statsByTeamName(teams, awayName);
  const stats = {};

  for (const [outputKey, espnName] of Object.entries(statMap)) {
    const home = parseStat(homeStats.get(espnName));
    const away = parseStat(awayStats.get(espnName));
    if (home === null && away === null) continue;
    stats[outputKey] = { home, away };
  }

  return stats;
}

function statsByTeamName(teams, teamName) {
  const team = teams.find((item) => normalizeTeamName(item.team?.displayName) === normalizeTeamName(teamName));
  return new Map((team?.statistics || []).map((stat) => [stat.name, stat.displayValue]));
}

function extractScorers(events, homeName, awayName) {
  const scorers = { home: [], away: [] };
  for (const event of events) {
    const type = event.type?.text || "";
    if (!/goal/i.test(type)) continue;
    const team = normalizeTeamName(event.team?.displayName);
    const bucket = team === normalizeTeamName(homeName) ? scorers.home : team === normalizeTeamName(awayName) ? scorers.away : null;
    if (!bucket) continue;

    const scorer = parseScorerName(event.text || "", type);
    if (!scorer) continue;
    const clock = event.clock?.displayValue || "";
    bucket.push(`${scorer}${clock ? ` ${clock}` : ""}${/own goal/i.test(type) ? " (OG)" : ""}`);
  }
  return scorers;
}

function parseScorerName(text, type) {
  if (/own goal/i.test(type)) {
    const ownGoal = text.match(/Own Goal by ([^,.]+)/i);
    return ownGoal?.[1]?.trim() || null;
  }
  const goal = text.match(/\.\s*([^(.]+?)\s*\([^)]+\)/);
  if (goal?.[1]) return goal[1].trim();
  const fallback = text.match(/Goal!\s*.*?\.\s*([^(.]+?)\s*\(/);
  return fallback?.[1]?.trim() || null;
}

function formatScorers(items) {
  if (!items.length) return "null";
  return `{ ${items.map((item) => JSON.stringify(item)).join(", ")} }`;
}

function parseStat(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function matchKey(home, away) {
  return `${normalizeTeamName(home)}::${normalizeTeamName(away)}`;
}

function normalizeTeamName(value = "") {
  const folded = String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return teamAliases.get(folded) || folded;
}

async function writeSnapshot(snapshot) {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
