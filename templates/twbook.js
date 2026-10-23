/* TWBook native novel source. Original code and display-glyph mapping: MIT. */
const mangayomiSources = [{
    name: "石頭小說（測試版）", id: 1827634455, lang: "zh", baseUrl: "https://www.twbook.cc", apiUrl: "",
    iconUrl: "https://www.twbook.cc/favicon.ico", typeSource: "single", itemType: 2, isManga: false,
    sourceCodeLanguage: 1, version: "0.1.0", appMinVerReq: "0.9.9", pkgPath: "novel/src/zh/twbook.js",
    hasCloudflare: true, isNsfw: false, notes: "支援書庫、分類、搜尋、完整目錄、正文與網站特殊字型文字還原。網站驗證請在來源 WebView 手動完成。"
}];
const N_SITE = {name: "石頭小說", code: "TW", base: "https://www.twbook.cc", hosts: ["www.twbook.cc", "twbook.cc"], images: ["www.twbook.cc", "twbook.cc", "i1.twbook.cc"]};
const TW_FONT_FILE = "f24092.woff2";
const TW_FONT_HASH = "4287ef986834d02762283c9265285cd7aa29b90c1dc1e7671d959359786c7db2";
const TW_FONT_MAP = /*__FONT_MAP__*/;
/*__COMMON__*/
const TW_GENRES = [["", "全部"], ["24", "輕小說"], ["1", "言情"], ["2", "歷史"], ["3", "其他"], ["4", "都市"], ["5", "玄幻"], ["6", "體育"], ["8", "穿越"], ["10", "科幻"], ["13", "校園"], ["18", "軍事"], ["19", "懸疑"], ["25", "遊戲"], ["42", "女頻"], ["43", "同人"]];
function twBook(base, value) { const url = nAbsolute(base, value); const match = /^https:\/\/(?:www\.)?twbook\.cc\/(\d{6,12})\/?(?:[?#].*)?$/i.exec(url); return match ? N_SITE.base + "/" + match[1] + "/" : ""; }
function twPart(base, value, bookId) {
    const url = nAbsolute(base, value);
    if (!nTrusted(url)) return null;
    const match = /^https:\/\/[^/]+\/(\d{6,12})\/(\d+)(?:_(\d+))?\.html(?:[?#].*)?$/.exec(url);
    if (!match || (bookId && bookId !== match[1])) return null;
    return {book: match[1], chapter: match[2], part: Number(match[3] || 1), url: N_SITE.base + "/" + match[1] + "/" + match[2] + (match[3] ? "_" + match[3] : "") + ".html"};
}
class DefaultExtension extends NativeNovel {
    getSourcePreferences() { return [{key: "category", listPreference: {title: "書庫分類", summary: "預設為你指定的全部書庫。", valueIndex: 0, entries: TW_GENRES.map(item => item[1]), entryValues: TW_GENRES.map(item => item[0])}}]; }
    _list(html, url, page) {
        const document = new Document(html), list = [], seen = new Set();
        if (!nFirst(document, ".search-list")) throw nError("LIST", "未辨識到書籍清單，網站可能已改版");
        for (const card of document.select(".search-list .list > li")) {
            const anchor = nFirst(card, "h3 a[href]");
            if (!anchor) continue;
            const link = twBook(url, anchor.attr("href")), name = nClean(anchor.text);
            if (!link || !name || seen.has(link)) continue;
            seen.add(link);
            list.push({name, link, imageUrl: nImage(url, nAttr(card, "img", "data-src") || nAttr(card, "img", "src"))});
        }
        return {list, hasNextPage: list.length > 0 && nNext(document, url, page, ".pagination a[href]", "page")};
    }
    async getPopular(page) {
        page = nPage(page);
        const category = await this._preference("category", TW_GENRES.map(item => item[0]), "");
        const result = await this._page(N_SITE.base + "/bookstack/?page=" + page + (category ? "&cid=" + category : ""));
        return this._list(result.html, result.url, page);
    }
    async search(query, page) {
        query = String(query || "").trim(); page = nPage(page);
        if (!query) return {list: [], hasNextPage: false};
        const direct = twBook(N_SITE.base + "/", /^\d{6,12}$/.test(query) ? "/" + query + "/" : query);
        if (direct) { if (page > 1) return {list: [], hasNextPage: false}; const detail = await this.getDetail(direct); return {list: [{name: detail.name, link: direct, imageUrl: detail.imageUrl}], hasNextPage: false}; }
        const result = await this._page(N_SITE.base + "/search/" + encodeURIComponent(query) + (page > 1 ? "?page=" + page : ""));
        return this._list(result.html, result.url, page);
    }
    _chapters(html, url, bookId) {
        const document = new Document(html), entries = [];
        for (const anchor of document.select(".chaplist .all a[href]")) {
            const chapter = twPart(url, anchor.attr("href"), bookId), title = nClean(anchor.text);
            if (chapter && chapter.part === 1 && title) entries.push({name: title, url: chapter.url, position: Number(chapter.chapter)});
        }
        const count = /章節[：:]\s*(\d+)/.exec(nText(document, ".meta-dir"));
        if (count && new Set(entries.map(entry => entry.url)).size < Number(count[1])) throw nError("TOC-PARTIAL", "目錄尚未完整載入，請在來源 WebView 確認或回報作品網址");
        entries.sort((a, b) => a.position - b.position);
        return nNumberChapters(entries);
    }
    async getDetail(url) {
        const book = twBook(N_SITE.base + "/", url);
        if (!book) throw nError("URL", "請使用石頭小說的書籍網址");
        const result = await this._page(book), document = new Document(result.html);
        if (twBook(N_SITE.base + "/", result.url) !== book) throw nError("BOOK", "網站未回到指定作品");
        const name = nText(document, "#detail h1.title");
        if (!name) throw nError("DETAIL", "未辨識到作品資料");
        const toc = await this._page(book + "dir");
        if (toc.url.split(/[?#]/)[0] !== book + "dir") throw nError("TOC", "網站未回到指定目錄");
        return {name, link: book, imageUrl: nImage(result.url, nAttr(document, "#detail .cover img", "src")), author: nText(document, "#detail .author"),
            description: nPlain(nFirst(document, "#detail .intro") ? nFirst(document, "#detail .intro").innerHtml : ""),
            genre: document.select('#detail .meta a[href*="cid="]').map(node => nClean(node.text)), status: 5,
            chapters: this._chapters(toc.html, toc.url, /\/(\d+)\/$/.exec(book)[1])};
    }
    _decode(html, result) {
        if (result.fontFile !== TW_FONT_FILE || result.fontHash !== TW_FONT_HASH) throw nError("FONT-UPDATED", "網站閱讀字型已變更，為避免亂碼請更新此套件");
        return String(html).replace(/(^|>)([^<]+)/g, (_, prefix, text) => prefix + text.replace(/[\uac00-\ud7a3]/g, character => TW_FONT_MAP[character] || character));
    }
    async getHtmlContent(name, url) {
        const first = twPart(N_SITE.base + "/", url);
        if (!first) throw nError("URL", "章節網址格式錯誤");
        const output = [], seen = new Set(); let current = first;
        while (current && seen.size < 20) {
            if (seen.has(current.url)) throw nError("PAGES", "章內分頁重複，請回報作品網址");
            seen.add(current.url);
            const result = await this._page(current.url, {waitFor: ".chapter-content .content", fonts: true});
            const actual = twPart(N_SITE.base + "/", result.url);
            if (!actual || actual.url !== current.url) throw nError("CHAPTER", "網站未回到指定章節分頁");
            const document = new Document(result.html), content = nFirst(document, ".chapter-content .content");
            if (!content) throw nError("CONTENT", "未取得章節正文，請在來源 WebView 確認");
            output.push(this._decode(content.innerHtml, result));
            let next = null;
            for (const anchor of document.select(".foot-nav a[href]")) {
                const part = twPart(result.url, anchor.attr("href"), first.book);
                if (part && part.chapter === first.chapter && part.part > current.part && /下一[頁页]/.test(nClean(anchor.text))) { next = part; break; }
            }
            current = next;
        }
        if (current) throw nError("PAGES", "章內分頁超過支援上限，請回報作品網址");
        return nArticle(name, output.join("\n"), N_SITE.base + "/");
    }
}
