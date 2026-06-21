const API_BASE = "https://worldcup26.ir/get";
const FAVORITES_KEY = "worldcup26.favoriteMatches";
const CACHE_KEY = "worldcup26.lastLivePayload";

const state = {
  matches: [],
  teams: new Map(),
  favorites: new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]")),
  currentView: "today",
};

const els = {
  refreshButton: document.querySelector("#refreshButton"),
  todayLabel: document.querySelector("#todayLabel"),
  heroTitle: document.querySelector("#heroTitle"),
  sourceBadge: document.querySelector("#sourceBadge"),
  statusMessage: document.querySelector("#statusMessage"),
  todayMatches: document.querySelector("#todayMatches"),
  scheduleMatches: document.querySelector("#scheduleMatches"),
  standings: document.querySelector("#standings"),
  scorersList: document.querySelector("#scorersList"),
  teamGoalsList: document.querySelector("#teamGoalsList"),
  favoriteMatches: document.querySelector("#favoriteMatches"),
  stageFilter: document.querySelector("#stageFilter"),
  jumpUpcoming: document.querySelector("#jumpUpcoming"),
  dialog: document.querySelector("#matchDialog"),
  dialogStage: document.querySelector("#dialogStage"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogBody: document.querySelector("#dialogBody"),
  closeDialog: document.querySelector("#closeDialog"),
};

const stageNames = {
  group: "分組賽",
  r32: "32 強",
  r16: "16 強",
  qf: "8 強",
  sf: "4 強",
  third: "季軍戰",
  final: "決賽",
};

const teamFlags = {
  Algeria: "🇩🇿", Argentina: "🇦🇷", Australia: "🇦🇺", Austria: "🇦🇹", Belgium: "🇧🇪",
  Brazil: "🇧🇷", Canada: "🇨🇦", "Cape Verde": "🇨🇻", Colombia: "🇨🇴", Croatia: "🇭🇷",
  "Curaçao": "🇨🇼", "Czech Republic": "🇨🇿", "Democratic Republic of the Congo": "🇨🇩",
  Ecuador: "🇪🇨", Egypt: "🇪🇬", England: "🏴", France: "🇫🇷", Germany: "🇩🇪", Ghana: "🇬🇭",
  Haiti: "🇭🇹", Iran: "🇮🇷", Iraq: "🇮🇶", "Ivory Coast": "🇨🇮", Japan: "🇯🇵", Jordan: "🇯🇴",
  Mexico: "🇲🇽", Morocco: "🇲🇦", Netherlands: "🇳🇱", "New Zealand": "🇳🇿", Norway: "🇳🇴",
  Panama: "🇵🇦", Paraguay: "🇵🇾", Portugal: "🇵🇹", Qatar: "🇶🇦", "Saudi Arabia": "🇸🇦",
  Scotland: "🏴", Senegal: "🇸🇳", "South Africa": "🇿🇦", "South Korea": "🇰🇷", Spain: "🇪🇸",
  Sweden: "🇸🇪", Switzerland: "🇨🇭", Tunisia: "🇹🇳", Turkey: "🇹🇷", "United States": "🇺🇸",
  Uruguay: "🇺🇾", Uzbekistan: "🇺🇿",
};

function safeText(value, fallback = "") {
  if (value === undefined || value === null || value === "null") return fallback;
  return String(value);
}

function parseMatchDate(match) {
  const raw = safeText(match.local_date);
  const [datePart, timePart = "00:00"] = raw.split(" ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeMatch(match) {
  const home = safeText(match.home_team_name_en || match.home_team_label, "待定");
  const away = safeText(match.away_team_name_en || match.away_team_label, "待定");
  const normalized = {
    ...match,
    id: safeText(match.id || match._id),
    home,
    away,
    homeScore: safeText(match.home_score, "-"),
    awayScore: safeText(match.away_score, "-"),
    stage: safeText(match.type, "group").toLowerCase(),
    groupName: safeText(match.group),
    isFinished: safeText(match.finished).toUpperCase() === "TRUE",
    timeElapsed: safeText(match.time_elapsed, "notstarted").toLowerCase(),
    date: parseMatchDate(match),
  };

  if (match.home_team_id && match.home_team_id !== "0") state.teams.set(match.home_team_id, home);
  if (match.away_team_id && match.away_team_id !== "0") state.teams.set(match.away_team_id, away);

  return normalized;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadData() {
  setStatus("讀取最新資料中...", false);
  els.refreshButton.disabled = true;

  try {
    const data = await fetchJson(`${API_BASE}/games`);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data }));
    state.matches = (data.games || data || []).map(normalizeMatch).sort((a, b) => a.date - b.date);
    els.sourceBadge.textContent = "Live API";
    setStatus("", false);
  } catch (error) {
    console.warn(error);
    const cached = readCachedPayload();
    if (cached) {
      state.matches = (cached.data.games || cached.data || []).map(normalizeMatch).sort((a, b) => a.date - b.date);
      els.sourceBadge.textContent = "快取";
      setStatus(`即時 API 暫時讀不到，現在顯示 ${formatCacheTime(cached.savedAt)} 儲存的真實資料。`, true);
    } else {
      setStatus("即時 API 暫時讀不到。請確認網路或稍後按重新整理。", true);
      state.matches = [];
      els.sourceBadge.textContent = "離線";
    }
  } finally {
    els.refreshButton.disabled = false;
    render();
  }
}

