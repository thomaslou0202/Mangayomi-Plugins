# Mangayomi 繁體中文插圖版 0.9.9+129

提供 Windows 與 Android 版本，保留 128 版的小說正文插圖功能。

- 新增 `zh_TW`，涵蓋目前英文範本的全部 1,085 個字串。
- 補齊原中文缺漏的 47 個項目，並將備份、下載、驗證、字幕資訊及電視介面等 38 個原本寫死的提示改為可翻譯字串。
- 校訂台灣用語，例如書庫、套件庫、設定、還原、快取、捲動及中繼資料。
- 首次啟動沒有語言偏好時預設為繁體中文。既存語言選擇會保留，可在「更多 → 設定 → 外觀 → 介面語言」改選「繁體中文（台灣）」。英文路徑：More → Settings → Appearance → App language。
- 保留簡體中文與其他既有語言，可隨時切換。
- 不變更資料庫結構或書庫內容。網站提供的作品名稱、正文及擴充套件自訂文字仍採用其原文。

## 安裝

Android：安裝 `Mangayomi-0.9.9-zh-TW-android.apk`。與已發布的插圖版使用相同套件 ID 與簽章，可直接更新。完整說明見 [ANDROID.md](ANDROID.md)。

Windows：解壓縮 `Mangayomi-0.9.9-zh-TW-windows.zip` 到獨立資料夾，關閉原本的 Mangayomi，再執行新版 `mangayomi.exe`。程式會使用原本的 Mangayomi 資料目錄；建議更新前先匯出目前書庫備份。

## 原始碼與驗證

上游固定版本：`34dea5fd450a4b4d7683a32bec31a9ba2f0b555d`。依序套用 `novel-inline-images.patch`、Android 版另加 `android-illustrations.patch`，最後套用 `traditional-chinese.patch`。

`test/l10n/traditional_chinese_test.dart` 檢查字串與變數完整性、繁簡語言區分、數量及錯誤參數、手機與平板尺寸的語言切換。建置同時執行既有閱讀器測試。原中文翻譯及上游程式採 Apache-2.0 授權；本版翻譯以原中文內容為基礎，轉換並校訂台灣用語。
