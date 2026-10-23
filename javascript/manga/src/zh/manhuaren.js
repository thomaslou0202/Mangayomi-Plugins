/* Original Manhuaren web source for Mangayomi. MIT.
 * Uses the public site's catalogue handlers and normal chapter image list.
 * No private app API, request signing, browser-cookie extraction or remote eval.
 */
const mangayomiSources = [{
    name: "漫畫人（測試版）", id: 1827634457, lang: "zh", baseUrl: "https://www.manhuaren.com", apiUrl: "",
    iconUrl: "https://www.manhuaren.com/favicon.ico", typeSource: "single", itemType: 0, isManga: true,
    sourceCodeLanguage: 1, version: "0.1.0", appMinVerReq: "0.9.9", pkgPath: "manga/src/zh/manhuaren.js",
    hasCloudflare: true, isNsfw: false,
    notes: "支援站方熱門、最近更新、搜尋、完整章節及網頁可讀的漫畫圖片。搜尋沿用站方模糊比對；需登入、付費或限定官方 App 的內容不保證可讀。"
}];
const MH_BASE = "https://www.manhuaren.com";
function mhError(code, message) { return new Error("漫畫人：" + message + "（MHR-" + code + "）。"); }
function mhClean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function mhFirst(scope, selector) { const nodes = scope.select(selector); return nodes.length ? nodes[0] : null; }
function mhText(scope, selector) { const node = mhFirst(scope, selector); return node ? mhClean(node.text) : ""; }
function mhPlain(value) { const text = String(value || ""); return /[<&]/.test(text) ? mhText(new Document("<body>" + text + "</body>"), "body") : mhClean(text); }
function mhPage(value) { const number = Number(value); return Number.isSafeInteger(number) && number > 0 && number <= 10000 ? number : 1; }
function mhSite(url) { return /^https:\/\/www\.manhuaren\.com(?:[/?#]|$)/i.test(String(url)) && !/[\u0000-\u0020\\]/.test(String(url)); }
function mhAbsolute(value) {
    const raw = String(value || "").trim().replace(/&amp;/gi, "&");
    if (!raw || /[\u0000-\u0020\\]/.test(raw)) return "";
    if (raw.startsWith("//")) return "https:" + raw;
    if (/^https?:\/\//i.test(raw)) return raw.replace(/^http:/i, "https:");
    return raw[0] === "/" ? MH_BASE + raw : "";
}
function mhComic(value) { const url = mhAbsolute(value), match = /^https:\/\/www\.manhuaren\.com\/(manhua-[a-z0-9%_-]+)\/?(?:[?#].*)?$/i.exec(url); return match ? MH_BASE + "/" + match[1] + "/" : ""; }
function mhChapter(value) { const url = mhAbsolute(value), match = /^https:\/\/www\.manhuaren\.com\/m([1-9]\d*)\/?(?:[?#].*)?$/i.exec(url); return match ? MH_BASE + "/m" + match[1] + "/" : ""; }
function mhImage(value) { const url = mhAbsolute(value); return /^https:\/\/(?:[a-z0-9-]+\.)*(?:cdndm5\.com|manhuaren\.com)\/[^\s\\#]+$/i.test(url) ? url : ""; }
function mhForm(fields) { return Object.keys(fields).map(key => encodeURIComponent(key) + "=" + encodeURIComponent(String(fields[key]))).join("&"); }
function mhChallenge(html) { return /<title[^>]*>\s*(?:Just a moment|Attention Required)/i.test(html) || /\bid=["'](?:challenge-form|challenge-running)["']/i.test(html); }
// Read string literals as data. Chapter scripts are never evaluated here.
function mhString(text, start) {
    const quote = text[start]; if (quote !== "'" && quote !== '"') throw mhError("IMAGES", "圖片清單格式已變更");
    let value = "", index = start + 1;
    while (index < text.length) {
        const char = text[index++];
        if (char === quote) return {value, end: index};
        if (char !== "\\") { value += char; continue; }
        const escaped = text[index++];
        if (escaped === "u" || escaped === "x") {
            const size = escaped === "u" ? 4 : 2, hex = text.slice(index, index + size);
            if (hex.length !== size || !/^[a-f0-9]+$/i.test(hex)) throw mhError("IMAGES", "圖片網址跳脫格式已變更");
            value += String.fromCharCode(parseInt(hex, 16)); index += size;
        } else if (escaped === "\n") { /* line continuation */ }
        else if (escaped === "\r") { if (text[index] === "\n") index++; }
        else {
            const escapes = {n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\u0000"};
            if (escaped === undefined) throw mhError("IMAGES", "圖片清單字串不完整");
            value += Object.prototype.hasOwnProperty.call(escapes, escaped) ? escapes[escaped] : escaped;
        }
    }
    throw mhError("IMAGES", "圖片清單字串不完整");
}
function mhImageArray(script) {
    const match = /\b(?:var\s+)?newImgs\s*=\s*\[/.exec(script); if (!match) return null;
    const result = []; let index = match.index + match[0].length;
    while (index < script.length && result.length <= 4000) {
        while (/\s/.test(script[index] || "!") || script[index] === ",") index++;
        if (script[index] === "]") return result;
        const item = mhString(script, index), image = mhImage(item.value);
        if (!image) throw mhError("IMAGE-HOST", "圖片網址格式或站方圖片網域已變更，請回報章節網址");
        result.push(image); index = item.end;
        while (/\s/.test(script[index] || "!")) index++;
        if (script[index] !== "," && script[index] !== "]") throw mhError("IMAGES", "圖片清單包含非網址資料");
    }
    throw mhError("IMAGES", "圖片清單不完整或超過支援上限");
}
// Decode the public reader's standard packed string table as text. In large
// chapters dictionary indexes have multiple base-62 digits (e.g. "6k").
function mhUnpack(script) {
    const start = /return\s+p;\s*}\s*\(\s*/.exec(script); if (!start || script.length > 2000000) return "";
    let index = start.index + start[0].length;
    const payload = mhString(script, index); index = payload.end;
    const numbers = /^\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*/.exec(script.slice(index)); if (!numbers) return "";
    const radix = Number(numbers[1]), count = Number(numbers[2]);
    if (radix < 2 || radix > 62 || count < 1 || count > 20000) return "";
    index += numbers[0].length;
    const words = mhString(script, index);
    if (!/^\s*\.split\(\s*['"]\|['"]\s*\)/.test(script.slice(words.end))) return "";
    const dictionary = words.value.split("|"), lookup = Object.create(null);
    if (dictionary.length > 20000) return "";
    for (let number = 0; number < count; number++) {
        let value = number, key = "";
        do { const digit = value % radix; key = (digit < 36 ? digit.toString(36) : String.fromCharCode(digit + 29)) + key; value = Math.floor(value / radix); } while (value);
        if (dictionary[number]) lookup[key] = dictionary[number];
    }
    return payload.value.replace(/\b[0-9a-zA-Z]+\b/g, word => Object.prototype.hasOwnProperty.call(lookup, word) ? lookup[word] : word);
}
function mhBrowserScript(options) {
    async function capture(options) {
        const bridge = window.flutter_inappwebview; if (!bridge || typeof bridge.callHandler !== "function") return;
        const reply = (kind, body, status) => bridge.callHandler("setResponse", JSON.stringify({kind, url: location.href, body: body || "", status: status || 200}));
        try {
            const url = new URL(location.href);
            if (url.origin !== "https://www.manhuaren.com" || url.username || url.password) return reply("outside");
            if (mhChallenge(document.documentElement.outerHTML)) return reply("challenge");
            if (options.kind === "post") {
                const endpoint = new URL(options.endpoint);
                if (endpoint.origin !== url.origin) return reply("outside");
                const response = await fetch(endpoint.href, {method: "POST", credentials: "same-origin", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: options.body});
                if (new URL(response.url).origin !== url.origin) return reply("outside");
                return reply("page", await response.text(), response.status);
            }
            if (options.kind === "images") {
                const match = /^\/m([1-9]\d*)\/?$/.exec(url.pathname);
                if (!match || match[1] !== options.chapter || typeof window.DM5_CID === "undefined" || String(window.DM5_CID) !== options.chapter) return reply("chapter");
                return reply("page", JSON.stringify(Array.isArray(window.newImgs) ? window.newImgs : []));
            }
            const copy = document.documentElement.cloneNode(true);
            for (const node of copy.querySelectorAll("form,input,textarea,iframe,object,embed")) node.remove();
            return reply("page", copy.outerHTML);
        } catch (_) { return reply("error"); }
    }
    return "(function(){const mhChallenge=" + mhChallenge.toString() + ";return (" + capture.toString() + ")(" + JSON.stringify(options) + ");})()";
}
class DefaultExtension extends MProvider {
    constructor() { super(); this.client = new Client(); this.browserQueue = Promise.resolve(); }
    get supportsLatest() { return true; }
    getHeaders(url) { return {Referer: mhSite(url) ? url : MH_BASE + "/", Origin: MH_BASE}; }
    getFilterList() { return []; }
    getSourcePreferences() { return []; }
    async _browser(view, options) {
        if (!mhSite(view) || typeof evaluateJavascriptViaWebview !== "function") throw mhError("WEBVIEW", "請使用 Mangayomi 0.9.9 以上版本，並在來源 WebView 確認網站可開啟");
        const task = this.browserQueue.then(async () => {
            const raw = await evaluateJavascriptViaWebview(view, {}, [mhBrowserScript(options)], 30);
            let data; try { data = JSON.parse(raw); } catch (_) { throw mhError("WEBVIEW", "內建網頁讀取失敗，請稍後再試"); }
            if (data && data.kind === "challenge") throw mhError("CHALLENGE", "請在來源 WebView 手動完成網站驗證後重試");
            if (data && data.kind === "chapter") throw mhError("CHAPTER", "網站沒有回到指定章節");
            if (!data || data.kind !== "page" || !mhSite(data.url) || typeof data.body !== "string") throw mhError("WEBVIEW", "未取得漫畫人網頁，請在來源 WebView 確認");
            return {body: data.body, url: data.url, statusCode: Number(data.status || 200)};
        });
        this.browserQueue = task.catch(() => {}); return task;
    }
    _response(response) {
        if (Number(response.statusCode) === 429) throw mhError("RATE", "網站限制請求頻率，請稍後再試");
        if (Number(response.statusCode) === 403 || mhChallenge(String(response.body || ""))) throw mhError("CHALLENGE", "請在來源 WebView 手動完成網站驗證後重試");
        if (Number(response.statusCode) !== 200 || typeof response.body !== "string" || !response.body.trim()) throw mhError("HTTP", "網站暫時無法讀取，請稍後再試");
        return response;
    }
    async _get(url) {
        if (!mhSite(url)) throw mhError("URL", "只接受漫畫人的網頁網址");
        let response; try { response = await this.client.get(url, this.getHeaders(url)); } catch (_) { return this._response(await this._browser(url, {kind: "html"})); }
        if (Number(response.statusCode) === 403 || mhChallenge(String(response.body || ""))) return this._response(await this._browser(url, {kind: "html"}));
        this._response(response); const actual = response.request && response.request.url || url;
        if (!mhSite(actual)) throw mhError("URL", "網站轉到漫畫人以外的網址");
        return {body: response.body, url: actual};
    }
    async _post(endpoint, fields, view) {
        const body = mhForm(fields); let response, rendered = false;
        try { response = await this.client.post(endpoint, {...this.getHeaders(view), "Content-Type": "application/x-www-form-urlencoded"}, body); }
        catch (_) { rendered = true; response = await this._browser(view, {kind: "post", endpoint, body}); }
        if (!rendered && (Number(response.statusCode) === 403 || mhChallenge(String(response.body || "")))) response = await this._browser(view, {kind: "post", endpoint, body});
        this._response(response);
        if (response.request && response.request.url && response.request.url !== endpoint) throw mhError("URL", "漫畫清單介面發生非預期轉址");
        try { return JSON.parse(response.body); } catch (_) { throw mhError("LIST", "站方清單格式已變更，請稍後再試或回報"); }
    }
    _items(rows) {
        if (!Array.isArray(rows)) throw mhError("LIST", "站方清單格式已變更");
        const seen = new Set(), list = [];
        for (const row of rows) {
            if (!row || typeof row !== "object") continue;
            const link = mhComic(row.Url || (row.UrlKey ? "/" + row.UrlKey + "/" : "")), name = mhPlain(row.Title), imageUrl = mhImage(row.Pic || row.ShowPicUrlB);
            if (!link || !name || seen.has(link)) continue;
            seen.add(link); list.push({name, link, imageUrl});
        }
        if (rows.length && !list.length) throw mhError("LIST", "未辨識到站方漫畫資料，請回報");
        return list;
    }
    async _catalogue(page, latest) {
        page = mhPage(page);
        const data = await this._post(MH_BASE + "/manhua-list/dm5.ashx", {action: "getclasscomics", pageindex: page, pagesize: 21, categoryid: 0, tagid: 0, status: 0, usergroup: 0, pay: -1, areaid: 0, sort: latest ? 2 : 10, iscopyright: 0}, MH_BASE + (latest ? "/manhua-list-s2/" : "/manhua-list/"));
        if (!data || !Array.isArray(data.UpdateComicItems)) throw mhError("LIST", "站方漫畫排行格式已變更");
        const list = this._items(data.UpdateComicItems), total = Number(data.Count);
        return {list, hasNextPage: list.length > 0 && (Number.isFinite(total) && total >= 0 ? page * 21 < total : data.UpdateComicItems.length >= 21)};
    }
    async getPopular(page) { return this._catalogue(page, false); }
    async getLatestUpdates(page) { return this._catalogue(page, true); }
    async search(query, page) {
        query = mhClean(query); if (!query) return {list: [], hasNextPage: false}; page = mhPage(page);
        const rows = await this._post(MH_BASE + "/pagerdata.ashx", {t: 7, pageindex: page, f: 0, title: query}, MH_BASE + "/search?title=" + encodeURIComponent(query));
        return {list: this._items(rows), hasNextPage: rows.length >= 10};
    }
    async getDetail(url) {
        const link = mhComic(url); if (!link) throw mhError("URL", "請從漫畫清單或搜尋結果開啟作品");
        const result = await this._get(link), document = new Document(result.body), name = mhText(document, ".detail-main-info-title");
        const identity = /\bDM5_CURRENTURL\s*=\s*["']([^"']+)["']/.exec(result.body);
        if (identity && mhComic(identity[1]) !== link) throw mhError("DETAIL", "網站沒有回到指定作品");
        if (!name) throw mhError("DETAIL", "未取得作品資料，請在該作品的 WebView 確認");
        const seen = new Set(), ordered = [], sortButton = mhFirst(document, ".detail-list-title-right"), ascending = sortButton && (" " + mhClean(sortButton.attr("class")) + " ").includes(" sort-1 ");
        for (const group of document.select(".detail-list-select")) {
            const chapters = [];
            for (const anchor of group.select("a")) {
                const chapter = mhChapter(anchor.attr("href")), title = mhClean(anchor.text) || mhClean(anchor.attr("title"));
                if (!chapter || !title || seen.has(chapter)) continue;
                seen.add(chapter); chapters.push({url: chapter, title});
            }
            // Retain group order and respect the site's current sort direction.
            ordered.push(...(ascending ? chapters : chapters.reverse()));
        }
        if (!ordered.length) throw mhError("CHAPTERS", "未取得可讀章節，請在作品 WebView 確認是否需登入或限定官方 App");
        const width = Math.max(4, String(ordered.length).length), cover = mhFirst(document, ".detail-main-cover img"), status = mhText(document, ".detail-list-title-1");
        const chapters = ordered.map((chapter, index) => ({url: chapter.url, name: String(index + 1).padStart(width, "0") + "｜" + chapter.title.replace(/[0-9]/g, digit => String.fromCharCode(digit.charCodeAt(0) + 0xfee0)), scanlator: "", dateUpload: ""})).reverse();
        return {name, link, imageUrl: cover ? mhImage(cover.attr("src")) : "", author: mhText(document, ".detail-main-info-author").replace(/^作者\s*[:：]\s*/, ""), artist: "", description: mhText(document, ".detail-desc"),
            genre: document.select(".detail-main-info-class a").map(anchor => mhClean(anchor.text)).filter(Boolean), status: /完[结結]/.test(status) ? 1 : /[连連][载載]/.test(status) ? 0 : 5, chapters};
    }
    _pages(html, chapter) {
        const id = /\bm([1-9]\d*)\/$/.exec(chapter)[1], actual = /\bDM5_CID\s*=\s*["']?(\d+)/.exec(html);
        if (!actual || actual[1] !== id) throw mhError("CHAPTER", "網站沒有回到指定章節，請在章節 WebView 確認");
        for (const node of new Document(html).select("script")) {
            let script = node.text;
            if (/eval\(function\(p,a,c,k,e,/.test(script) && script.includes("newImgs")) script = mhUnpack(script);
            const images = mhImageArray(script); if (images && images.length) return images;
        }
        return [];
    }
    async getPageList(url) {
        const chapter = mhChapter(url); if (!chapter) throw mhError("URL", "章節網址格式錯誤");
        const result = await this._get(chapter), images = this._pages(result.body, chapter);
        // The CDN requires the full chapter Referer. The app calls the global
        // getHeaders with the source base URL, so attach headers to each PageUrl.
        const pages = rows => rows.map(url => ({url, headers: this.getHeaders(chapter)}));
        if (images.length) return pages(images);
        const id = /\bm([1-9]\d*)\/$/.exec(chapter)[1], rendered = await this._browser(chapter, {kind: "images", chapter: id});
        let rows; try { rows = JSON.parse(rendered.body); } catch (_) { throw mhError("IMAGES", "內建網頁圖片清單格式錯誤"); }
        if (!Array.isArray(rows) || !rows.length) throw mhError("IMAGES", "站方未提供圖片，可能需登入、付費或限定官方 App，請在章節 WebView 確認");
        if (rows.length > 4000 || rows.some(image => typeof image !== "string" || !mhImage(image))) throw mhError("IMAGE-HOST", "站方圖片網址格式已變更，請回報章節網址");
        return pages(rows.map(mhImage));
    }
}
