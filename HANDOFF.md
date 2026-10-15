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
```

## 已知限制
- 食物照數值為估算，油和醬汁誤差大
- 免費額度用完回 429，介面會提示並改用手動輸入

## 部署與流程
- repo：`donkey423/food-tracker`，直接推 `main`（使用者偏好，不開分支）；Vercel 自動部署，網址 https://food-tracker-three-omega.vercel.app/
- git 作者：`Brad Lin <t7522462@gmail.com>`；commit 結尾附 Co-Authored-By 與 Claude-Session 行。
- 每次改動快取內容都要升 `sw.js` 的 `CACHE`（目前 v8）。

## 下一步（建議順序）
1. 用已存食物比對辨識結果，並提供份量快選（提高拍照準確度）
2. 衛福部食品營養成分資料庫離線搜尋（先確認資料可否取得）
3. 備份提醒強化
4. 實機驗證：真實 Gemini 辨識準確度與 thinkingLevel 加速幅度、iPhone 加入主畫面／相機／分享匯出

## 資料格式更新（v0.7）
- localStorage `nl.v1` 新增 `weights: [{date:'YYYY-MM-DD', kg}]`（每日一筆）；`profile.tdeeOverride`（可選，採用實測消耗時存在）。
- 匯出 JSON version 3 含 weights；匯入依日期合併、不覆蓋既有。
- 驗證：`node --test tests/*.mjs`；`python3 tests/e2e.py`、`e2e_retry.py`、`e2e_new.py`。
