/* 8book native novel source. Original code: MIT. */
const mangayomiSources = [{
    name: "無限小說8book（測試版）", id: 1827634454, lang: "zh", baseUrl: "https://www.8book.com", apiUrl: "",
    iconUrl: "https://www.8book.com/favicon.ico", typeSource: "single", itemType: 2, isManga: false,
    sourceCodeLanguage: 1, version: "0.1.0", appMinVerReq: "0.9.9", pkgPath: "novel/src/zh/eightbook.js",
    hasCloudflare: true, isNsfw: false, notes: "支援排行、分類、更新、搜尋、分卷目錄與動態正文。正文使用網站指定的閱讀網域。"
}];
const N_SITE = {name: "無限小說", code: "8B", base: "https://www.8book.com", hosts: ["www.8book.com", "8book.com"], images: ["www.8book.com", "8book.com"]};
/*__COMMON__*/
const EIGHT_CATEGORIES = [["rank", "熱門排行"], ["9", "日輕小說"], ["update", "最新更新"], ["newrelease", "新書入庫"], ["finish", "全本小說"], ["2", "仙俠武俠"], ["8", "玄幻奇幻"], ["3", "都市言情"], ["4", "穿越重生"], ["1", "魔法異界"], ["6", "遊戲競技"], ["5", "懸疑靈異"], ["14", "動漫同人"], ["10", "軍事紀實"], ["11", "歷史名著"]];
function ebBook(base, value) { const url = nAbsolute(base, value); const match = /^https:\/\/(?:www\.)?8book\.com\/novelbooks\/(\d+)\/?(?:[?#].*)?$/i.exec(url); return match ? N_SITE.base + "/novelbooks/" + match[1] + "/" : ""; }
function ebChapter(base, value, bookId) {
    const url = nAbsolute(base, value);
    if (/[\u0000-\u0020\\]/.test(url)) return "";
    const match = /^https:\/\/[a-z0-9.-]+(?::443)?\/read\/(\d+)\/?\?(\d+)(?:[&#].*)?$/i.exec(url);
    return match && (!bookId || bookId === match[1]) ? N_SITE.base + "/read/" + match[1] + "/?" + match[2] : "";
}
class DefaultExtension extends NativeNovel {
    constructor() { super(); this.readers = new Map(); }
    get supportsLatest() { return true; }
    getSourcePreferences() { return [{key: "category", listPreference: {title: "首頁分類", summary: "可選日輕小說、排行或其他分類。", valueIndex: 0, entries: EIGHT_CATEGORIES.map(item => item[1]), entryValues: EIGHT_CATEGORIES.map(item => item[0])}}]; }
    _list(html, url, page, search) {
        const document = new Document(html), list = [], seen = new Set();
        if (!nFirst(document, ".card")) throw nError("LIST", "未辨識到書籍清單，網站可能已改版");
        for (const card of document.select(".card .border_gray")) {
            const anchor = nFirst(card, "a.nowraphide[href]");
            if (!anchor) continue;
            const link = ebBook(url, anchor.attr("href")), name = nText(anchor, "li.nowraphide");
            if (!link || !name || seen.has(link)) continue;
            seen.add(link);
            list.push({name, link, imageUrl: nImage(url, nAttr(card, "img", "data-src") || nAttr(card, "img", "src"))});
        }
        return {list, hasNextPage: list.length > 0 && nNext(document, url, page, '[id$="pager"] a[href],.pagination a[href]', search ? "page" : "")};
    }
    async _category(category, page) { const result = await this._page(N_SITE.base + "/booklists/" + category + "/" + nPage(page) + ".html"); return this._list(result.html, result.url, nPage(page), false); }
    async getPopular(page) { return this._category(await this._preference("category", EIGHT_CATEGORIES.map(item => item[0]), "rank"), page); }
    async getLatestUpdates(page) { return this._category("update", page); }
    async search(query, page) {
        query = String(query || "").trim(); page = nPage(page);
        if (!query) return {list: [], hasNextPage: false};
        const direct = ebBook(N_SITE.base + "/", /^\d+$/.test(query) ? "/novelbooks/" + query + "/" : query);
        if (direct) { if (page > 1) return {list: [], hasNextPage: false}; const detail = await this.getDetail(direct); return {list: [{name: detail.name, link: direct, imageUrl: detail.imageUrl}], hasNextPage: false}; }
        const result = await this._page(N_SITE.base + "/search/?key=" + encodeURIComponent(query) + (page > 1 ? "&page=" + page : ""));
        return this._list(result.html, result.url, page, true);
    }
    _chapters(html, url, bookId) {
        const document = new Document(html), entries = [];
        for (const group of document.select("#chapters .folder")) {
            const volume = nText(group, ".vol-title h3").split("/")[0].trim(), raw = [], seen = new Set();
            for (const anchor of group.select("a.episode_li[href]")) {
                const chapter = ebChapter(url, anchor.attr("href"), bookId), title = nClean(anchor.text);
                if (chapter && title && !seen.has(chapter)) {
                    const original = nAbsolute(url, anchor.attr("href")), host = /^https:\/\/([a-z0-9.-]+)(?::443)?\//i.exec(original);
                    if (!host) continue;
                    this.readers.set(chapter, host[1].toLowerCase());
                    seen.add(chapter); raw.push({url: chapter, name: (volume ? volume + " · " : "") + title});
                }
            }
            const count = Number(nText(group, ".fc"));
            if (count > raw.length) throw nError("TOC-PARTIAL", "網站目錄尚未完整載入，請在來源 WebView 確認或回報作品網址");
            entries.push(...raw);
        }
        return nNumberChapters(entries);
    }
    async getDetail(url) {
        const book = ebBook(N_SITE.base + "/", url);
        if (!book) throw nError("URL", "請使用無限小說的書籍網址");
        const result = await this._page(book), document = new Document(result.html);
        if (ebBook(N_SITE.base + "/", result.url) !== book) throw nError("BOOK", "網站未回到指定作品");
        const meta = property => nAttr(document, 'meta[property="' + property + '"]', "content");
        const name = nClean(meta("og:title"));
        if (!name || !nFirst(document, "#chapters")) throw nError("DETAIL", "未辨識到作品與目錄");
        return {name, link: book, imageUrl: nImage(result.url, meta("og:image")), author: nClean(meta("og:novel:author")),
            description: nPlain(meta("og:description")), genre: [nClean(meta("og:novel:category"))].filter(Boolean),
            status: /已完結|已完结/.test(nText(document, ".item-info-status")) ? 1 : 0,
            chapters: this._chapters(result.html, result.url, /\/novelbooks\/(\d+)/.exec(book)[1])};
    }
    async _reader(chapter) {
        if (!this.readers.has(chapter)) {
            const bookId = /\/read\/(\d+)\//.exec(chapter)[1], book = N_SITE.base + "/novelbooks/" + bookId + "/";
            const result = await this._page(book);
            if (ebBook(N_SITE.base + "/", result.url) !== book) throw nError("BOOK", "網站未回到指定作品");
            this._chapters(result.html, result.url, bookId);
        }
        const host = this.readers.get(chapter);
        if (!host) throw nError("CHAPTER", "作品目錄中找不到這個章節，請重新整理作品");
        return host;
    }
    async getHtmlContent(name, url) {
        if (!nTrusted(nAbsolute(N_SITE.base + "/", url))) throw nError("URL", "請使用套件目錄提供的章節網址");
        const chapter = ebChapter(N_SITE.base + "/", url);
        if (!chapter) throw nError("URL", "章節網址格式錯誤");
        const host = await this._reader(chapter);
        // Start at 8book's canonical URL. Only the reader host explicitly
        // linked for this book AND chapter is accepted after its redirect.
        const result = await this._page(chapter, {waitFor: "#text", readerHosts: [host]});
        if (ebChapter(N_SITE.base + "/", result.url) !== chapter) throw nError("CHAPTER", "網站未回到指定章節");
        const content = nFirst(new Document(result.html), "#text");
        if (!content) throw nError("CONTENT", "未取得動態正文，請在來源 WebView 確認");
        return nArticle(name, content.innerHtml, result.url, [host]);
    }
}
