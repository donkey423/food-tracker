# 營養記錄（food-log）

拍照或拍營養標示，記錄並分析食物的營養組成。純前端 PWA，資料只存在手機本機。

## 功能
- 拍照辨識：食物照（估算＋可信度＋熱量範圍）、營養標示（每份數值＋每包份數）
- 手動輸入、常用（★）與最近食物一鍵帶入
- 今日：熱量、蛋白質、脂肪、碳水、纖維、鈉合計，三大營養素熱量比例，依餐別分組
- 分析：7／14／30 天每日熱量圖、每日平均、各營養素主要來源
- 熱量與三大營養素換算檢查（差距 >20% 提示）
- 備份／還原 JSON、匯出 CSV（iPhone 會開分享選單，可存到「檔案」）

## 使用
1. 部署到任一 HTTPS 靜態主機（GitHub Pages、Vercel 等），iPhone Safari 開啟後「加入主畫面」。
2. 到 Google AI Studio 申請免費 Gemini API Key，填入「設定」。
3. 預設模型 `gemini-flash-latest`，若 Google 更名，可在設定直接修改。

## 開發
- 無建置步驟，直接用靜態伺服器開啟：`python3 -m http.server`
- 單元測試：`node --test tests/*.mjs`
- 端到端測試（需 Python Playwright）：`python3 tests/e2e.py`

## 檔案
- `core.js`：純函式（營養計算、AI 回應解析、統計、CSV），有單元測試
- `app.js`：介面與 Gemini 呼叫
- `sw.js`：離線快取（網路優先），改版時更新 `CACHE` 版本字串
