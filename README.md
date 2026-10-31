# 營養記錄（food-log）

拍照或拍營養標示，記錄並分析食物的營養組成。純前端 PWA，資料只存在手機本機。

- 線上版：https://food-tracker-three-omega.vercel.app/
- 授權：MIT（見 `LICENSE`）

> **English summary** — A dependency-free, static PWA that turns photos of meals or nutrition labels into structured nutrition logs using the Gemini vision API (bring your own free API key). All data stays in the browser's local storage; there is no backend. Includes daily/7/14/30-day analysis, BMR/TDEE and calorie-deficit estimates, weight-based expenditure calibration, JSON backup and CSV export. Unit tests run with `node --test tests/*.mjs`; end-to-end tests use Playwright with a mocked Gemini API. The repo is maintained with AI coding agents under a closed-loop workflow documented in `CLAUDE.md`, `STATUS.md` and `HANDOFF.md`.

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

## 維護方式
- 以 AI coding agent 協作開發：每次改動小範圍、測試實際跑過才推送。
- `STATUS.md`：版本、改動、測試結果與未驗證項；`HANDOFF.md`：資料格式、驗證指令、下一步，讓下一個 session／代理人可直接接手。
- 歡迎開 issue 回報問題或建議。

## 授權
MIT License © 2026 Brad Lin
