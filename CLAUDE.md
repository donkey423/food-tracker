# 營養記錄（food-tracker）

靜態 PWA（無 build）：`index.html`、`app.js`、`core.js`（純函式，有單元測試）、`sw.js`。資料存手機 localStorage `nl.v1`。細節見 `HANDOFF.md`、`STATUS.md`。

## 語言與風格
- 所有輸出（回覆、頁面、文件）一律繁體中文（台灣用語）。
- 先講結論與首選建議，再講理由與風險；區分事實／推論／未知；最多問一個關鍵問題。

## 流程
- repo：`donkey423/food-tracker`，直接推 `main`（不開分支，除非使用者要求）；Vercel 自動部署。
- git 作者 `Brad Lin <t7522462@gmail.com>`。小範圍改動，測試必須實際跑過。
- **使用者說「把修改推上去」時自動完成整套，不用再問**：
  1. 跑全部測試：`node --test tests/*.mjs`、`python3 tests/e2e.py`、`tests/e2e_retry.py`、`tests/e2e_new.py`
  2. 更新 `STATUS.md`（版本、改動、測試結果、未驗證項）與 `HANDOFF.md`（資料格式變更、驗證指令、下一步）
  3. 改到網頁檔案就升 `sw.js` 的 `CACHE` 版本
  4. commit 並推 `main`
