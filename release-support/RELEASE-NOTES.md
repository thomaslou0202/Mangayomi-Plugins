# Mangayomi 繁體中文插圖版 0.9.10+132

第一個正式版，適用 Windows 與 Android 手機／平板。

- 程式內「檢查更新」改接 thomaslou0202/Mangayomi-Plugins 的正式 GitHub Releases。
- 支援同版號的修訂更新，例如 0.9.10+132 → 0.9.10+133，略過測試版與草稿。
- 「關於」顯示完整正式版號與修訂號，GitHub 按鈕改連本倉庫。
- 保留小說正文插圖、繁體中文、漫畫來源白畫面修正、書庫效能與背景同步。

## 安裝與更新

Windows：下載 `Mangayomi-windows.zip`，先關閉程式，解壓到固定的程式資料夾後啟動 `mangayomi.exe`。本機已整理為 `D:\Mangayomi\Windows`。書庫與設定沿用既有資料位置。

Android：下載 `Mangayomi-android.apk`，直接覆蓋更新先前插圖／效能修改版。維持相同套件名稱與簽章，無須移除舊版。最低 Android 7.0，手機與平板使用同一個 APK。本機安裝檔固定為 `D:\Mangayomi\Android\Mangayomi.apk`。

**第一次請手動安裝這一版**，舊版仍向官方倉庫查詢更新。往後從「更多 → 關於 → 檢查更新」即可收到本倉庫的新正式版本。Windows 更新會開啟本倉庫的下載頁；Android 可下載 APK 並由系統確認安裝。

## 版本與原始碼

完整 App 原始碼位於本倉庫的 `app-source` 分支；Release tag 指向實際建置的原始碼 commit。每版可從 Release 頁取得原始碼、Windows ZIP、Android APK 及 SHA256 校驗碼。

`main/app-release.json` 固定建置版本與原始碼 commit。GitHub Actions 先完成兩平台測試與建置，再發布正式 Release。Android 延用原簽章，簽章私鑰不放入 Git。

上游專案為 kodjodevf/mangayomi；保留其授權與著作權聲明。
