# HANDOFF

## 接手須知
- 資料存在 localStorage，key `nl.v1`：`{entries[], favorites[], settings{apiKey, model, lastBackup}}`
- entry：`{id, date, time, meal, name, servings, portion, perServing{kcal,protein,fat,carbs,fiber,sodium}, nutrients(=perServing×servings), source, confidence}`
- source：`photo-food` | `photo-label` | `manual` | `favorite`
- 匯出 JSON 不含 API Key
- Gemini 透過 `?key=` 直接從瀏覽器呼叫，`responseMimeType: application/json`；prompt 在 `core.js` 的 `PROMPT`
- 改了快取檔案清單或內容後，記得升 `sw.js` 的 `CACHE` 版本

## 驗證指令
```
node --test tests/*.mjs
python3 tests/e2e.py
```

## 已知限制
- 食物照數值為估算，油和醬汁誤差大
- 免費額度用完回 429，介面會提示並改用手動輸入
