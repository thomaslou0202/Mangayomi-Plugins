# Mangayomi 中文小說套件庫

提供 Mangayomi 原生 JavaScript 小說來源，依照 [Mangayomi 套件庫](https://github.com/kodjodevf/mangayomi-extensions)的 `novel_index.json` 格式整理。

| 來源 | 版本 | 功能 |
| --- | --- | --- |
| 輕小說文庫8（測試版） | 0.3.4 | 熱門、最近更新、繁簡中文搜尋、分卷目錄、正文、繁體顯示切換、需要時自動登入 |
| 小說狂人（測試版） | 0.1.0 | 精選排行、分類與日／週／總排行、中文搜尋、目錄、正文 |

兩個來源皆沿用已測試的程式碼，最低版本設為 Mangayomi 0.9.9。

## 加入套件庫

在電腦與 Android 手機／平板，各自到 Mangayomi 的「更多 → 設定 → 瀏覽 → 小說套件庫／來源儲存庫」，新增以下網址：

```text
https://raw.githubusercontent.com/thomaslou0202/Mangayomi-Plugins/main/novel_index.json
```

再到「瀏覽 → 小說擴充套件」，重新整理，顯示中文（zh）來源後，安裝「輕小說文庫8（測試版）」與「小說狂人（測試版）」。

這個網址提供安裝與更新清單。首次安裝不需要開發者模式，也不需要貼上程式碼。使用 GitHub 原始檔網址即可，無須啟用 GitHub Pages，也不必讓這台電腦持續開機。

注意：要填的是上面的 `novel_index.json` 網址；GitHub 專案網址、`.git` 網址及 `repo.json` 都不是小說清單網址。

## 已有手動建立的來源

手動來源的 ID 由 App 根據名稱與語言產生，與本套件庫固定的 ID 不同；即使名稱一樣，也不會自動變成套件庫版本。安裝後可能看到兩個同名來源。

先保留原本的來源與書庫，從套件庫來源搜尋一本作品，確認目錄與閱讀正常。已有書庫作品若仍指向手動來源，需要透過 App 的來源遷移功能轉到新來源；如果不遷移，也可以繼續使用原本的手動來源，但本套件庫的更新不會套用到它。登入與來源偏好也可能需要在新來源重新設定。

## 來源設定與閱讀

### 輕小說文庫8

- 來源設定可切換「使用繁體中文」；搜尋會將繁體關鍵字轉為站方所需的簡體與 GBK 格式。
- 可填自己的文庫8帳號、密碼，開啟「需要時自動登入」，或直接在來源 WebView 手動登入。
- Mangayomi 0.9.9 的來源密碼欄位不遮罩，來源設定及備份不保證加密；不想保存密碼可以留空。

### 小說狂人

- 預設「精選排行／日排行」，來源設定可切換分類與日／週／總排行。
- 未提供「最新」頁籤，因為這個排行頁未提供相對應的最新排序。
- 登入與網站驗證請在來源 WebView 內自行完成。

### 章節順序

兩個來源皆使用全書連續編號，例如 `0001｜第一卷 · 序章`。章節清單選「按章節號」或「按名稱」，讓 `0001` 排在最前面。更新來源後，重新整理作品目錄，再離開並重開閱讀畫面。

首次測試閱讀器「下一章／上一章」時，讓章節篩選顯示全部。App 會將未讀、已下載等篩選套用到閱讀器，排除目前章節時可能回退到資料庫原有排列。

## 維護與發佈

本機位置：`D:\Mangayomi\plugins`。來源放在：

```text
javascript/novel/src/zh/wenku8.js
javascript/novel/src/zh/czbooks.js
```

需要 Node.js 22 或更新版本，無額外 npm 套件，不需要執行 `npm install`。

1. 修改來源，並增加該檔案 `mangayomiSources` 中的 `version`；保留原本的 `id`。
2. 在儲存庫資料夾執行 `npm run build`，重新產生 `novel_index.json`、`repo.json` 與 `checksums.json`。
3. 執行 `npm run check`，確認來源語法、ID、版本、檔案路徑、下載網址及產出檔案一致。
4. 將修改與產生的檔案一起提交、推送至 `main`。
5. 執行 `npm run verify:published`，確認公開索引與兩個來源實際可下載，且雜湊與本機一致。
6. 在 Mangayomi 重新整理擴充套件清單，安裝可用更新；GitHub 原始檔快取可能延遲反映新版本。

GitHub Actions 會在推送與 Pull Request 執行 `npm run check`。它只檢查檔案，不自動改寫或提交索引。`checksums.json` 供維護工具核對檔案，Mangayomi 本身並不使用這個檔案驗證安裝。

更換 GitHub 帳號、儲存庫名稱或分支時，修改 `repo.config.json` 後重新產生索引，並更新本說明中的套件庫網址。

## 驗證範圍

- 來源沿用文庫8 0.3.4、小說狂人 0.1.0；本次套件庫整理沒有改動閱讀邏輯。
- 來源先前已經過本機測試、Windows Mangayomi 0.9.9+127 內建取頁及章節辨識／切章規則模型驗證。
- 小說狂人已檢查 150 章與 2,562 章目錄，以及前兩章不同正文。
- Android 介面、實際閱讀器切章與離線下載仍待實機確認；套件庫檢查不會登入網站或批次下載小說。

## 格式參考與授權

- [上游小說索引](https://github.com/kodjodevf/mangayomi-extensions/blob/main/novel_index.json)
- [上游來源模型](https://github.com/kodjodevf/mangayomi-extensions/blob/main/model/source.dart)
- [Mangayomi 0.9.9 索引讀取](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/services/extension_store_service.dart)
- [Mangayomi 0.9.9 手動來源 ID 規則](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/modules/browse/extension/widgets/create_extension.dart)

原創程式碼及文件採用 MIT 授權，見 [LICENSE.txt](LICENSE.txt)。文庫8內含的 OpenCC 搜尋轉換字典採用 Apache-2.0，來源與修改說明見 [OPENCC-LICENSE.txt](OPENCC-LICENSE.txt)。各套件的參考資料保存在 [docs](docs/)。