function readCachedPayload() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

function formatCacheTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "上次";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function setStatus(message, visible) {
  els.statusMessage.textContent = message;
  els.statusMessage.hidden = !visible && !message;
}

function statusLabel(match) {
  if (match.isFinished) return "已結束";
  if (match.timeElapsed && !["notstarted", "0"].includes(match.timeElapsed)) return "進行中";
  return "未開始";
}

function scoreText(score, match) {
  if (!match.isFinished && statusLabel(match) === "未開始") return "-";
  return score;
}

function flagFor(name) {
  return teamFlags[name] || "🏳";
}

function stageText(match) {
  const stage = stageNames[match.stage] || match.stage.toUpperCase();
  return match.stage === "group" ? `${stage} ${match.groupName} 組` : stage;
}

function createMatchCard(match) {
  const button = document.createElement("button");
  button.className = "match-card";
  button.type = "button";
  button.addEventListener("click", () => openMatch(match.id));

  const liveClass = statusLabel(match) === "進行中" ? " live" : "";
  const favoriteActive = state.favorites.has(match.id) ? " active" : "";

  button.innerHTML = `
    <div class="match-meta">
      <span>${formatDateTime(match.date)} · ${stageText(match)}</span>
      <span class="status-pill${liveClass}">${statusLabel(match)}</span>
    </div>
    <div class="team-row">
      <span class="team-name"><span>${flagFor(match.home)}</span><span>${match.home}</span></span>
      <span class="score">${scoreText(match.homeScore, match)}</span>
    </div>
    <div class="team-row">
      <span class="team-name"><span>${flagFor(match.away)}</span><span>${match.away}</span></span>
      <span class="score">${scoreText(match.awayScore, match)}</span>
    </div>
    <div class="match-actions">
      <span>點開看進球與細節</span>
      <span class="favorite-toggle${favoriteActive}" data-favorite="${match.id}">★</span>
    </div>
  `;

  button.querySelector("[data-favorite]").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(match.id);
  });

  return button;
}

function renderMatchList(container, matches, emptyText) {
  container.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }
  matches.forEach((match) => container.append(createMatchCard(match)));
}

function getTodayMatches() {
  if (!state.matches.length) return [];
  const now = new Date();
  const today = dateKey(now);
  const todayMatches = state.matches.filter((match) => dateKey(match.date) === today);
  if (todayMatches.length) return todayMatches;

  const next = state.matches.find((match) => !match.isFinished) || state.matches.at(-1);
  return state.matches.filter((match) => dateKey(match.date) === dateKey(next.date));
}

function renderHero() {
  const now = new Date();
  els.todayLabel.textContent = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);

  const live = state.matches.filter((match) => statusLabel(match) === "進行中");
  const next = state.matches.find((match) => !match.isFinished);
  if (live.length) {
    els.heroTitle.textContent = `${live.length} 場正在進行`;
  } else if (next) {
    els.heroTitle.textContent = `下一場：${next.home} vs ${next.away}`;
  } else if (state.matches.length) {
    els.heroTitle.textContent = "賽程已全部完成";
  } else {
    els.heroTitle.textContent = "等待資料載入";
  }
}

function renderSchedule() {
  const filter = els.stageFilter.value;
  const matches = filter === "all" ? state.matches : state.matches.filter((match) => match.stage === filter);
  renderMatchList(els.scheduleMatches, matches, "沒有符合條件的賽事。");
}

