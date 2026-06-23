# 每小時迭代工作流

目標：每一輪都能產出可上線的小改版，確認沒壞掉後立刻推到 GitHub Pages。

## 固定節奏

### 第 0-10 分鐘：確認目標

- 看線上站台是否正常。
- 檢查目前資料欄位與資料來源狀態。
- 從 backlog 挑 1-2 個本輪一定能完成的項目。

### 第 10-35 分鐘：實作

- 小步修改介面、資料轉換層或爬蟲管線。
- 每個資料欄位都要標記來源；沒有真資料時顯示等待資料源，不塞假數字。
- 優先做手機版可讀性。

### 第 35-45 分鐘：驗證

- 本機開 `http://127.0.0.1:4173/`。
- 檢查首頁、賽程、排名、數據、收藏、單場詳情。
- 跑 `node --check app.js` 與 `node scripts/scrape-hourly-stats.mjs`。
- 至少確認 console 沒有錯誤。

### 第 45-55 分鐘：發布

- `git status`
- `git add`
- `git commit -m "..."`
- `git push origin main`
- 確認 GitHub Pages 狀態為 built。

### 第 55-60 分鐘：紀錄

- 更新本文件的迭代紀錄。
- 寫下一輪要做什麼。

## 每小時資料管線

### 目的

用 GitHub Actions 每小時抓一次固定網站，產生 `data/hourly-stats.json`。前端讀取這份快照後，合併到每場比賽的技術數據。

### 原則

- 只抓公開頁面，並確認來源網站條款與 robots 規則允許合理頻率存取。
- 頻率固定為每小時，不對來源網站做高頻請求。
- 不在前端抓第三方網站，避免 CORS、效能和使用者端流量問題。
- 原始資料轉成自己的 JSON 格式，前端只吃穩定 schema。

### 快照格式

```json
{
  "generatedAt": "2026-06-22T03:00:00.000Z",
  "source": "https://example.com/world-cup/match-stats",
  "matches": [
    {
      "id": "37",
      "updatedAt": "2026-06-22T03:00:00.000Z",
      "source": "Example Stats",
      "stats": {
        "corners": { "home": 4, "away": 2 },
        "yellowCards": { "home": 1, "away": 3 },
        "redCards": { "home": 0, "away": 1 }
      }
    }
  ]
}
```

## Backlog

1. 監控 ESPN public JSON 管線穩定性，必要時加 FOX Sports / Guardian fallback；不要爬 Google 搜尋結果本身。
2. 擴充 `data/hourly-stats.json` 欄位：陣容、換人、球員事件。
3. 新增球隊頁：隊伍賽程、進球、失球、角球、牌數。
4. 新增資料完整度指標：陣容、事件、球員層級統計。
5. 加 PWA：手機桌面圖示、離線快取、更新提示。
6. 加搜尋與快速篩選球隊。

## 迭代紀錄

### 2026-06-22 03:00 TST

- 建立每小時迭代工作流。
- 單場詳情新增技術數據區塊：控球率、射門、射正、角球、黃牌、紅牌、犯規、越位。
- 目前免金鑰 API 尚未提供角球/牌數等技術統計，介面已支援欄位並顯示資料源狀態。

### 2026-06-22 04:00 TST

- 新增 GitHub Actions 每小時資料快照管線。
- 新增 `scripts/scrape-hourly-stats.mjs` 與 `data/hourly-stats.json`。
- 前端改為載入 `data/hourly-stats.json` 並合併角球、黃牌、紅牌等技術數據。
- 下一步是選定固定網站，補上實際解析器。

### 2026-06-22 04:05 TST

- 賽事卡片、今日判斷與詳情頁改為台灣時間。
- 依 `stadium_id` 對應場館時區，保留場館當地時間供對照。
- 已驗證首頁與單場詳情都能同時顯示台灣時間與場館時間。

### 2026-06-22 04:30 TST

- 確認主資料源 `worldcup26.ir` 會落後媒體/Google 結果；例：Spain 4-0 Saudi Arabia 已完賽但主 API 仍可能顯示未開始或舊資料。
- 前端 `data/hourly-stats.json` 合併能力已升級：可覆蓋比分、完賽狀態、進球者與技術數據。
- 手動加入 Spain 4-0 Saudi Arabia 快照，含控球率、射正、角球、黃牌、紅牌、犯規，讓線上頁面可先看到效果。
- 賽程頁新增「已完賽」篩選，作為過往比賽入口。
- UI 主色改為土金配色，手機比賽卡片縮小並避免超出畫面。
- 下一輪自動化重點：把 Sporting News 或 FOX Sports 單場頁解析器接進 `scripts/scrape-hourly-stats.mjs`，取代手動快照。

