# 小說正文插圖 Windows 測試版

這是基於 Mangayomi v0.9.9（上游 commit `34dea5fd450a4b4d7683a32bec31a9ba2f0b555d`）的非官方閱讀器修改，不是擴充套件更新。Windows 編譯版本號為 0.9.9+128。

## 修改內容

- 線上小說的 `<img>` 可以直接顯示在正文中，沿用 App 的圖片傳輸、來源標頭、正常 WebView 工作階段及圖片快取。
- 連續捲動依圖片比例顯示；單頁及雙頁模式讓每張插圖各佔一頁，縮放至頁面內，避免後半截被裁切。
- 支援相對圖片網址、載入指示、失敗後重試，以及原本的 EPUB 圖片。
- 保留章節名稱、章節順序與書庫資料格式；輕小說文庫套件的 WebView 查看連結仍可使用。

## 試用方式

1. 先在原本 Mangayomi 匯出備份，再關閉原本 App。
2. 把測試版 ZIP 解壓縮至新的資料夾，執行裡面的 `mangayomi.exe`。整個資料夾的 DLL 和 `data` 都需要保留。
3. 開啟輕小說文庫的插圖章節，先以連續捲動檢查，再試單頁或雙頁模式。
4. 此版本會沿用 Mangayomi 既有的使用者資料位置；另放程式資料夾不代表另建書庫。兩個版本請分開執行。

本次只修改閱讀顯示。一般小說「下載章節」仍主要保存 HTML，沒有新增完整插圖離線下載功能；曾瀏覽的圖片可以使用 App 既有快取，但不保證離線時全部可用。

## 重現編譯

```powershell
git clone --branch v0.9.9 https://github.com/kodjodevf/mangayomi.git
cd mangayomi
git apply C:/path/to/novel-inline-images.patch
flutter pub get --enforce-lockfile
flutter test --no-pub test/modules/novel_illustration_test.dart test/modules/novel_double_page_test.dart test/modules/novel_ref_after_dispose_test.dart
flutter build windows --release --no-pub --build-number=128
```

使用 Flutter 3.47.8、Dart 3.13.7 及 Windows C++ / Rust 編譯環境。GitHub Actions 的 `Build Windows novel illustration test app` 流程會從上游固定版本套用此補丁後測試和編譯，成果放在該次執行的 Artifacts。

測試包含實際 Flutter 圖片元件、EPUB 記憶體圖片、錯誤重試、圖片網址解析、17 張插圖的頁面順序及原本的小說分頁回歸。完整 App 的網站圖片顯示仍需在執行檔中確認。

上游原始碼及此修改均依 Mangayomi 的 MIT 授權使用。