function calculateStandings() {
  const groups = new Map();

  for (const match of state.matches.filter((item) => item.stage === "group")) {
    if (!groups.has(match.groupName)) groups.set(match.groupName, new Map());
    const group = groups.get(match.groupName);
    ensureTeam(group, match.home_team_id, match.home);
    ensureTeam(group, match.away_team_id, match.away);

    if (!match.isFinished) continue;
    const homeScore = Number(match.homeScore);
    const awayScore = Number(match.awayScore);
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) continue;

    applyResult(group.get(match.home_team_id), homeScore, awayScore);
    applyResult(group.get(match.away_team_id), awayScore, homeScore);
  }

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function ensureTeam(group, id, name) {
  if (!id || id === "0" || group.has(id)) return;
  group.set(id, { id, name, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
}

function applyResult(team, scored, conceded) {
  team.mp += 1;
  team.gf += scored;
  team.ga += conceded;
  team.gd = team.gf - team.ga;
  if (scored > conceded) {
    team.w += 1;
    team.pts += 3;
  } else if (scored === conceded) {
    team.d += 1;
    team.pts += 1;
  } else {
    team.l += 1;
  }
}

function renderStandings() {
  els.standings.replaceChildren();
  const groups = calculateStandings();
  if (!groups.length) {
    els.standings.innerHTML = `<div class="empty-state">排名資料尚未可用。</div>`;
    return;
  }

  for (const [groupName, teamsMap] of groups) {
    const teams = [...teamsMap.values()].sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
    );
    const card = document.createElement("article");
    card.className = "standings-card";
    card.innerHTML = `
      <h3>${groupName} 組</h3>
      <table class="standings-table">
        <thead>
          <tr><th>隊伍</th><th>賽</th><th>勝</th><th>和</th><th>敗</th><th>差</th><th>分</th></tr>
        </thead>
        <tbody>
          ${teams.map((team, index) => `
            <tr>
              <td class="${index < 2 ? "qualify" : ""}">${flagFor(team.name)} ${team.name}</td>
              <td>${team.mp}</td><td>${team.w}</td><td>${team.d}</td><td>${team.l}</td>
              <td>${team.gd}</td><td><strong>${team.pts}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    els.standings.append(card);
  }
}

function parseScorers(raw) {
  const text = safeText(raw).replace(/[{}"“”]/g, "").trim();
  if (!text) return [];
  return text.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
    const cleaned = item.replace(/\s*\(p\)/i, "").replace(/\s*\(OG\)/i, " (烏龍)");
    const name = cleaned.replace(/\s+\d{1,3}'?.*$/, "").trim();
    return name || cleaned;
  });
}

function renderStats() {
  const scorers = new Map();
  const teamGoals = new Map();

  state.matches.filter((match) => match.isFinished).forEach((match) => {
    const homeScore = Number(match.homeScore);
    const awayScore = Number(match.awayScore);
    teamGoals.set(match.home, (teamGoals.get(match.home) || 0) + (Number.isNaN(homeScore) ? 0 : homeScore));
    teamGoals.set(match.away, (teamGoals.get(match.away) || 0) + (Number.isNaN(awayScore) ? 0 : awayScore));

    parseScorers(match.home_scorers).forEach((name) => scorers.set(name, (scorers.get(name) || 0) + 1));
    parseScorers(match.away_scorers).forEach((name) => scorers.set(name, (scorers.get(name) || 0) + 1));
  });

  fillRankList(els.scorersList, [...scorers.entries()], "尚無進球資料");
  fillRankList(els.teamGoalsList, [...teamGoals.entries()], "尚無球隊進球資料", true);
}

function fillRankList(container, rows, emptyText, withFlag = false) {
  container.replaceChildren();
  const sorted = rows.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
  if (!sorted.length) {
    const item = document.createElement("li");
    item.textContent = emptyText;
    container.append(item);
    return;
  }
  sorted.forEach(([name, count]) => {
    const item = document.createElement("li");
    item.innerHTML = `<span class="stat-row"><span>${withFlag ? `${flagFor(name)} ` : ""}${name}</span><strong>${count}</strong></span>`;
    container.append(item);
  });
}

function renderFavorites() {
  const matches = state.matches.filter((match) => state.favorites.has(match.id));
  renderMatchList(els.favoriteMatches, matches, "還沒有收藏比賽，點賽事卡片上的星號就能收藏。");
}

function render() {
  renderHero();
  renderMatchList(els.todayMatches, getTodayMatches(), "今日沒有賽事。");
  renderSchedule();
  renderStandings();
  renderStats();
  renderFavorites();
}

function toggleFavorite(id) {
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
  render();
}

function openMatch(id) {
  const match = state.matches.find((item) => item.id === id);
  if (!match) return;

  els.dialogStage.textContent = `${formatDateTime(match.date)} · ${stageText(match)}`;
  els.dialogTitle.textContent = `${match.home} vs ${match.away}`;
  els.dialogBody.innerHTML = `
    <div class="detail-score">
      <span>${flagFor(match.home)}<br>${match.home}</span>
      <strong>${scoreText(match.homeScore, match)} : ${scoreText(match.awayScore, match)}</strong>
      <span>${flagFor(match.away)}<br>${match.away}</span>
    </div>
    <div class="detail-block">
      <h3>比賽狀態</h3>
      <p>${statusLabel(match)} · Matchday ${safeText(match.matchday, "-")}</p>
      <p>資料時間以 API 提供的賽事當地時間顯示。</p>
    </div>
    <div class="detail-block">
      <h3>${match.home} 進球</h3>
      ${renderScorerParagraphs(match.home_scorers)}
    </div>
    <div class="detail-block">
      <h3>${match.away} 進球</h3>
      ${renderScorerParagraphs(match.away_scorers)}
    </div>
  `;
  els.dialog.showModal();
}

function renderScorerParagraphs(raw) {
  const scorers = parseScorers(raw);
  if (!scorers.length) return "<p>目前沒有進球紀錄。</p>";
  return scorers.map((name) => `<p>${name}</p>`).join("");
}

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll(".view").forEach((item) => item.classList.toggle("active", item.id === `view-${view}`));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

els.refreshButton.addEventListener("click", loadData);
els.stageFilter.addEventListener("change", renderSchedule);
els.closeDialog.addEventListener("click", () => els.dialog.close());
els.jumpUpcoming.addEventListener("click", () => {
  switchView("schedule");
  const next = state.matches.find((match) => !match.isFinished);
  if (next) openMatch(next.id);
});

loadData();
