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

## 下一步（本機 Claude Code 接手）
1. 建 repo 並推送：`gh repo create donkey423/food-log --private --source . --push`
2. Vercel 連 repo（Framework: Other，無 build command，Output 為根目錄），之後 push 自動部署
3. iPhone Safari 開部署網址 →「加入主畫面」→ 設定填 Gemini API Key
4. 拍一張營養標示，驗證真實 Gemini 呼叫（CORS、模型名稱）；結果回填 STATUS.md
