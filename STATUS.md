# STATUS

更新：2026-10-15

## 已完成（v0.1）
- 拍照／相簿 → Gemini 辨識（食物、營養標示）→ 確認編輯 → 儲存
- 手動輸入、常用與最近食物
- 今日統計、餐別分組、三大營養素比例
- 分析頁（每日熱量圖、平均、主要來源）
- JSON 備份／還原、CSV 匯出、7 天未備份提醒
- PWA（manifest、service worker、圖示）
- 測試：單元 15 項通過；E2E（模擬 Gemini）通過

## 部署
- 正式網址：https://food-tracker-three-omega.vercel.app/（Vercel，push 到 main 自動部署）
- 已驗證（2026-10-15）：頁面、manifest、圖示正常，Service Worker 已啟用，無 console 錯誤；瀏覽器可直接呼叫 Gemini API（無 CORS 問題）

## 實機驗證（2026-10-15）
- iPhone 已安裝並填入 Key；首次辨識收到 Gemini 503（高負載）→ 已加：5xx 重試一次、切換備用模型（flash-lite、2.5-flash）、「重試辨識」按鈕

## 尚未驗證
- 真實辨識成功的結果與準確度（待 503 恢復後重拍）
- iPhone 實機：加入主畫面、相機、分享選單匯出

## 下一步候選
- 編輯既有紀錄（目前只能刪除後重加）
- 衛福部食品營養成分資料庫離線搜尋
