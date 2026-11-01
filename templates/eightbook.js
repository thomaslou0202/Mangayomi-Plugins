/* 8book native novel source. Original code: MIT. */
const mangayomiSources = [{
    name: "無限小說8book（測試版）", id: 1827634454, lang: "zh", baseUrl: "https://www.8book.com", apiUrl: "",
    iconUrl: "https://www.8book.com/favicon.ico", typeSource: "single", itemType: 2, isManga: false,
    sourceCodeLanguage: 1, version: "0.1.1", appMinVerReq: "0.9.9", pkgPath: "novel/src/zh/eightbook.js",
    hasCloudflare: true, isNsfw: false, notes: "支援排行、分類、更新、搜尋、分卷目錄與完整正文。優先取得站方公開章節內容，避免手機廣告轉址。"
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
function ebResponseText(value) {
    // The public text files omit charset. Dart's HTTP fallback can expose
    // UTF-8 bytes as latin1; already decoded Unicode must remain unchanged.
    if (!/[\u0080-\u00ff]/.test(value) || /[^\u0000-\u00ff]/.test(value)) return value;
    try { return decodeURIComponent(Array.from(value, character => "%" + character.charCodeAt(0).toString(16).padStart(2, "0")).join("")); }
    catch (_) { return value; }
}
// Read only the literal data and URL expression used by the site's public
// chapter loader. No page JavaScript, navigation, or arbitrary calls execute.
function ebContentUrl(html, chapter) {
    const ids = /\/read\/(\d+)\/\?(\d+)$/.exec(chapter), document = new Document(html);
    if (!ids || nAttr(document, 'meta[name="itemid"]', "content") !== ids[1]) throw nError("CHAPTER", "網站未回傳指定作品的章節頁");
    const script = document.select("script").map(node => node.text).find(text => /\$\.get\(unescape\(/.test(text));
    const request = script && /\$\.get\(unescape\(([^]*?)\),\s*function\s*\(/.exec(script);
    if (!request || request[1].length > 2048) throw nError("LOADER", "網站正文載入格式已變更，請更新來源");
    const values = Object.create(null);
    const declarations = /\bvar\s+([A-Za-z_$][\w$]*)\s*=\s*(\d+|"[\d,]+"|'[\d,]+')(\.split\(\s*['"],['"]\s*\))?\s*;/g;
    let declared = false;
    for (const match of script.matchAll(declarations)) {
        const raw = match[2], value = /^\d+$/.test(raw) ? Number(raw) : raw.slice(1, -1);
        values[match[1]] = match[3] ? String(value).split(",") : value;
        if (Array.isArray(values[match[1]]) && values[match[1]].slice(0, -1).includes(ids[2])) declared = true;
    }
    if (!declared) throw nError("CHAPTER", "此作品章節索引中找不到指定章節");
    let expression = request[1].replace(/^\(typeof\(td\)\s*!=\s*'undefined'\s*\?\s*td\s*:\s*''\)\s*\+/, "''+");
    const tokens = [], token = /\s*(\d+|'[^'\\]*'|"[^"\\]*"|[A-Za-z_$][\w$]*|[+\-*%.\[\](),])/y;
    let position = 0;
    while (position < expression.length) {
        token.lastIndex = position;
        const match = token.exec(expression);
        if (!match || tokens.length > 256) throw nError("LOADER", "不支援的正文網址格式");
        tokens.push(match[1]); position = token.lastIndex;
    }
    const unknown = [...new Set(tokens.filter(value => /^[A-Za-z_$][\w$]*$/.test(value) && !Object.prototype.hasOwnProperty.call(values, value) && value !== "substr" && value !== "length"))];
    if (unknown.length !== 1) throw nError("LOADER", "未辨識到正文網址的章節欄位");
    values[unknown[0]] = ids[2];
    let index = 0;
    function expect(value) { if (tokens[index++] !== value) throw nError("LOADER", "正文網址語法不符"); }
    function atom(depth) {
        if (depth > 20) throw nError("LOADER", "正文網址過於複雜");
        const next = tokens[index++]; let value;
        if (next === "(") { value = sum(depth + 1); expect(")"); }
        else if (/^\d+$/.test(next || "")) value = Number(next);
        else if (/^['"]/.test(next || "")) value = next.slice(1, -1);
        else if (Object.prototype.hasOwnProperty.call(values, next)) value = values[next];
        else throw nError("LOADER", "正文網址包含未知欄位");
        while (tokens[index] === "." || tokens[index] === "[") {
            if (tokens[index++] === "[") {
                const key = sum(depth + 1); expect("]");
                if (!Array.isArray(value) || !Number.isInteger(key) || key < 0 || key >= value.length) throw nError("LOADER", "正文網址索引不符");
                value = value[key];
            } else {
                const member = tokens[index++];
                if (member === "length" && (typeof value === "string" || Array.isArray(value))) value = value.length;
                else if (member === "substr" && typeof value === "string") {
                    expect("("); const start = sum(depth + 1); expect(","); const length = sum(depth + 1); expect(")");
                    if (!Number.isFinite(Number(start)) || !Number.isInteger(length) || length < 0 || length > 32) throw nError("LOADER", "正文網址字串範圍不符");
                    value = value.substr(Number(start), length);
                } else throw nError("LOADER", "正文網址包含不支援的操作");
            }
        }
        return value;
    }
    function sum(depth) {
        let value = product(depth);
        while (tokens[index] === "+" || tokens[index] === "-") {
            const op = tokens[index++], right = product(depth);
            if (Array.isArray(value) || Array.isArray(right)) throw nError("LOADER", "正文網址資料類型不符");
            value = op === "+" ? value + right : Number(value) - Number(right);
        }
        return value;
    }
    function product(depth) {
        let value = atom(depth);
        while (tokens[index] === "*" || tokens[index] === "%") {
            const op = tokens[index++], right = atom(depth);
            value = op === "*" ? Number(value) * Number(right) : Number(value) % Number(right);
            if (!Number.isFinite(value)) throw nError("LOADER", "正文網址數值不符");
        }
        return value;
    }
    let path;
    try { path = decodeURIComponent(String(sum(0))); } catch (_) { throw nError("LOADER", "未能解析站方公開正文網址"); }
    if (index !== tokens.length || !(new RegExp("^/txt/\\d+/" + ids[1] + "/" + ids[2] + "\\d{1,8}\\.html$")).test(path)) throw nError("LOADER", "正文網址與指定章節不符");
    return N_SITE.base + path;
}
class DefaultExtension extends NativeNovel {
    constructor() { super(); this.readers = new Map(); this.client = new Client({timeout: 25, connectTimeout: 10}); }
    async _http(url, referer) {
        if (!nTrusted(url)) throw nError("URL", "正文請求離開無限小說網站");
        let response;
        try { response = await this.client.get(url, {Referer: referer || N_SITE.base + "/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"}); }
        catch (_) { return null; }
        if (!nTrusted(response.request && response.request.url || url)) throw nError("URL", "網站將正文請求轉到其他網站");
        if (Number(response.statusCode) === 429) throw nError("RATE", "網站請求過於頻繁，請稍後重試");
        return Number(response.statusCode) === 200 && typeof response.body === "string" && !nChallenge(response.body) ? ebResponseText(response.body) : null;
    }
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
        const reader = await this._http(chapter);
        if (reader !== null) {
            const contentUrl = ebContentUrl(reader, chapter), html = await this._http(contentUrl, chapter);
            if (html === null || /<title[^>]*>\s*(?:404|403)|<(?:html|head)\b/i.test(html)) throw nError("CONTENT", "未取得站方公開正文，請稍後重試");
            return nArticle(name, html, contentUrl);
        }
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
