/*
 * CZBooks native JavaScript novel source for Mangayomi 0.9.9.
 * Version 0.1.0. UTF-8, no dependencies or embedded credentials.
 * MIT license; see LICENSE.txt. Public pages are rendered by the app WebView.
 */
const mangayomiSources = [{
    name: "小說狂人（測試版）", id: 1827634452, lang: "zh",
    baseUrl: "https://czbooks.net", apiUrl: "", iconUrl: "https://czbooks.net/favicon.ico",
    typeSource: "single", itemType: 2, isManga: false, sourceCodeLanguage: 1,
    version: "0.1.0", appMinVerReq: "0.9.9", pkgPath: "novel/src/zh/czbooks.js",
    hasCloudflare: true, isNsfw: false,
    notes: "預設精選排行，可在來源設定切換分類與日／週／總排行。全書連續序號同時供清單排序與下一章使用。網站登入請使用內建 WebView。"
}];
const CZ_BASE = "https://czbooks.net";
const CZ_CATEGORIES = [
    ["normal", "精選排行"], ["all", "人氣榜"], ["favorite", "收藏榜"], ["finish", "完本榜"],
    ["japan", "日系"], ["xuanhuan", "玄幻奇幻"], ["yanqing", "言情"], ["xianxia", "武俠仙俠"],
    ["lishi", "軍事歷史"], ["wangyou", "科幻未來"], ["lingyi", "靈異玄幻"], ["tongren", "女生同人"],
    ["erciyuan", "原創同人"], ["danmei", "耽美"], ["baihe", "百合"], ["fanatsy", "奇幻冒險"],
    ["drama", "電視劇"], ["classicbook", "經典文學"], ["suspense", "推理"], ["girl", "女性向"],
    ["short", "短篇"], ["creator", "狂人原創"], ["herotic", "情色工口"], ["blerotic", "耽美工口"], ["hot", "工口榜"]
];
const CZ_RANKINGS = [["day", "日排行"], ["week", "週排行"], ["total", "總排行"]];
function czError(message) { return new Error("小說狂人：" + message); }
function czClean(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
function czEscape(text) {
    return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function czWide(text) { return text.replace(/[0-9]/g, digit => String.fromCharCode(digit.charCodeAt(0) + 0xfee0)); }
function czPage(page) { const n = Number(page); return Number.isSafeInteger(n) && n > 0 ? n : 1; }
function czAbsolute(base, value) {
    const raw = String(value || "").trim().replace(/&amp;/gi, "&");
    if (!raw || /[\u0000-\u0020\\]/.test(raw)) return "";
    if (/^https?:\/\//i.test(raw)) return raw.replace(/^http:/i, "https:");
    if (/^\/\//.test(raw)) return "https:" + raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";
    const origin = /^(https?:\/\/[^/?#]+)/i.exec(base);
    if (!origin) return "";
    const cleanBase = base.split(/[?#]/)[0];
    if (raw[0] === "?") return cleanBase + raw;
    if (raw[0] === "#") return cleanBase + raw;
    const relative = raw[0] === "/" ? raw : cleanBase.slice(origin[1].length).replace(/[^/]*$/, "") + raw;
    const parts = [];
    for (const part of relative.split("/")) {
        if (part === "..") parts.pop();
        else if (part && part !== ".") parts.push(part);
    }
    return origin[1] + "/" + parts.join("/");
}
function czTrusted(url) {
    return /^https:\/\/(?:www\.)?czbooks\.net(?::443)?(?:[/?#]|$)/i.test(url)
        && !/[\u0000-\u0020\\]/.test(url);
}
function czChecked(base, value) {
    const resolved = czAbsolute(base, value);
    if (!czTrusted(resolved)) throw czError("已停止前往小說狂人以外的網址，請檢查來源或網站轉址（CZ-URL）。");
    return resolved;
}
function czBookUrl(base, value) {
    const absolute = czAbsolute(base, value);
    if (!czTrusted(absolute)) return "";
    const match = /^https:\/\/[^/]+\/n\/([a-z0-9_-]+)\/?(?:[?#].*)?$/i.exec(absolute);
    return match ? CZ_BASE + "/n/" + match[1] : "";
}
function czChapterUrl(base, value, bookId) {
    const absolute = czAbsolute(base, value);
    if (!czTrusted(absolute)) return "";
    const match = /^https:\/\/[^/]+\/n\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/?(?:[?#].*)?$/i.exec(absolute);
    return match && (!bookId || bookId === match[1]) ? CZ_BASE + "/n/" + match[1] + "/" + match[2] : "";
}
function czImage(base, value) {
    const absolute = czAbsolute(base, value);
    return /^https:\/\/(?:(?:www\.|img\.)?czbooks\.net)(?::443)?\//i.test(absolute) ? absolute : "";
}
function czFirst(scope, selector) { const elements = scope.select(selector); return elements.length ? elements[0] : null; }
function czText(scope, selector) { const element = czFirst(scope, selector); return element ? czClean(element.text) : ""; }
function czPlain(html) {
    const value = String(html || "").replace(/<(script|style|iframe)\b[^>]*>[^]*?<\/\1\s*>/gi, "")
        .replace(/<br\b[^>]*>/gi, "\n").replace(/<\/(?:p|div)\s*>/gi, "\n");
    const document = new Document("<body>" + value + "</body>");
    const body = czFirst(document, "body");
    return String(body ? body.text : document.text).split(/\r?\n/).map(czClean).filter(Boolean).join("\n");
}
function czChallenge(html) {
    const title = /<title\b[^>]*>([^]*?)<\/title>/i.exec(html);
    return !!(title && /^(?:Just a moment(?:\.{3}|…)?|Attention Required!?(?:\s*\|\s*Cloudflare)?)$/i.test(title[1].trim()))
        || /<(?:form|div|section)\b[^>]*\bid\s*=\s*["'](?:challenge-form|challenge-running|challenge-stage|cf-challenge-running|challenge-error-title)["']/i.test(html);
}
function czBrowserTask(options) {
    const bridge = window.flutter_inappwebview;
    if (!bridge || typeof bridge.callHandler !== "function") return;
    const once = "__czbooks_" + options.nonce;
    if (window[once]) return;
    window[once] = true;
    const reply = kind => bridge.callHandler("setResponse", JSON.stringify({kind, url: location.href}));
    try {
        const url = new URL(location.href);
        if (url.protocol !== "https:" || !/^(?:www\.)?czbooks\.net$/i.test(url.hostname)
            || (url.port && url.port !== "443") || url.username || url.password) return reply("outside");
        const html = document.documentElement ? document.documentElement.outerHTML : "";
        if (czChallenge(html)) return reply("challenge");
        const copy = document.documentElement && document.documentElement.cloneNode(true);
        if (!copy) return reply("empty");
        // Return already rendered public markup, excluding executable widgets
        // and form values. The browser keeps its own authentication state.
        for (const element of copy.querySelectorAll("script, style, iframe, object, embed, noscript, form")) element.remove();
        for (const input of copy.querySelectorAll("input, textarea")) {
            input.removeAttribute("value");
            if (input.tagName === "TEXTAREA") input.textContent = "";
        }
        return bridge.callHandler("setResponse", JSON.stringify({kind: "page", url: location.href,
            charset: document.characterSet || "", html: copy.outerHTML}));
    } catch (_) { return reply("browser-error"); }
}
function czBrowserScript() {
    const options = {nonce: Date.now().toString(36) + Math.random().toString(36).slice(2)};
    return "(function(){const czChallenge=" + czChallenge.toString() + ";return (" + czBrowserTask.toString()
        + ")(" + JSON.stringify(options) + ");})()";
}
class DefaultExtension extends MProvider {
    constructor() { super(); this.prefs = new SharedPreferences(); this.pageQueue = Promise.resolve(); }
    // The requested curated ranking has no real latest-update ordering.
    get supportsLatest() { return false; }
    getHeaders() { return {Referer: CZ_BASE + "/"}; }
    getFilterList() { return []; }
    async getPageList() { return []; }
    async getVideoList() { return []; }
    getSourcePreferences() {
        return [
            {key: "category", listPreference: {title: "首頁分類", summary: "預設精選排行；切換後重新整理來源首頁。",
                valueIndex: 0, entries: CZ_CATEGORIES.map(item => item[1]), entryValues: CZ_CATEGORIES.map(item => item[0])}},
            {key: "ranking", listPreference: {title: "首頁排行", summary: "選擇日排行、週排行或總排行。",
                valueIndex: 0, entries: CZ_RANKINGS.map(item => item[1]), entryValues: CZ_RANKINGS.map(item => item[0])}}
        ];
    }
    async _browser(url) {
        const checked = czChecked(CZ_BASE + "/", url);
        if (typeof evaluateJavascriptViaWebview !== "function") throw czError("請使用 Mangayomi 0.9.9 或更新版本（CZ-HELPER）。");
        let raw;
        try { raw = await evaluateJavascriptViaWebview(checked, {}, [czBrowserScript()], 30); }
        catch (_) { throw czError("內建網頁讀取失敗，請重啟 App 後再試（CZ-BROWSER）。"); }
        if (!raw) throw czError("內建網頁讀取逾時，請先用來源 WebView 開啟同一頁（CZ-TIMEOUT）。");
        let result;
        try { result = JSON.parse(raw); } catch (_) { throw czError("內建網頁回傳格式錯誤（CZ-RESPONSE）。"); }
        if (!result || typeof result !== "object") throw czError("內建網頁回傳格式錯誤（CZ-RESPONSE）。");
        if (result.kind === "challenge") throw czError("網站要求真人驗證，請在來源 WebView 手動完成後重試（CZ-CHALLENGE）。");
        if (result.kind === "outside" || typeof result.url !== "string" || !czTrusted(result.url))
            throw czError("網頁離開小說狂人；若需要登入，請改用來源 WebView 完成（CZ-URL）。");
        if (result.kind === "browser-error") throw czError("內建網頁腳本未完成，請用來源 WebView 確認頁面（CZ-SCRIPT）。");
        if (result.kind !== "page" || typeof result.html !== "string" || !result.html.trim()) throw czError("網頁沒有有效內容（CZ-EMPTY）。");
        if (czChallenge(result.html)) throw czError("網站要求真人驗證，請在來源 WebView 手動完成（CZ-CHALLENGE）。");
        return {html: result.html, url: result.url};
    }
    _getPage(url) {
        const task = this.pageQueue.then(() => this._browser(url));
        this.pageQueue = task.catch(() => {});
        return task;
    }
    _parseList(html, url, page) {
        const document = new Document(html), container = czFirst(document, ".novel-list");
        if (!container) throw czError("未辨識到書籍清單，網站可能暫時無法使用或已改版（CZ-LIST）。");
        const list = [], seen = new Set();
        for (const item of container.select(".novel-item")) {
            const anchor = czFirst(item, ".novel-item-cover-wrapper a[href]");
            if (!anchor) continue;
            const link = czBookUrl(url, anchor.attr("href"));
            const name = czText(item, ".novel-item-title") || czClean(anchor.attr("title"));
            if (!link || !name || seen.has(link)) continue;
            seen.add(link);
            const image = czFirst(item, ".novel-item-thumbnail img");
            list.push({name, link, imageUrl: image ? czImage(url, image.attr("data-src") || image.attr("src")) : ""});
        }
        let hasNextPage = false;
        for (const anchor of document.select(".paginate a[href]")) {
            const absolute = czAbsolute(url, anchor.attr("href"));
            if (!czTrusted(absolute)) continue;
            const match = /\/(\d+)\/?(?:[?#]|$)/.exec(absolute) || /[?&]page=(\d+)(?:&|$)/.exec(absolute);
            if (match && Number(match[1]) > page) hasNextPage = true;
        }
        return {list, hasNextPage: list.length > 0 && hasNextPage};
    }
    async getPopular(page) {
        const category = String(await this.prefs.get("category") || "normal");
        const ranking = String(await this.prefs.get("ranking") || "day");
        const allowedCategory = CZ_CATEGORIES.some(item => item[0] === category) ? category : "normal";
        const allowedRanking = CZ_RANKINGS.some(item => item[0] === ranking) ? ranking : "day";
        const currentPage = czPage(page);
        const result = await this._getPage(CZ_BASE + "/c/" + allowedCategory + "/" + allowedRanking + "/" + currentPage);
        return this._parseList(result.html, result.url, currentPage);
    }
    async getLatest() { throw czError("精選排行不提供最新排序，請使用首頁排行。"); }
    async search(query, page, filters) {
        const text = String(query || "").trim(), currentPage = czPage(page);
        if (!text) return {list: [], hasNextPage: false};
        if (/^https?:\/\/|^\/n\//i.test(text)) {
            const book = czBookUrl(CZ_BASE + "/", text);
            if (!book) throw czError("請輸入小說狂人的書籍目錄網址（CZ-URL）。");
            if (currentPage > 1) return {list: [], hasNextPage: false};
            const result = await this._getPage(book);
            const detail = this._parseDetail(result.html, result.url);
            return {list: [{name: detail.name, link: detail.link, imageUrl: detail.imageUrl}], hasNextPage: false};
        }
        if (text.length > 200) throw czError("搜尋字詞過長，請縮短後重試。");
        const encoded = encodeURIComponent(text);
        const result = await this._getPage(CZ_BASE + "/s/" + encoded + "/" + currentPage + "?q=" + encoded);
        return this._parseList(result.html, result.url, currentPage);
    }
    _parseDetail(html, url) {
        const link = czBookUrl(CZ_BASE + "/", url), document = new Document(html);
        const detail = czFirst(document, ".novel-detail");
        if (!link || !detail) throw czError("未取得作品資料，作品可能已移除或網站已改版（CZ-DETAIL）。");
        const name = czText(detail, ".info .title").replace(/^《([^]*)》$/, "$1");
        if (!name) throw czError("未取得書名（CZ-DETAIL）。");
        const author = czText(detail, ".author a");
        const description = czFirst(detail, ".description");
        const image = czFirst(detail, ".thumbnail img");
        const genre = czText(detail, "#novel-category");
        let completed = /已完[結结]|已完成/.test(czText(detail, ".thumbnail-state"));
        for (const row of detail.select(".state tr")) {
            const cells = row.select("td");
            if (cells.length >= 2 && /連載狀態|连载状态/.test(czClean(cells[0].text))) completed = /已完[結结]|已完成/.test(cells[1].text);
        }
        return {name, link, imageUrl: image ? czImage(url, image.attr("data-src") || image.attr("src")) : "",
            author, description: description ? czPlain(description.innerHtml) : "", genre: genre ? [genre] : [], status: completed ? 1 : 0};
    }
    _parseChapters(html, url) {
        const book = czBookUrl(CZ_BASE + "/", url), document = new Document(html);
        const container = czFirst(document, ".chapter-list");
        if (!book || !container) throw czError("未取得作品目錄，請用來源 WebView 確認作品是否開放閱讀（CZ-TOC）。");
        const bookId = book.split("/").pop(), entries = [], seen = new Set();
        let volume = "";
        // One selector preserves volume/entry order under Mangayomi pseudom.
        for (const item of container.select("li")) {
            if ((item.attr("class") || "").split(/\s+/).includes("volume")) { volume = czClean(item.text); continue; }
            for (const anchor of item.select("a[href]")) {
                const href = anchor.attr("href"), chapter = czChapterUrl(url, href, bookId), title = czClean(anchor.text);
                if (!chapter || !title || seen.has(chapter)) continue;
                seen.add(chapter);
                const hint = /[?&]chapterNumber=(\d+)(?:&|$)/.exec(href.replace(/&amp;/g, "&"));
                entries.push({name: czWide(volume ? volume + " · " + title : title), url: chapter,
                    hint: hint ? Number(hint[1]) : null});
            }
        }
        if (!entries.length) throw czError("作品沒有可讀章節，請在來源 WebView 確認（CZ-TOC）。");
        if (entries.every(entry => Number.isSafeInteger(entry.hint)) && new Set(entries.map(entry => entry.hint)).size === entries.length)
            entries.sort((a, b) => a.hint - b.hint);
        const width = Math.max(4, String(entries.length).length);
        return entries.map((entry, index) => ({name: String(index + 1).padStart(width, "0") + "｜" + entry.name,
            url: entry.url, scanlator: "", dateUpload: ""})).reverse();
    }
    async getDetail(url) {
        const book = czBookUrl(CZ_BASE + "/", url);
        if (!book) throw czError("請使用書籍目錄網址（CZ-URL）。");
        const result = await this._getPage(book), detail = this._parseDetail(result.html, result.url);
        detail.chapters = this._parseChapters(result.html, result.url);
        return detail;
    }
    _cleanContent(html, base) {
        let content = String(html || "").replace(/<!--[^]*?-->/g, "")
            .replace(/<(script|style|iframe|object|svg|math|form)\b[^>]*>[^]*?<\/\1\s*>/gi, "");
        const allowed = /^(?:p|div|br|hr|strong|b|em|i|ruby|rt|rp|h1|h2|h3|blockquote|pre|code)$/;
        return content.replace(/<[^>]*>/g, tag => {
            const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*)/i.exec(tag);
            if (!match) return "";
            const closing = match[1], name = match[2].toLowerCase();
            if (name === "img" && !closing) {
                const image = czFirst(new Document(tag), "img"), src = image && czImage(base, image.attr("data-src") || image.attr("src"));
                return src ? '<img src="' + czEscape(src) + '" alt="' + czEscape(image.attr("alt")) + '">' : "";
            }
            return allowed.test(name) ? "<" + closing + name + ">" : "";
        }).trim();
    }
    async getHtmlContent(name, url) {
        const chapter = czChapterUrl(CZ_BASE + "/", url);
        if (!chapter) throw czError("章節網址格式錯誤（CZ-URL）。");
        const result = await this._getPage(chapter);
        if (czChapterUrl(CZ_BASE + "/", result.url) !== chapter) throw czError("網站未回到指定章節，請用來源 WebView 確認（CZ-CHAPTER）。");
        const document = new Document(result.html), content = czFirst(document, ".chapter-detail .content");
        if (!content) throw czError("未取得章節正文；請用來源 WebView 確認是否需登入或作品已移除（CZ-CONTENT）。");
        const html = this._cleanContent(content.innerHtml, result.url);
        if (!czClean(html.replace(/<[^>]+>/g, "")) && !/<img\s/i.test(html)) throw czError("章節正文是空的（CZ-CONTENT）。");
        return '<article><h3>' + czEscape(name) + '</h3>' + html + '</article>';
    }
    async cleanHtmlContent(html) { return this._cleanContent(html, CZ_BASE + "/"); }
}
