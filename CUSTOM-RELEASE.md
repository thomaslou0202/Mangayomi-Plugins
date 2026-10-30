# Mangayomi 繁體中文插圖版

本分支是 thomaslou0202 維護的完整 App 原始碼，保留上游 Mangayomi 的授權與來源基準。從此正式版起完整原始碼直接納入 Git；先前修改仍可從各測試版 Release 與 patch 分支取得。

上游基準：`kodjodevf/mangayomi` 的 `34dea5fd450a4b4d7683a32bec31a9ba2f0b555d`；本版匯入前的本機修改 commit：`8871958412c769e620598c1af5c2d27cc6f629a8`。

- 正式下載：https://github.com/thomaslou0202/Mangayomi-Plugins/releases/latest
- Windows、Android 正式版由同一儲存庫 **main** 分支的 `Release custom Mangayomi` 工作流程建置、測試、簽章及發布。
- `main/app-release.json` 固定完整原始碼 commit 與版本；兩平台成功後才公開正式 Release。Release tag 指向此完整原始碼，GitHub 自動提供該版 source archive。
- 版號 `0.9.10+132` 包含修訂號。App 的「檢查更新」只讀取本儲存庫的正式 Release，會辨識同版號的修訂更新，忽略草稿與測試版。
- Android 維持 `com.kodjodevf.mangayomi.illustrations` 與原簽章，可覆蓋更新先前插圖／效能版。
- Windows 本機固定使用 `D:\Mangayomi\Windows`；APK 固定使用 `D:\Mangayomi\Android\Mangayomi.apk`。書庫不放在程式安裝目錄。

保留小說正文插圖、繁體中文、漫畫來源舊資料相容、書庫效能及背景同步修改。