### 2026-06-22 11:15 TST

- 手動餵入今日已完賽結果快照：Belgium 0-0 Iran、New Zealand 1-3 Egypt、Uruguay 2-2 Cape Verde。
- New Zealand vs Egypt 與 Uruguay vs Cape Verde 已加入進球者；Belgium vs Iran 已加入 Nathan Ngoy 紅牌資訊。
- 沒有可靠 box score 的角球、黃牌等技術統計保持空白，不塞假資料。
- 單場詳情新增「最新快照」來源列，數據頁新增「最新快照覆蓋」完整度列，方便辨識哪些比賽由快照修正。
- 下一輪資料重點：解析 FOX Sports/ESPN box score 或可用 API，把今天三場的角球、黃牌、射正等技術統計補齊。

### 2026-06-22 12:30 TST

- `scripts/scrape-hourly-stats.mjs` 改為預設抓 ESPN public scoreboard/summary JSON，不再依賴手動 `STATS_SOURCE_URL`。
- 每小時 workflow 會抓 `20260611-20260719` 全世足日期範圍，將 ESPN event 對應回 `worldcup26.ir` 的 match id。
- 已自動匯入 35 場完賽/可用賽事資料，欄位包含比分、完賽狀態、進球者、控球率、射門、射正、角球、黃牌、紅牌、犯規、越位。
- 今日三場已補齊技術統計：Belgium 0-0 Iran、New Zealand 1-3 Egypt、Uruguay 2-2 Cape Verde。
- 下一輪資料重點：在前端增加 ESPN 資料源健康狀態與球隊頁牌數/角球彙總。

### 2026-06-22 12:35 TST

- 數據頁新增「技術數據源正常」健康卡，顯示 ESPN public JSON 來源、更新時間、快照場數與前端已合併場數。
- 若 `data/hourly-stats.json` 讀不到，健康卡會改顯示等待資料源，避免使用者誤以為技術數據完整。
- 下一輪重點：新增球隊頁或球隊彙總，統計各隊進球、失球、角球、黃牌、紅牌。

### 2026-06-22 13:05 TST

- 首頁「今日」區升級成可左右滑動的三欄：昨日戰績、今日、明日賽程，預設停在今日。
- 賽程頁改成依賽制分段顯示：小組賽、淘汰賽、八強、四強、季軍戰、冠軍戰。
- 賽程篩選也同步改成相同賽制分類，讓 bracket 階段更清楚。
- 本輪同步加上 CSS/JS 版本號，避免 GitHub Pages 或瀏覽器快取吃到舊前端。
- 下一輪重點：新增球隊頁或搜尋功能。

### 2026-06-22 14:20 TST

- 新增國家隊詳情：點賽事卡片、比賽詳情、排名表、球隊進球榜裡的國家隊名稱，都會打開該隊頁。
- 國家隊頁會顯示近五場 / 接下來賽程，包含勝和敗、進失球、角球、黃牌、紅牌摘要。
- 每場明細會用該隊視角呈現比分、進球者、角球、黃牌、紅牌、射正、控球率，並可回到完整單場比賽資料。
- 此功能只讀目前已匯入的賽程與 ESPN hourly-stats 快照；沒有真實來源的技術數據仍顯示為等待或空值，不塞假資料。
- 下一輪建議：補 PWA 安裝、國家隊搜尋入口、以及 ESPN 之外的備援資料源。

### 2026-06-23 10:05 TST

- 修正單場比賽與國家隊近五場的進球顯示：現在會保留 ESPN 快照中的進球分鐘，例如 `66'`、`90'+6'`。
- 射手榜仍使用去除分鐘後的球員名統計，避免同一球員不同分鐘被算成不同人。
- 手動重新產生 `data/hourly-stats.json`，快照更新到 38 場；France 3-1 的技術數據已補齊角球、紅黃牌、射正、控球率等欄位。
- France 3-1 資料源仍為 ESPN public summary JSON；沒有真實來源的欄位不手填。
- 下一輪建議：在比賽詳情加事件時間線，整合進球、紅黃牌與換人事件。
