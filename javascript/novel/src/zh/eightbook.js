/* 8book native novel source. Original code: MIT. */
const mangayomiSources = [{
    name: "無限小說8book（測試版）", id: 1827634454, lang: "zh", baseUrl: "https://www.8book.com", apiUrl: "",
    iconUrl: "https://www.8book.com/favicon.ico", typeSource: "single", itemType: 2, isManga: false,
    sourceCodeLanguage: 1, version: "0.1.0", appMinVerReq: "0.9.9", pkgPath: "novel/src/zh/eightbook.js",
    hasCloudflare: true, isNsfw: false, notes: "支援排行、分類、更新、搜尋、分卷目錄與動態正文。正文使用網站指定的閱讀網域。"
}];
const N_SITE = {name: "無限小說", code: "8B", base: "https://www.8book.com", hosts: ["www.8book.com", "8book.com"], images: ["www.8book.com", "8book.com"]};
/* Shared runtime helpers. Generated into each standalone source; no imports. */
function nError(code, message) { return new Error(N_SITE.name + "：" + message + "（" + N_SITE.code + "-" + code + "）。"); }
function nClean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function nEscape(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function nWide(value) { return String(value).replace(/[0-9]/g, digit => String.fromCharCode(digit.charCodeAt(0) + 0xfee0)); }
function nPage(value) { const number = Number(value); return Number.isSafeInteger(number) && number > 0 ? number : 1; }
function nFirst(scope, selector) { const nodes = scope.select(selector); return nodes.length ? nodes[0] : null; }
function nText(scope, selector) { const node = nFirst(scope, selector); return node ? nClean(node.text) : ""; }
function nAttr(scope, selector, attribute) { const node = nFirst(scope, selector); return node ? node.attr(attribute) : ""; }
function nAbsolute(base, value) {
    const raw = String(value || "").trim().replace(/&amp;/gi, "&");
    if (!raw || /[\u0000-\u0020\\]/.test(raw)) return "";
    if (/^https?:\/\//i.test(raw)) return raw.replace(/^http:/i, "https:");
    if (raw.slice(0, 2) === "//") return "https:" + raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";
    const origin = /^(https?:\/\/[^/?#]+)/i.exec(base);
    if (!origin) return "";
    const clean = base.split(/[?#]/)[0];
    if (raw[0] === "?") return clean + raw;
    if (raw[0] === "#") return clean + raw;
    const relative = raw[0] === "/" ? raw : clean.slice(origin[1].length).replace(/[^/]*$/, "") + raw;
    const segments = [];
    for (const part of relative.split("/")) { if (part === "..") segments.pop(); else if (part && part !== ".") segments.push(part); }
    return origin[1] + "/" + segments.join("/");
}
function nAllowed(url, hosts) {
    const match = /^https:\/\/([a-z0-9.-]+)(?::443)?(?:[/?#]|$)/i.exec(url);
    return !!match && !/[\u0000-\u0020\\]/.test(url) && hosts.includes(match[1].toLowerCase());
}
function nTrusted(url) { return nAllowed(url, N_SITE.hosts); }
function nImage(base, value, extraHosts) { const url = nAbsolute(base, value); return nAllowed(url, N_SITE.images.concat(extraHosts || [])) ? url : ""; }
function nPlain(html) {
    const source = String(html || "").replace(/<br\b[^>]*>/gi, "\n").replace(/<\/(?:p|div)\s*>/gi, "\n");
    const document = new Document("<body>" + source + "</body>"), body = nFirst(document, "body");
    return String(body ? body.text : document.text).split(/\r?\n/).map(nClean).filter(Boolean).join("\n");
}
function nNumberChapters(entries) {
    const seen = new Set(), unique = entries.filter(entry => {
        if (!entry.url || !nClean(entry.name) || seen.has(entry.url)) return false;
        seen.add(entry.url); return true;
    });
    if (!unique.length) throw nError("TOC", "未取得章節，請在來源 WebView 確認作品目錄");
    const width = Math.max(4, String(unique.length).length);
    return unique.map((entry, index) => ({name: String(index + 1).padStart(width, "0") + "｜" + nWide(entry.name),
        url: entry.url, scanlator: "", dateUpload: ""})).reverse();
}
function nNext(document, url, page, selector, key) {
    return document.select(selector).some(anchor => {
        const absolute = nAbsolute(url, anchor.attr("href"));
        if (!nTrusted(absolute)) return false;
        const match = key ? new RegExp("[?&]" + key + "=(\\d+)(?:&|$)", "i").exec(absolute) : /\/(\d+)\.html(?:[?#]|$)/.exec(absolute);
        return !!match && Number(match[1]) > page;
    });
}
function nSanitize(html, base, imageHosts) {
    let content = String(html || "").replace(/<!--[^]*?-->/g, "")
        .replace(/<(script|style|iframe|object|embed|svg|math|form|ins)\b[^>]*>[^]*?<\/\1\s*>/gi, "");
    return content.replace(/<[^>]*>/g, tag => {
        const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*)/i.exec(tag);
        if (!match) return "";
        const closing = match[1], name = match[2].toLowerCase();
        if (name === "img" && !closing) {
            const image = nFirst(new Document(tag), "img");
            const src = image && nImage(base, image.attr("data-src") || image.attr("src"), imageHosts);
            return src ? '<img src="' + nEscape(src) + '" alt="' + nEscape(image.attr("alt")) + '">' : "";
        }
        return /^(?:p|div|br|hr|strong|b|em|i|ruby|rt|rp|h1|h2|h3|blockquote|pre|code)$/.test(name) ? "<" + closing + name + ">" : "";
    }).trim();
}
function nArticle(name, html, base, imageHosts) {
    const clean = nSanitize(html, base, imageHosts);
    if (!nClean(nPlain(clean)) && !/<img\s/i.test(clean)) throw nError("CONTENT", "章節正文為空，請稍後重試");
    return "<article><h3>" + nEscape(name) + "</h3>" + clean + "</article>";
}
function nChallenge(html) {
    const title = /<title\b[^>]*>([^]*?)<\/title>/i.exec(html);
    return !!(title && /^(?:Just a moment(?:\.{3}|…)?|Attention Required!?(?:\s*\|\s*Cloudflare)?)$/i.test(title[1].trim()))
        || /<(?:form|div|section)\b[^>]*\bid\s*=\s*["'](?:challenge-form|challenge-running|challenge-stage|cf-challenge-running)["']/i.test(html);
}
async function nBrowserTask(options) {
    const bridge = window.flutter_inappwebview;
    if (!bridge || typeof bridge.callHandler !== "function") return;
    const once = "__native_novel_" + options.nonce;
    if (window[once]) return;
    window[once] = true;
    const started = Date.now();
    const reply = (kind, extra) => bridge.callHandler("setResponse", JSON.stringify(Object.assign({kind, url: location.href}, extra || {})));
    function trusted() {
        const url = new URL(location.href);
        return url.protocol === "https:" && options.hosts.includes(url.hostname.toLowerCase()) && (!url.port || url.port === "443") && !url.username && !url.password;
    }
    async function capture() {
        try {
            if (!trusted()) return reply("outside");
            const html = document.documentElement ? document.documentElement.outerHTML : "";
            if (nChallenge(html)) return reply("challenge");
            if (options.waitFor) {
                const node = document.querySelector(options.waitFor);
                if ((!node || (!node.textContent.trim() && !node.querySelector("img"))) && Date.now() - started < 18000) {
                    setTimeout(capture, 250); return;
                }
            }
            let fontHash = "", fontFile = "";
            if (options.fonts) {
                const sheet = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).find(node => /^https:\/\/i1\.twbook\.cc\/min\/read\.\d+\.css(?:\?|$)/.test(node.href));
                if (!sheet) return reply("font-error");
                const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
                try {
                    const cssResponse = await fetch(sheet.href, {credentials: "omit", cache: "force-cache", signal: controller.signal});
                    if (!cssResponse.ok) return reply("font-error");
                    const css = await cssResponse.text();
                    const face = /@font-face\s*\{[^}]*font-family\s*:\s*['"]?bqg['"]?[^}]*\}/i.exec(css);
                    const src = face && /url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/i.exec(face[0]);
                    const font = src && new URL(src[1], sheet.href);
                    if (!font || !/^https:\/\/i1\.twbook\.cc\/fonts\/f\d+\.woff2$/.test(font.href)) return reply("font-error");
                    const response = await fetch(font.href, {credentials: "omit", cache: "force-cache", signal: controller.signal});
                    if (!response.ok) return reply("font-error");
                    fontHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await response.arrayBuffer()))).map(byte => byte.toString(16).padStart(2, "0")).join("");
                    fontFile = font.pathname.split("/").pop();
                } finally { clearTimeout(timer); }
            }
            if (!trusted()) return reply("outside");
            const copy = document.documentElement && document.documentElement.cloneNode(true);
            if (!copy) return reply("empty");
            for (const node of copy.querySelectorAll("script,style,iframe,object,embed,noscript,input,textarea,button,select,.gadBlock,.adBlock,.adUnit,.adsbygoogle")) node.remove();
            // ASP.NET list pages put their book list inside a form. Keep its
            // children while discarding form controls and submission metadata.
            for (const form of copy.querySelectorAll("form")) { while (form.firstChild) form.parentNode.insertBefore(form.firstChild, form); form.remove(); }
            return reply("page", {html: copy.outerHTML, fontHash, fontFile});
        } catch (_) { return reply("browser-error"); }
    }
    return capture();
}
function nBrowserScript(options) {
    return "(function(){const nChallenge=" + nChallenge.toString() + ";return (" + nBrowserTask.toString() + ")(" + JSON.stringify(options) + ");})()";
}
class NativeNovel extends MProvider {
    constructor() { super(); this.prefs = new SharedPreferences(); this.pageQueue = Promise.resolve(); }
    get supportsLatest() { return false; }
    getHeaders() { return {Referer: N_SITE.base + "/"}; }
    getFilterList() { return []; }
    getSourcePreferences() { return []; }
    async getPageList() { return []; }
    async getVideoList() { return []; }
    async cleanHtmlContent(html) { return nSanitize(html, N_SITE.base + "/"); }
    async _browser(url, options) {
        if (!nTrusted(url)) throw nError("URL", "網址不在此來源支援的網站內");
        if (typeof evaluateJavascriptViaWebview !== "function") throw nError("HELPER", "請使用 Mangayomi 0.9.9 或更新版本");
        const hosts = N_SITE.hosts.concat(options && options.readerHosts || []);
        const task = Object.assign({}, options || {}, {hosts, nonce: Date.now().toString(36) + Math.random().toString(36).slice(2)});
        let raw;
        try { raw = await evaluateJavascriptViaWebview(url, {}, [nBrowserScript(task)], 30); }
        catch (_) { throw nError("BROWSER", "內建網頁讀取失敗，請重啟 App 後再試"); }
        if (!raw) throw nError("TIMEOUT", "讀取逾時，請先在來源 WebView 開啟同一頁");
        let result;
        try { result = JSON.parse(raw); } catch (_) { throw nError("RESPONSE", "內建網頁回傳格式錯誤"); }
        if (!result || typeof result !== "object") throw nError("RESPONSE", "內建網頁回傳格式錯誤");
        if (result.kind === "challenge") throw nError("CHALLENGE", "請在來源 WebView 手動完成網站驗證後重試");
        if (result.kind === "outside" || typeof result.url !== "string" || !nAllowed(result.url, hosts)) throw nError("URL", "網頁離開此來源，請在來源 WebView 確認轉址");
        if (result.kind === "font-error") throw nError("FONT", "未能確認網站字型，請稍後重試");
        if (result.kind !== "page" || typeof result.html !== "string" || !result.html.trim()) throw nError("EMPTY", "網頁未回傳有效內容");
        if (nChallenge(result.html)) throw nError("CHALLENGE", "請在來源 WebView 手動完成網站驗證後重試");
        return result;
    }
    _page(url, options) { const task = this.pageQueue.then(() => this._browser(url, options)); this.pageQueue = task.catch(() => {}); return task; }
    async _preference(key, values, fallback) { const value = String(await this.prefs.get(key) || fallback); return values.includes(value) ? value : fallback; }
}

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
