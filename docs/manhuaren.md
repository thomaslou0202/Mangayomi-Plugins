# 漫畫人來源

版本：0.1.1。最低 Mangayomi 版本：0.9.9。原生 JavaScript 漫畫來源（`itemType: 0`、`isManga: true`）。

## 安裝

在「更多 → 設定 → 瀏覽 → 漫畫套件庫／來源儲存庫」加入：

```text
https://raw.githubusercontent.com/thomaslou0202/Mangayomi-Plugins/main/index.json
```

到「瀏覽 → 漫畫擴充套件」，重新整理並顯示中文（zh），安裝「漫畫人（測試版）」。這份清單與小說、動畫分開，電腦和 Android 裝置各自加入一次。

從 0.1.0 更新至 0.1.1 後，完全結束再重開 Mangayomi，然後重新進入章節。閱讀器會快取來源的全域圖片設定，需要重新載入才能套用這次修正。

## 功能與使用方式

- 熱門與最近更新採站方排序，每頁 21 部，支援翻頁。
- 搜尋採站方網頁的搜尋介面，每頁 10 部；支援 UTF-8 中文，包括繁體輸入，結果沿用站方的模糊比對，可能含相關而非完全同名的作品。
- 取得作品名稱、封面、作者、簡介、分類、連載狀態及網頁中的所有章節群組，包含 CSS 隱藏的章節；同一章節網址只保留一次。
- 章節名稱使用連續編號，例如 `0001｜第１话`；其餘數字改為全形，讓按名稱、章節號與閱讀器下一章使用相同的序號。初次閱讀請顯示全部章節，讓 `0001` 排在最前面。
- 圖片由正常閱讀頁的 `newImgs` 清單取得；大型合併章節的多位數 base-62 字典亦可解讀。程式只解碼字串表與網址陣列，不執行抓取到的 JavaScript。
- 每張圖片使用 Mangayomi 原生 `PageUrl` 物件，附上所屬章節的 `Referer`。全域來源設定不回傳首頁 `Referer`，讓閱讀器合併設定後仍保留該圖片的章節網址；不依賴來源執行個體的暫存狀態。
- 遇到網頁驗證或動態讀取，透過 Mangayomi 的正常 WebView 載入；需要驗證時請自行完成後重試。

## 網站範圍與限制

漫畫人的根首頁目前是 App 下載頁；來源使用仍公開的漫畫排行、搜尋、作品與章節網頁。來源 WebView 若停在下載頁，可從作品詳細頁或章節入口開啟對應網頁。

這個來源使用網頁提供的內容，沒有使用或模擬官方 App 的私有 API、簽章、會員憑證或購買流程。需要登入、付費或限定官方 App 的章節不保證能讀取；沒有圖片清單時會明確提示。沒有帳密輸入或自動購買功能。

站方實際回傳的目錄可能因快取、裝置或登入狀態而不同；來源保留這次網頁提供的章節，不推測未提供的章節網址。章節圖片網址帶有站方參數，失效時請退出章節，重新取得頁面；必要時清除該章的頁面快取再開啟。

## 驗證

2026-10-24 的 0.1.1 驗證：

- 已重現 0.1.0 的失敗原因：`PageUrl.headers` 先合併，全域來源設定後合併；因此全域的首頁 `Referer` 覆蓋了完整章節網址。舊版合併結果對《FX战士久留美》第 1 話圖片回傳 HTTP 403。
- 0.1.1 的全域設定不再提供首頁 `Referer`；實際用同一套閱讀器合併順序，章節網址保留，圖片 GET 回傳 HTTP 200。另確認下載器相反的合併順序仍保留正確章節網址。
- 使用真正的 Dart HTML／pseudom 解析器、Dart IOClient，以及完整圖片解碼，測試《FX战士久留美》第 1、2、54 話、《大狗狗》第 1 話，以及《落魄的哥哥其实是最强的》第 43–51 話合併章節。五章的首尾圖片共 10 張，全部完整讀取並以 Pillow 解碼成功，包含 449 頁章節的首尾圖片。圖片只在記憶體中處理，沒有保存圖片檔或暫時網址。
- 17 項漫畫人測試，加上既有 59 項來源測試，共 76 項通過。新增與實際閱讀器一致的全域／單頁設定合併測試，並核對獨立來源執行個體、章節快取可用的資料結構及下載器合併結果。

0.1.0 曾測試熱門與最近更新清單、搜尋翻頁、繁體搜尋、8／100 章目錄及 24／25／52／449 頁圖片清單。當時的圖片請求測試只使用單頁設定，沒有涵蓋閱讀器後續的全域設定合併，因此未發現這次的 403。舊報告保留於 [manhuaren-validation-0.1.0.json](manhuaren-validation-0.1.0.json)。

尚未直接操作實際 Mangayomi 閱讀器或 Android 介面測試安裝、整章翻頁、下載及離線閱讀；目前已驗證相同的請求設定合併流程、網路請求與完整圖片資料解碼。

完整記錄見 [manhuaren-validation.json](manhuaren-validation.json)。

## 主要參考資料

- [漫畫人首頁](https://www.manhuaren.com/)
- [熱門漫畫網頁](https://www.manhuaren.com/manhua-list/)
- [最近更新網頁](https://www.manhuaren.com/manhua-list-s2/)
- [搜尋頁](https://www.manhuaren.com/search/)
- [大狗狗作品頁](https://www.manhuaren.com/manhua-dagougou/)
- [測試章節頁](https://www.manhuaren.com/m588503/)
- [大型合併章節頁](https://www.manhuaren.com/m1840816/)
- 站方公開頁面載入的 `mobile/loadNewList.js`、`mobile/loadSearch.js`、`mobile/showcomic.js`，以及章節頁內嵌的圖片字串表；未將站方腳本打包進來源。
- 網頁清單處理器：`POST /manhua-list/dm5.ashx`（`getclasscomics`）；搜尋處理器：`POST /pagerdata.ashx`（`t=7`）。參數沿用網頁提供的值。
- [Mangayomi JavaScript 來源服務與 PageUrl 輸入](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/eval/javascript/service.dart)
- [原生 PageUrl 的 url、headers 欄位](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/models/page.dart)
- [章節圖片清單與快取](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/services/get_chapter_pages.dart)
- [閱讀器合併單頁與全域來源設定的順序](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/utils/extensions/others.dart)
- [來源更新時重新保存全域設定](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/services/fetch_sources_list.dart)
- [全域來源設定快取](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/utils/headers.dart)

本來源為原創程式碼，採根目錄 MIT 授權。
