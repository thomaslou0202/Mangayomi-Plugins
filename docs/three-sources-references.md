# 新增來源參考資料

檢查日期：2026-10-23。只取用正常網頁顯示的公開內容。網站 HTML 與小說正文未隨套件庫分發。

## SF輕小說

- 使用者指定首頁：https://sfacg.com/
- 小說區：https://book.sfacg.com/
- 可翻頁書庫：https://book.sfacg.com/List/default.aspx?PageIndex=1
- 分類頁面程式：https://rs.sfacg.com/web/novel/js/v1/list_1.0.4.js
- 頁面搜尋導向：https://rs.sfacg.com/web/novel/js/v2/common-1.0.18.js
- 搜尋：https://s.sfacg.com/?Key=%E4%BB%99%E5%AD%90&S=1&SS=0
- 作品：https://book.sfacg.com/Novel/782957/
- 完整目錄：https://book.sfacg.com/Novel/782957/MainIndex/
- 免費章節：https://book.sfacg.com/Novel/782957/1040606/9887551/

目錄的 `.story-catalog` 分卷容器同時提供一般 `/Novel/...` 章節與 `/vip/c/...` 付費章節連結。本版只讀免費正文，VIP 保留標示並回傳明確提示，不取得購買資料或提交購買請求。

搜尋繁轉簡採用與文庫8相同的 OpenCC 字典；固定版本資訊在 `data/opencc/provenance.json`，字典授權與修改說明在根目錄 `OPENCC-LICENSE.txt`。

## 無限小說8book

- 使用者指定首頁：https://www.8book.com/index.html
- 排行：https://www.8book.com/booklists/rank/1.html
- 日輕小說：https://www.8book.com/booklists/9/1.html
- 更新：https://www.8book.com/booklists/update/1.html
- 搜尋：https://www.8book.com/search/?key=%E4%B8%8D%E7%A7%91%E5%AD%B8%E7%A6%A6%E7%8D%B8
- 搜尋翻頁：https://www.8book.com/search/?key=%E4%BB%99&page=2
- 作品及目錄：https://www.8book.com/novelbooks/151268/
- 多卷作品：https://www.8book.com/novelbooks/121051/
- 網站的閱讀入口：https://www.8book.com/read/151268/?17120824
- 該入口與目錄連結使用的閱讀網域：https://sport.thepaperbooks.com/read/151268/?17120824
- 多卷作品目錄連結使用的另一閱讀網域：https://finance.binaccount.com/read/121051/?334229

書籍與章節身份統一為 `www.8book.com` 網址。來源從該作品目錄的對應章節連結記錄閱讀網域；開章仍使用 8book 的入口，只接受已確認的章節網域轉址。正文由網頁本身載入後，從 `#text` 取得。套件不直接呼叫或內嵌站方腳本中的回報、廣告或第三方訊息介面。

## 石頭小說

- 使用者指定書庫：https://www.twbook.cc/bookstack/
- 頁面搜尋導向：https://i1.twbook.cc/js/main.min.js?v=14
- 搜尋：https://www.twbook.cc/search/%E5%8C%97%E5%86%A5%E6%9C%89%E9%AD%9A
- 作品：https://www.twbook.cc/1102607969/
- 完整目錄：https://www.twbook.cc/1102607969/dir
- 章節：https://www.twbook.cc/1102607969/1.html
- 閱讀樣式：https://i1.twbook.cc/min/read.38.css
- 公開顯示字型：https://i1.twbook.cc/fonts/f24092.woff2

完整目錄採用 `.chaplist .all`，不混入最近更新的另一份清單。字型對照表的來源、版本雜湊與辨識方式記錄在 `data/twbook-font-provenance.json`；未分發字型檔。

## Mangayomi 相容規則

- [0.9.9 JavaScript 取頁介面](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/eval/javascript/utils.dart)
- [0.9.9 章節辨識](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/utils/chapter_recognition.dart)
- [0.9.9 章節清單更新與去重](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/modules/manga/detail/providers/update_manga_detail_providers.dart)
- [0.9.9 閱讀器獨立排序](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/utils/extensions/manga_extensions.dart)
- [0.9.9 小說閱讀畫面](https://github.com/kodjodevf/mangayomi/blob/v0.9.9/lib/modules/novel/novel_reader_view.dart)

`tests/helpers/app-chapter-identity.cjs` 是根據上述 App 規則撰寫的獨立模型，供驗證來源章節不會因重複編號消失，以及閱讀順序與完整目錄一致。模型測試不等同於在 Android 或 Windows 閱讀器介面實際點擊上一章、下一章。
