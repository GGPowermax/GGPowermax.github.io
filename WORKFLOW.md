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

1. 選定固定網站，完成角球、黃牌、紅牌解析器。優先測 Sporting News、FOX Sports、AS、Sofascore HTML；不要爬 Google 搜尋結果本身。
2. 將固定網站解析結果寫入 `data/hourly-stats.json`，覆蓋比分、完賽狀態、進球者、角球、紅黃牌、射正、控球率等欄位。
3. 將賽事時間切換為台灣時間，並標示原始當地時間。
4. 新增球隊頁：隊伍賽程、進球、失球、牌數。
5. 新增資料完整度指標：比分、進球、技術統計、陣容。
6. 加 PWA：手機桌面圖示、離線快取、更新提示。
7. 加搜尋與快速篩選球隊。

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
