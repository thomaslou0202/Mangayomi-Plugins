# Anime1 動畫來源

版本：0.1.1。最低 Mangayomi 版本：0.9.9。來源類型：原生 JavaScript／動畫（`itemType: 1`）。

## 安裝

在 Mangayomi「更多 → 設定 → 瀏覽 → 動畫套件庫／來源儲存庫」新增：

```text
https://raw.githubusercontent.com/thomaslou0202/Mangayomi-Plugins/main/anime_index.json
```

到「瀏覽 → 動畫擴充套件」，重新整理，顯示中文（zh），安裝「Anime1（測試版）」。這是獨立的動畫清單；原本的 `novel_index.json` 繼續提供小說。

## 功能

- 從站方公開動畫表整理作品，每頁 20 部，沿用網站預設的更新順序。首頁與「最新」都是這份清單。
- 支援作品名、年份、季節及字幕組的全站搜尋，也接受清單中的 `https://anime1.me/?cat=分類ID` 網址。
- 來源設定可篩選首頁年份與季節；搜尋仍查詢全部作品。重新整理第一頁會抓取最新資料，其餘清單快取最長一分鐘。
- 每部動畫收集完整分類頁的所有集數，不只讀第一頁；修訂版本及特別篇保留各自的貼文。
- 依文章編號與標題辨識集數，標題沒有超連結時仍可收錄。一般讀取未辨識到集數時，會用內建 WebView 的 DOM 直接讀取集數資料，再繼續翻頁。
- 集數以半形連續序號開頭，例如 `0001｜０１`，其餘數字為全形，讓 App 排序與下一集辨識使用相同序號。測試時請顯示全部集數，讓 `0001` 在最前面。
- 網站動畫表沒有提供各作封面，來源使用站方共用圖示。

## 播放方式

選擇一集後，來源讀取該集頁面提供的播放請求，使用與站方播放器相同的播放介面取得原始影片。畫質選項標示「原始 MP4」或「原始 HLS」，不另行推測解析度。

播放介面會回傳暫時的 `e`、`p`、`h` 播放 Cookie。套件僅將這次回傳的三個欄位帶到站方 `v.anime1.me` 及其子網域的影片請求，不讀取 WebView Cookie、登入帳密或本機瀏覽器資料，也不另寫入套件偏好設定。報告及儲存庫沒有附上 Cookie 值或暫時影片網址。

影片連結或授權失效時，退出該集再開啟，讓來源重新取得播放資料。需要網站驗證時，在來源 WebView 手動完成後重試。

## 驗證與限制

0.1.1 更新後，到「動畫擴充套件」重新整理並更新 Anime1，回到作品詳細頁重新整理集數。來源 ID 相同，不需要移除書庫作品。

2026-10-24 的 0.1.1 驗證結果：

- 使用真正的 Dart `html 0.15.7` 與 `pseudom 1.0.1` 解析器，執行來源程式及公開網站的完整分類讀取：入間同學第四季 24 集／2 頁、葬送的芙莉蓮 28 集／2 頁、新作 3 集／1 頁，網址均無重複，序號由第 1 集至末集。
- 24 項來源測試，加上既有 32 項小說測試，合計 56 項通過。新增標題無連結、分類空白字元、原生解析為空時的跨頁 WebView 備援、備援失敗明確報錯測試。
- 原先使用一般 DOM 模型及真正 Dart 解析器，均沒有重現使用者的 `A1-EPISODES`；因此不能斷言是哪個網頁／執行環境差異造成。新版補強辨識及備援，仍需在原本出錯的裝置更新後確認。
- 0.1.0 曾驗證動畫清單前兩頁、搜尋，以及兩集影片前 2,048 位元組的 HTTP 206／MP4 標記；本次未修改播放流程，也未重測影片。舊報告保留於 [anime1-validation-0.1.0.json](anime1-validation-0.1.0.json)。
- 尚未在實際 Mangayomi 播放器或 Android 介面測試完整播放、切換下一集、投放及離線下載。上述網路與模型測試不能代替完整播放器實測。

詳細記錄見 [anime1-validation.json](anime1-validation.json)。

## 主要參考資料

2026-10-24 檢查的公開頁面與站方資源：

- [Anime1 首頁](https://anime1.me/)
- [站方動畫表](https://anime1.me/animelist.json)
- [首頁表格載入程式](https://sta.anicdn.com/homelist.min.js?ver=1103)
- [測試作品分類](https://anime1.me/?cat=1307)
- [測試新作分類](https://anime1.me/?cat=2003)
- [入間同學第四季分類](https://anime1.me/?cat=1851)
- [測試集數頁](https://anime1.me/30432)
- [站方播放器程式](https://sta.anicdn.com/videojs.bundle.js?ver=8)
- 播放介面：`POST https://v.anime1.me/api`，表單欄位沿用頁面提供的 `data-apireq`，不修改或重算簽章。

Mangayomi 0.9.9 的相容規則：

- [原生 HTTP 回應格式](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/eval/http_response_extensions.dart)
- [JavaScript HTTP Client](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/eval/javascript/http.dart)
- [動畫詳細資料的 episodes 欄位](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/eval/model/m_manga.dart)
- [影片網址與 headers 欄位](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/models/video.dart)
- [原生來源 itemType 讀取](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/models/source.dart)
- [原生 HTML 選擇器](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/utils/extensions/dom_extensions.dart)

本來源為原創程式碼，採根目錄 MIT 授權。沒有將動畫影片或站方播放器程式打包進套件庫。
