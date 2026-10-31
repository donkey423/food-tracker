# HANDOFF

## 接手須知
- 資料存在 localStorage，key `nl.v1`：`{entries[], favorites[], profile{sex,age,height,weight,bodyFat,activity,rate}, settings{apiKey, model, speed, lastBackup}}`
- entry：`{id, date, time, meal, name, servings, portion, perServing{kcal,protein,fat,carbs,fiber,sodium}, nutrients(=perServing×servings), source, confidence}`
- source：`photo-food` | `photo-label` | `manual` | `favorite`
- 匯出 JSON 不含 API Key
- Gemini 透過 `?key=` 直接從瀏覽器呼叫，`responseMimeType: application/json`；prompt 在 `core.js` 的 `PROMPT`
- 改了快取檔案清單或內容後，記得升 `sw.js` 的 `CACHE` 版本

## 驗證指令
```
node --test tests/*.mjs
python3 tests/e2e.py
python3 tests/e2e_retry.py
python3 tests/e2e_new.py
```

## 已知限制
- 食物照數值為估算，油和醬汁誤差大
- 免費額度用完回 429，介面會提示並改用手動輸入

## 部署與流程
- repo：`donkey423/food-tracker`，直接推 `main`（使用者偏好，不開分支）；Vercel 自動部署，網址 https://food-tracker-three-omega.vercel.app/
- git 作者：`Brad Lin <t7522462@gmail.com>`；commit 結尾附 Co-Authored-By 與 Claude-Session 行。
- 每次改動快取內容都要升 `sw.js` 的 `CACHE`（目前 v10）。
- **使用者說「把修改推上去」時，自動完成整套，不用再問**：①跑全部測試 ②更新 STATUS.md（版本、改動、測試結果、未驗證項）與 HANDOFF.md（資料格式變更、驗證指令、下一步）③若改到網頁檔案則升 `sw.js` 的 `CACHE` ④commit 並直接推 `main`。

## 下一步（建議順序）
0. 修 `e2e_new.py`「複製昨天的午餐」失敗：切換餐別分段後檢查快速區（`#qa`）是否以新餐別重繪；修好後在非午餐時段重跑確認不依賴時間。
1. 用已存食物比對辨識結果，並提供份量快選（提高拍照準確度）
2. 衛福部食品營養成分資料庫離線搜尋（先確認資料可否取得）
3. 備份提醒強化
4. 實機驗證：真實 Gemini 辨識準確度與 thinkingLevel 加速幅度、iPhone 加入主畫面／相機／分享匯出

## 資料格式更新（v0.7）
- localStorage `nl.v1` 新增 `weights: [{date:'YYYY-MM-DD', kg}]`（每日一筆）；`profile.tdeeOverride`（可選，採用實測消耗時存在）。
- 匯出 JSON version 3 含 weights；匯入依日期合併、不覆蓋既有。
- 驗證：`node --test tests/*.mjs`；`python3 tests/e2e.py`、`e2e_retry.py`、`e2e_new.py`。

## 編輯畫面行為（v0.9，資料格式不變）
- 編輯卡片的營養素欄位顯示「份數 × 每份」的合計；每份數值（真正的資料來源）放在 `fieldset.dataset.per`（JSON），`readCards()` 由它讀出 `perServing`。
- `app.js`：`showTotals(fs)` 依 `per` 與份數重算欄位（份數 ≤0 時不動）；`onCardInput(fs, f)` 處理輸入：改份數 → `showTotals`，改營養素 → 除以目前份數寫回 `per`。份數 ± 與快選鈕也會呼叫 `showTotals`。
- 改動編輯卡片時請維持「儲存的是每份、`nutrients` ＝ 每份 × 份數」；`tests/e2e.py` 手動新增段落是此行為的回歸測試。

## 資料格式更新（v0.8）
- localStorage `nl.v1` 新增 `incompleteDays: ['YYYY-MM-DD']`（使用者標記「沒記完整」的日期，已排序）。舊資料沒有此欄位時 `load()` 預設為空陣列。
- 匯出 JSON 含 `incompleteDays`；匯入與既有合併取聯集。
- 邏輯：`core.js` 的 `summarize(entries, dates, skip)` 與 `calibrateTDEE({..., skipDates})` 排除標記日；`toggleIncompleteDay` 為切換用純函式。

## Repo 公開（2026-10-31）
- 新增 MIT `LICENSE`，README 加英文摘要與線上版網址，repo 改為公開。
- 公開 repo 注意：不要把 API Key、個人飲食／體重資料或備份 JSON commit 進來；測試一律用合成資料。
