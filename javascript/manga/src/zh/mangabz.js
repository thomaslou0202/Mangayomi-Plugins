/* Original Mangabz public web reader source. MIT. */
const mangayomiSources = [{
    name: "Mangabz", id: 1827634458, lang: "zh", baseUrl: "https://www.mangabz.com", apiUrl: "",
    iconUrl: "https://www.mangabz.com/favicon.ico", typeSource: "single", itemType: 0, isManga: true,
    sourceCodeLanguage: 1, version: "0.1.0", appMinVerReq: "0.9.9", pkgPath: "manga/src/zh/mangabz.js",
    hasCloudflare: true, isNsfw: false,
    notes: "支援熱門、最新、站方搜尋、隱藏章節目錄及網頁可讀圖片。沿用原站作品及章節 ID。網站驗證請在來源 WebView 完成。"
}];
const BZ_BASE = "https://www.mangabz.com";
function bzError(code, text) { return new Error("Mangabz：" + text + "（BZ-" + code + "）。"); }
function bzClean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function bzFirst(scope, selector) { const nodes = scope.select(selector); return nodes.length ? nodes[0] : null; }
function bzText(scope, selector) { const node = bzFirst(scope, selector); return node ? bzClean(node.text) : ""; }
function bzAbsolute(value) {
    const raw = String(value || "").trim().replace(/&amp;/gi, "&");
    if (!raw || /[\u0000-\u0020\\]/.test(raw)) return "";
    if (raw.startsWith("//")) return "https:" + raw;
    if (/^https?:\/\//i.test(raw)) return raw.replace(/^http:/i, "https:");
    return raw[0] === "/" ? BZ_BASE + raw : "";
}
function bzSite(value) { return /^https:\/\/www\.mangabz\.com(?:[/?#]|$)/i.test(String(value)) && !/[\u0000-\u0020\\]/.test(String(value)); }
function bzComic(value) { const m = /^https:\/\/www\.mangabz\.com\/([1-9]\d*)bz\/?(?:[?#].*)?$/i.exec(bzAbsolute(value)); return m ? BZ_BASE + "/" + m[1] + "bz/" : ""; }
function bzChapter(value) { const m = /^https:\/\/www\.mangabz\.com\/m([1-9]\d*)\/?(?:[?#].*)?$/i.exec(bzAbsolute(value)); return m ? BZ_BASE + "/m" + m[1] + "/" : ""; }
function bzImage(value) { const url = bzAbsolute(value); return /^https:\/\/(?:[a-z0-9-]+\.)*mangabz\.com\/[^\s\\#]+$/i.test(url) ? url : ""; }
function bzChallenge(html) { return /<title[^>]*>\s*(?:Just a moment|Attention Required)/i.test(html) || /\bid=["'](?:challenge-form|challenge-running)["']/i.test(html); }
function bzPage(value) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 && n < 10000 ? n : 1; }
function bzForm(fields) { return Object.keys(fields).map(key => encodeURIComponent(key) + "=" + encodeURIComponent(String(fields[key]))).join("&"); }
// Read string literals as data. Chapter scripts are never evaluated here.
function bzString(text, start) {
    const quote = text[start]; if (quote !== "'" && quote !== '"') throw bzError("IMAGES", "圖片清單格式已變更");
    let value = "", index = start + 1;
    while (index < text.length) {
        const char = text[index++];
        if (char === quote) return {value, end: index};
        if (char !== "\\") { value += char; continue; }
        const escaped = text[index++];
        if (escaped === "u" || escaped === "x") {
            const size = escaped === "u" ? 4 : 2, hex = text.slice(index, index + size);
            if (hex.length !== size || !/^[a-f0-9]+$/i.test(hex)) throw bzError("IMAGES", "圖片網址跳脫格式已變更");
            value += String.fromCharCode(parseInt(hex, 16)); index += size;
        } else if (escaped === "\n") { /* line continuation */ }
        else if (escaped === "\r") { if (text[index] === "\n") index++; }
        else {
            const escapes = {n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\u0000"};
            if (escaped === undefined) throw bzError("IMAGES", "圖片清單字串不完整");
            value += Object.prototype.hasOwnProperty.call(escapes, escaped) ? escapes[escaped] : escaped;
        }
    }
    throw bzError("IMAGES", "圖片清單字串不完整");
}
// Decode the public reader's standard packed string table as text. In large
// chapters dictionary indexes have multiple base-62 digits (e.g. "6k").
function bzUnpack(script) {
    const start = /return\s+p;\s*}\s*\(\s*/.exec(script); if (!start || script.length > 2000000) return "";
    let index = start.index + start[0].length;
    const payload = bzString(script, index); index = payload.end;
    const numbers = /^\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*/.exec(script.slice(index)); if (!numbers) return "";
    const radix = Number(numbers[1]), count = Number(numbers[2]);
    if (radix < 2 || radix > 62 || count < 1 || count > 20000) return "";
    index += numbers[0].length;
    const words = bzString(script, index);
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
function bzLiteral(script, name) {
    const match = new RegExp("\\b(?:var\\s+)?" + name + "\\s*=\\s*").exec(script);
    if (!match) throw bzError("IMAGES", "圖片資料格式已變更");
    return bzString(script, match.index + match[0].length).value;
}
function bzImages(packed, chapterId) {
    const script = /^\s*eval\(function\(p,a,c,k,e,/.test(packed) ? bzUnpack(packed) : packed;
    if (!script || script.length > 2000000) throw bzError("IMAGES", "圖片清單無法解析");
    const cid = /\bvar\s+cid\s*=\s*(\d+)\s*;/.exec(script);
    if (!cid || cid[1] !== chapterId) throw bzError("CHAPTER", "圖片介面沒有回到指定章節");
    const prefix = bzLiteral(script, "pix"), match = /\bvar\s+pvalue\s*=\s*\[/.exec(script);
    if (!match) throw bzError("IMAGES", "圖片清單格式已變更");
    const files = []; let index = match.index + match[0].length;
    while (index < script.length && files.length < 20) {
        while (/\s/.test(script[index] || "!")) index++;
        if (script[index] === "]") break;
        const item = bzString(script, index); files.push(item.value); index = item.end;
        while (/\s/.test(script[index] || "!")) index++;
        if (script[index] === ",") index++;
        else if (script[index] !== "]") throw bzError("IMAGES", "圖片清單含有非網址資料");
    }
    if (!files.length || script[index] !== "]") throw bzError("IMAGES", "圖片清單不完整");
    const assignment = /\bpvalue\[i\]\s*=\s*pix\s*\+\s*pvalue\[i\]\s*\+\s*/.exec(script);
    if (!assignment) throw bzError("IMAGES", "圖片網址組合格式已變更");
    const suffix = bzString(script, assignment.index + assignment[0].length);
    if (!/^\s*[;}]/.test(script.slice(suffix.end))) throw bzError("IMAGES", "圖片網址含有不支援的運算");
    return files.map(file => {
        if (!/^\/[^?#\s\\]+\.(?:jpe?g|png|webp|gif)$/i.test(file)) throw bzError("IMAGE-HOST", "圖片路徑格式已變更");
        const url = bzImage(prefix + file + suffix.value);
        if (!url || !new RegExp("[?&]cid=" + chapterId + "(?:&|$)").test(url)) throw bzError("IMAGE-HOST", "圖片網域或章節編號不符");
        return url;
    });
}
function bzBrowserScript(endpoint) {
    async function capture(endpoint) {
        const bridge = window.flutter_inappwebview;
        if (!bridge || typeof bridge.callHandler !== "function") return;
        const reply = data => bridge.callHandler("setResponse", JSON.stringify(data));
        try {
            const view = new URL(location.href);
            if (view.origin !== "https://www.mangabz.com" || view.username || view.password) return reply({kind: "outside"});
            if (bzChallenge(document.documentElement.outerHTML)) return reply({kind: "challenge"});
            if (endpoint) {
                const target = new URL(endpoint);
                if (target.origin !== view.origin || target.username || target.password) return reply({kind: "outside"});
                const response = await fetch(target.href, {credentials: "same-origin", headers: {"X-Requested-With": "XMLHttpRequest"}});
                return reply({kind: "page", url: response.url, status: response.status, body: await response.text()});
            }
            const copy = document.documentElement.cloneNode(true);
            for (const node of copy.querySelectorAll("form,input,textarea,iframe,object,embed")) node.remove();
            return reply({kind: "page", url: location.href, status: 200, body: copy.outerHTML});
        } catch (_) { return reply({kind: "error"}); }
    }
    return "(function(){const bzChallenge=" + bzChallenge.toString() + ";return (" + capture.toString() + ")(" + JSON.stringify(endpoint || "") + ");})()";
}
class DefaultExtension extends MProvider {
    constructor() { super(); this.client = new Client(); this.browserQueue = Promise.resolve(); }
    get supportsLatest() { return true; }
    getHeaders(url) {
        const headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36", Origin: BZ_BASE};
        // Keep PageUrl's chapter Referer when the reader merges source headers.
        if (bzSite(url) && !/^https:\/\/www\.mangabz\.com\/?(?:[?#].*)?$/i.test(url)) headers.Referer = url;
        return headers;
    }
    getFilterList() { return []; }
    getSourcePreferences() { return []; }
    _response(response) {
        if (Number(response.statusCode) === 429) throw bzError("RATE", "網站限制請求頻率，請稍後再試");
        if (Number(response.statusCode) === 403 || bzChallenge(String(response.body || ""))) throw bzError("CHALLENGE", "請在來源 WebView 手動完成網站驗證後重試");
        if (Number(response.statusCode) !== 200 || typeof response.body !== "string" || !response.body.trim()) throw bzError("HTTP", "網站暫時無法讀取");
        return response;
    }
    async _browser(view, endpoint) {
        if (!bzSite(view) || (endpoint && !bzSite(endpoint)) || typeof evaluateJavascriptViaWebview !== "function") throw bzError("WEBVIEW", "請在來源 WebView 確認網頁可開啟");
        const task = this.browserQueue.then(async () => {
            let data;
            try { data = JSON.parse(await evaluateJavascriptViaWebview(view, this.getHeaders(view), [bzBrowserScript(endpoint)], 30)); }
            catch (_) { throw bzError("WEBVIEW", "內建網頁讀取失敗"); }
            if (data && data.kind === "challenge") throw bzError("CHALLENGE", "請在來源 WebView 手動完成網站驗證後重試");
            if (!data || data.kind !== "page" || !bzSite(data.url) || typeof data.body !== "string") throw bzError("WEBVIEW", "未取得本站網頁");
            return this._response({body: data.body, statusCode: Number(data.status || 200), request: {url: data.url}});
        });
        this.browserQueue = task.catch(() => {}); return task;
    }
    async _get(url, view) {
        if (!bzSite(url)) throw bzError("URL", "只接受 Mangabz 網址");
        let response;
        try { response = await this.client.get(url, {...this.getHeaders(view || url), ...(view ? {"X-Requested-With": "XMLHttpRequest"} : {})}); }
        catch (_) { response = await this._browser(view || url, view ? url : ""); }
        if (Number(response.statusCode) === 403 || bzChallenge(String(response.body || ""))) response = await this._browser(view || url, view ? url : "");
        this._response(response);
        const actual = response.request && response.request.url || url;
        if (!bzSite(actual) || actual.split(/[?#]/)[0].replace(/\/$/, "") !== url.split(/[?#]/)[0].replace(/\/$/, "")) throw bzError("URL", "網站轉到其他頁面");
        return response.body;
    }
    async _list(url, page) {
        const html = await this._get(url), doc = new Document(html), seen = new Set(), list = [];
        for (const row of doc.select(".mh-list .mh-item")) {
            const anchor = bzFirst(row, ".title a"), image = bzFirst(row, "img.mh-cover");
            const link = anchor ? bzComic(anchor.attr("href")) : "", name = anchor ? bzClean(anchor.text) : "";
            if (!link || !name || seen.has(link)) continue;
            seen.add(link); list.push({name, link, imageUrl: image ? bzImage(image.attr("src")) : ""});
        }
        if (!list.length && !doc.select(".result-title").length) throw bzError("LIST", "未辨識到漫畫清單");
        const hasNextPage = doc.select(".page-pagination a").some(a => {
            const href = String(a.attr("href") || "").replace(/&amp;/g, "&");
            const queryPage = /^\/search\?/.test(href) ? /[?&]page=(\d+)(?:&|$)/.exec(href) : null;
            return Number(a.attr("data-index") || (queryPage ? queryPage[1] : 0)) > page;
        });
        return {list, hasNextPage};
    }
    async getPopular(page) { page = bzPage(page); return this._list(BZ_BASE + "/manga-list" + (page > 1 ? "-p" + page : "") + "/", page); }
    async getLatestUpdates(page) { page = bzPage(page); return this._list(BZ_BASE + "/manga-list-0-0-2" + (page > 1 ? "-p" + page : "") + "/", page); }
    async search(query, page) { query = bzClean(query); if (!query) return {list: [], hasNextPage: false}; page = bzPage(page); return this._list(BZ_BASE + "/search?title=" + encodeURIComponent(query) + "&page=" + page, page); }
    async getDetail(url) {
        const link = bzComic(url); if (!link) throw bzError("URL", "作品網址格式錯誤");
        const html = await this._get(link), doc = new Document(html), name = bzText(doc, ".detail-info-title");
        const identity = /\bMANGABZ_COMIC_MID\s*=\s*(\d+)/.exec(html);
        if (!name || !identity || BZ_BASE + "/" + identity[1] + "bz/" !== link) throw bzError("DETAIL", "未取得指定作品資料");
        const seen = new Set(), ordered = [];
        for (const a of doc.select("#chapterlistload a")) {
            const chapter = bzChapter(a.attr("href")), title = bzClean(a.text).replace(/\s*[（(]\s*\d+\s*P\s*[）)]\s*$/i, "").trim();
            if (!chapter || !title || seen.has(chapter)) continue;
            seen.add(chapter); ordered.push({url: chapter, title});
        }
        if (!ordered.length) throw bzError("CHAPTERS", "未取得可讀章節，請在作品 WebView 確認");
        const ascending = /\bMANGABZ_COMIC_SORT\s*=\s*1\s*;/.test(html);
        if (!ascending) ordered.reverse();
        const width = Math.max(4, String(ordered.length).length), image = bzFirst(doc, ".detail-info-cover");
        const chapters = ordered.map((c, i) => ({url: c.url, name: String(i + 1).padStart(width, "0") + "｜" + c.title.replace(/[0-9]/g, d => String.fromCharCode(d.charCodeAt(0) + 0xfee0)), scanlator: "", dateUpload: ""})).reverse();
        const info = bzText(doc, ".detail-info-tip");
        return {name, link, imageUrl: image ? bzImage(image.attr("src")) : "", author: bzText(doc, '.detail-info-tip a[href*="search"]'), artist: "", description: bzText(doc, ".detail-info-content").replace(/\[[+-](?:展開|折疊)\]/g, ""), genre: doc.select(".detail-info-tip .item").map(n => bzClean(n.text)), status: /完[结結]/.test(info) ? 1 : /[连連][载載]/.test(info) ? 0 : 5, chapters};
    }
    async getPageList(url) {
        const chapter = bzChapter(url); if (!chapter) throw bzError("URL", "章節網址格式錯誤");
        const html = await this._get(chapter), id = /\/m(\d+)\//.exec(chapter)[1];
        const number = name => { const m = new RegExp("\\b" + name + "\\s*=\\s*[\"']?(\\d+)").exec(html); return m ? m[1] : ""; };
        if (number("MANGABZ_CID") !== id) throw bzError("CHAPTER", "網站沒有回到指定章節");
        const count = Number(number("MANGABZ_IMAGE_COUNT")), mid = number("MANGABZ_MID");
        if (!Number.isSafeInteger(count) || count < 1 || count > 4000 || !mid) throw bzError("IMAGES", "未取得圖片張數，可能需要登入或網站未提供圖片");
        const dt = bzLiteral(html, "MANGABZ_VIEWSIGN_DT"), sign = bzLiteral(html, "MANGABZ_VIEWSIGN");
        const pages = [], seen = new Set();
        for (let page = 1; page <= count;) {
            const endpoint = chapter + "chapterimage.ashx?" + bzForm({cid: id, page, key: "", _cid: id, _mid: mid, _dt: dt, _sign: sign});
            const images = bzImages(await this._get(endpoint, chapter), id).slice(0, count - pages.length);
            if (!images.length || images.some(image => seen.has(image))) throw bzError("INCOMPLETE", "圖片清單不完整，請重新開啟章節");
            for (const image of images) { seen.add(image); pages.push({url: image, headers: this.getHeaders(chapter)}); }
            page = pages.length + 1;
        }
        if (pages.length !== count) throw bzError("INCOMPLETE", "未取得全部圖片");
        return pages;
    }
}
