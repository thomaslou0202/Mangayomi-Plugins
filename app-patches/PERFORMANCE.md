# 書庫效能與背景同步測試版 130

保留繁體中文介面與小說正文插圖。與前一版使用相同 Android 套件名稱及簽章，可直接更新。

- 書庫統計由獨立資料庫執行緒集中計算，未讀、書籤、下載數與排序共用結果。
- 同步資料收集、套用與 JSON 處理移到背景；離開設定頁仍會繼續。
- 同步採短批次寫入；同步期間新增的閱讀進度與刪除紀錄留待下次上傳。
- Android 同步時啟動 dataSync 前景服務及 CPU 喚醒鎖，切換 App、關閉螢幕後仍可進行；完成／失敗會結束服務。請允許通知以便查看同步狀態。
- 不會在強制停止、重開機後自行恢復未完成工作。手機廠商的極端省電設定仍可能終止背景 App。

開啟既有作品時改用非同步章節數查詢，不再先同步載入整本章節。
測試涵蓋 65,000 章／1,473 本的真實 Isar 資料庫、UI 計時事件、同步重播與並行刪除保護，以及 Android 模擬器中的背景服務與關閉螢幕。

設計參考 Mihon 的 LibraryUpdateWorker（CoroutineWorker、IO 工作與 foreground）及 LibraryManga 集中章節統計，使用 Mangayomi 的 Flutter isolate／Isar 實作，未直接移植 Kotlin 工作程式。
來源：https://github.com/mihonapp/mihon/blob/e588e04359fe1058206a2cbac1b01018ad787359/app/src/main/java/eu/kanade/tachiyomi/data/library/LibraryUpdateWorker.kt

上游 Mangayomi：kodjodevf/mangayomi，v0.9.9／34dea5f。完整變更位於 performance.patch，依序在插圖、Android 打包（Android 平台）、繁體中文修補之後套用。
