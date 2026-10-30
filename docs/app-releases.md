# App 正式版與版本管理

正式下載：[GitHub Releases 最新版](https://github.com/thomaslou0202/Mangayomi-Plugins/releases/latest)。

- [Windows ZIP](https://github.com/thomaslou0202/Mangayomi-Plugins/releases/latest/download/Mangayomi-windows.zip)
- [Android 手機／平板 APK](https://github.com/thomaslou0202/Mangayomi-Plugins/releases/latest/download/Mangayomi-android.apk)
- [完整 App 原始碼](https://github.com/thomaslou0202/Mangayomi-Plugins/tree/app-source)
- [建置、測試與發布記錄](https://github.com/thomaslou0202/Mangayomi-Plugins/actions/workflows/app-release.yml)

從 **0.9.10+132** 起，App 的啟動更新檢查與「更多 → 關於 → 檢查更新」都使用本倉庫的正式 Releases。舊版仍使用官方更新來源，需要先手動更新一次。Windows 的更新按鈕會開啟本倉庫下載頁；Android 會下載 APK，交由系統確認安裝。

## 本機固定位置

| 用途 | 位置 |
| --- | --- |
| Windows 程式 | `D:\Mangayomi\Windows\mangayomi.exe` |
| Android 安裝檔 | `D:\Mangayomi\Android\Mangayomi.apk` |
| App 原始碼工作目錄 | `D:\Mangayomi\app-source` |
| 套件庫及發布流程 | `D:\Mangayomi\plugins` |
| 同步伺服器 | `D:\Mangayomi\sync` |
| 私有備份 | `D:\Mangayomi\Backup` |

原先各個 `illustrations-*`、`android-*` 版本資料夾與重複的 downloads 安裝檔已整理。128～131 版的 Windows／Android 安裝檔保留在各自的 GitHub Release，需要回退時可重新下載。

程式資料夾與書庫分開。整理不移動或清除既有書庫與同步伺服器資料，也不把私人備份、帳號或簽章私鑰放入公開 Git。

## 發布下一版

1. 在 `app-source` 分支修改 App，將 `pubspec.yaml` 的版號與修訂號遞增，例如 `0.9.10+133`。每次正式版都使用更大的修訂號，Android 才能直接覆蓋更新。
2. 提交並推送 App 原始碼到本倉庫的 `app-source` 分支，記下完整 commit。
3. 在 `main` 更新 `app-release.json` 的 `source`、`version`、`build`、`tag`，並更新 `release-support/RELEASE-NOTES.md`。tag 使用 `v0.9.10+133` 這樣的格式。
4. 推送 `main`，`Release custom Mangayomi` 會自動執行。也可從 Actions 頁面手動啟動同一流程。
5. 兩平台通過分析、測試、建置，Android 完成簽章及手機／平板／背景同步測試後，才會公開正式 Release 並標記為 Latest。中途失敗不會推出半套的更新。

Release 的 tag 指向實際建置的 App commit，所以頁面的 Source code archive 是完整 App 原始碼。每版同時保留 Windows ZIP、Android APK、授權、安裝說明與 SHA256 校驗碼。已公開的安裝檔不覆寫；修正時發布新的修訂號。

Android 沿用 `com.kodjodevf.mangayomi.illustrations` 與既有簽章，直接更新舊插圖／效能版。簽章只從既有 GitHub Actions Secrets 讀取，流程會比對公開憑證，確認沒有誤用其他簽章。

版本比較包含修訂號，能辨識 `0.9.10+132 → 0.9.10+133`，會略過草稿、測試版與未完成的安裝檔。APK 在 App 內下載時也使用含修訂號的檔名，避免重用舊版快取。
