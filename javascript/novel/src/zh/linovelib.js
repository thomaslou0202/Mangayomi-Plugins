/* Linovelib Traditional Chinese public pages. Original code: MIT. */
const mangayomiSources = [{
    name: "嗶哩輕小說（繁體）", id: 1827634460, lang: "zh", baseUrl: "https://tw.linovelib.com", apiUrl: "",
    iconUrl: "https://tw.linovelib.com/favicon.ico", typeSource: "single", itemType: 2, isManga: false,
    sourceCodeLanguage: 1, version: "0.1.3", appMinVerReq: "0.9.9", pkgPath: "novel/src/zh/linovelib.js",
    hasCloudflare: true, isNsfw: false, notes: "繁體文庫、最新更新、站方 Google 搜尋、分卷目錄、章內分頁與插圖。僅提供網站正常開放的章節。"
}];
const N_SITE = {name: "嗶哩輕小說", code: "LN", base: "https://tw.linovelib.com", hosts: ["tw.linovelib.com"], images: ["tw.linovelib.com", "img3.readpai.com"]};
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

function lvBook(base, value) {
    const url = nAbsolute(base, value);
    if (!nTrusted(url)) return "";
    const match = /^https:\/\/tw\.linovelib\.com\/novel\/([1-9]\d*)\.html(?:[?#].*)?$/.exec(url);
    return match ? N_SITE.base + "/novel/" + match[1] + ".html" : "";
}
function lvWithoutBookName(value, bookName) {
    const label = nClean(value);
    const canonical = text => String(text || "").replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/〜/g, "~").replace(/\s/g, "");
    const target = canonical(bookName);
    if (!target) return label;
    let prefix = "", length = 0;
    for (const c of label) {
        prefix += canonical(c); length += c.length;
        if (prefix === target) {
            const rest = label.slice(length);
            // Match the whole book name at a label boundary, not a shared
            // prefix of a different title. Preserve the actual chapter text.
            if (!rest || /^[\s·:：—－-]|^(?:第|[0-9０-９])/.test(rest)) return nClean(rest.replace(/^[\s·:：—－-]+/, ""));
            return label;
        }
        if (!target.startsWith(prefix)) return label;
    }
    return label;
}
function lvVolumeLabel(value) {
    const label = nClean(value);
    // Only a volume heading's leading integer is converted. Numbers in the
    // chapter name, book name, dates or the global sorting prefix stay intact.
    const match = /^(?:第\s*)?([0-9０-９]{1,4})(?:\s*(?:卷|巻|冊|册)|(?=\s|$))\s*(.*)$/.exec(label);
    if (!match) return label;
    const number = Number(match[1].replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
    const digits = String(number), names = "零一二三四五六七八九", units = ["", "十", "百", "千"];
    let chinese = "", zero = false;
    for (let i = 0; i < digits.length; i++) {
        const digit = Number(digits[i]), place = digits.length - i - 1;
        if (!digit) { if (chinese) zero = true; continue; }
        if (zero) chinese += "零";
        if (!(digit === 1 && place === 1 && !chinese)) chinese += names[digit];
        chinese += units[place]; zero = false;
    }
    return "第" + (chinese || "零") + "卷" + (match[2] ? " " + match[2] : "");
}
function lvPart(base, value, bookId) {
    const url = nAbsolute(base, value);
    if (!nTrusted(url)) return null;
    const match = /^https:\/\/tw\.linovelib\.com\/novel\/([1-9]\d*)\/([1-9]\d*)(?:_([1-9]\d*))?\.html(?:[?#].*)?$/.exec(url);
    if (!match || (bookId && match[1] !== bookId)) return null;
    const part = Number(match[3] || 1);
    return {book: match[1], chapter: match[2], part, url: N_SITE.base + "/novel/" + match[1] + "/" + match[2] + (part > 1 ? "_" + part : "") + ".html"};
}
function lvParams(document, captured) {
    if (captured && typeof captured === "object") return captured;
    const script = document.select("script").map(node => node.text).find(text => /\bvar\s+ReadParams\s*=/.test(text));
    if (!script) throw nError("PARAMS", "未取得章節資料，請在來源內建網頁確認");
    const params = {}, keys = "url_next|url_index|articleid|chapterid|page|chapterisvip";
    const pattern = new RegExp("\\b(" + keys + ")\\s*:\\s*(['\"])([^'\"\\\\]*)\\2", "g");
    for (const match of script.matchAll(pattern)) params[match[1]] = match[3];
    return params;
}
function lvCapture(options) {
    const bridge = window.flutter_inappwebview, once = "__linovel_" + options.nonce;
    if (!bridge || window[once]) return;
    window[once] = true;
    const started = Date.now();
    const reply = (kind, extra) => bridge.callHandler("setResponse", JSON.stringify(Object.assign({kind, url: location.href}, extra || {})));
    function capture() {
        try {
            const url = new URL(location.href);
            if (url.protocol !== "https:" || !options.hosts.includes(url.hostname) || url.username || url.password || (url.port && url.port !== "443")) return reply("outside");
            if (nChallenge(document.documentElement.outerHTML)) return reply("challenge");
            const ready = document.querySelector(options.ready);
            if ((!ready || (!ready.textContent.trim() && !ready.querySelector("img"))) && Date.now() - started < 18000) return setTimeout(capture, 250);
            if (!ready) return reply("empty");
            if (options.searchPage && !document.querySelector(".gs-no-results-result")) {
                const active = document.querySelector(".gsc-cursor-current-page"), current = Number(active && active.textContent.trim());
                if (((current && current !== options.searchPage) || (!current && options.searchPage > 1)) && Date.now() - started < 18000) return setTimeout(capture, 250);
            }
            const params = {};
            if (typeof window.ReadParams === "object" && window.ReadParams) for (const key of ["url_next", "url_index", "articleid", "chapterid", "page", "chapterisvip"]) if (window.ReadParams[key] !== undefined) params[key] = String(window.ReadParams[key]);
            const copy = document.documentElement.cloneNode(true);
            for (const node of copy.querySelectorAll("script,style,iframe,object,embed,noscript,form,input,textarea,button,select,.adsbygoogle")) node.remove();
            return reply("page", {html: copy.outerHTML, params});
        } catch (_) { return reply("browser-error"); }
    }
    capture();
}
class DefaultExtension extends NativeNovel {
    constructor() { super(); this.client = new Client({timeout: 25, connectTimeout: 10}); }
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: N_SITE.base + "/", "Accept-Language": "zh-TW,zh;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"}; }
    async _capture(url, ready, search, searchPage) {
        const hosts = search ? ["cse.google.com"] : N_SITE.hosts;
        if (!nAllowed(url, hosts)) throw nError("URL", "網址不在支援的網站內");
        const options = {hosts, ready, searchPage: searchPage || 0, nonce: Date.now().toString(36) + Math.random().toString(36).slice(2)};
        const script = "(function(){const nChallenge=" + nChallenge.toString() + ";return (" + lvCapture.toString() + ")(" + JSON.stringify(options) + ");})()";
        let result;
        try { result = JSON.parse(await evaluateJavascriptViaWebview(url, search ? {} : this.getHeaders(), [script], 30)); }
        catch (_) { throw nError("BROWSER", "內建網頁讀取失敗，請在來源內建網頁確認後重試"); }
        if (!result || !nAllowed(result.url || "", hosts)) throw nError("URL", "網頁離開指定來源，請確認網站轉址");
        if (result.kind === "challenge") throw nError("VERIFY", "請在內建網頁手動完成網站驗證後重試");
        if (result.kind !== "page" || typeof result.html !== "string") throw nError("EMPTY", search ? "站方搜尋尚未取得結果，請稍後重試，或直接搜尋作品網址／ID" : "未取得頁面內容，請在來源內建網頁確認");
        return result;
    }
    async _get(url) {
        // Retry only temporary transport/server failures. Authorization,
        // missing pages and rate limits continue through the normal handling.
        for (let attempt = 0; attempt < 2; attempt++) {
            let response;
            try { response = await this.client.get(url, this.getHeaders()); }
            catch (_) { if (attempt) return null; }
            if (response && ![502, 503, 504].includes(Number(response.statusCode))) return response;
            if (attempt) return response;
            await new Promise(resolve => setTimeout(resolve, 400));
        }
    }
    _page(url, options) {
        const task = this.pageQueue.then(async () => {
            if (!nTrusted(url)) throw nError("URL", "請使用嗶哩繁體站網址");
            const response = await this._get(url);
            if (response) {
                const actual = response.request && response.request.url || url;
                if (!nTrusted(actual)) throw nError("URL", "網站轉到了其他網域");
                if (Number(response.statusCode) === 429) throw nError("RATE", "網站請求過於頻繁，請稍後重試");
                if (Number(response.statusCode) === 404) throw nError("NOT-FOUND", "作品或章節不存在");
                if (Number(response.statusCode) === 200 && typeof response.body === "string" && !nChallenge(response.body)) {
                    let html = response.body;
                    if (/[\u0080-\u00ff]/.test(html) && !/[^\u0000-\u00ff]/.test(html)) try { html = decodeURIComponent(Array.from(html, c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")); } catch (_) {}
                    if (nFirst(new Document(html), options.ready)) return {html, url: actual};
                }
            }
            return this._capture(url, options.ready, false);
        });
        this.pageQueue = task.catch(() => {}); return task;
    }
    _list(html, url, page) {
        const document = new Document(html), list = [], seen = new Set();
        for (const card of document.select("a.book-layout[href]")) {
            const link = lvBook(url, card.attr("href")), image = nFirst(card, "img"), name = nClean(image && image.attr("alt") || nText(card, ".book-title"));
            if (!link || !name || seen.has(link)) continue;
            seen.add(link); list.push({name, link, imageUrl: image ? nImage(url, image.attr("data-src") || image.attr("src")) : ""});
        }
        if (!list.length) throw nError("LIST", "未辨識到文庫清單，請在來源內建網頁確認");
        const hasNextPage = document.select('a[href*="/wenku/"]').some(anchor => {
            const target = nAbsolute(url, anchor.attr("href")), next = /\/wenku\/(?:lastupdate|allvisit)_(?:\d+_){7}(\d+)_\d+\.html$/.exec(target);
            return nTrusted(target) && !!next && Number(next[1]) > page;
        });
        return {list, hasNextPage};
    }
    async _catalogue(page, order) {
        page = nPage(page);
        const url = N_SITE.base + "/wenku/" + order + "_0_0_0_0_0_0_0_" + page + "_0.html";
        const result = await this._page(url, {ready: "a.book-layout"});
        return this._list(result.html, result.url, page);
    }
    getPopular(page) { return this._catalogue(page, "allvisit"); }
    getLatestUpdates(page) { return this._catalogue(page, "lastupdate"); }
    async search(query, page) {
        query = String(query || "").trim(); page = nPage(page);
        if (!query) return {list: [], hasNextPage: false};
        const direct = lvBook(N_SITE.base + "/", /^\d+$/.test(query) ? "/novel/" + query + ".html" : query);
        if (direct) { if (page > 1) return {list: [], hasNextPage: false}; const detail = await this.getDetail(direct); return {list: [{name: detail.name, link: direct, imageUrl: detail.imageUrl}], hasNextPage: false}; }
        const encoded = encodeURIComponent(query), url = "https://cse.google.com/cse?cx=649de34f5e63448cb&q=" + encoded + "#gsc.tab=0&gsc.q=" + encoded + "&gsc.page=" + page;
        const result = await this._capture(url, ".gsc-webResult a.gs-title,.gs-no-results-result", true, page), document = new Document(result.html), list = [], seen = new Set();
        const active = Number(nText(document, ".gsc-cursor-current-page"));
        if (active && active !== page) throw nError("SEARCH-PAGE", "站方搜尋頁碼不符，請重新整理");
        for (const anchor of document.select(".gsc-webResult a.gs-title")) {
            const link = lvBook(N_SITE.base, anchor.attr("data-ctorig") || anchor.attr("href")), name = nClean(anchor.text).replace(/\s*[-_－]\s*嗶哩輕小說.*$/, "");
            if (!link || !name || seen.has(link)) continue;
            seen.add(link); const id = /\/novel\/(\d+)\.html$/.exec(link)[1];
            list.push({name, link, imageUrl: N_SITE.base + "/files/article/image/" + Math.floor(Number(id) / 1000) + "/" + id + "/" + id + "s.jpg"});
        }
        if (!list.length && !nFirst(document, ".gs-no-results-result") && !nFirst(document, ".gsc-webResult")) throw nError("SEARCH", "未取得站方搜尋結果，請稍後重試");
        return {list, hasNextPage: document.select(".gsc-cursor-page").some(node => Number(nClean(node.text)) > page)};
    }
    _chapters(html, bookId, bookName) {
        const document = new Document(html), entries = [];
        for (const volume of document.select("#volumes .catalog-volume")) {
            const label = lvVolumeLabel(lvWithoutBookName(nText(volume, ".chapter-bar h3"), bookName));
            for (const anchor of volume.select("li.jsChapter a[href]")) {
                const chapter = lvPart(N_SITE.base, anchor.attr("href"), bookId), originalTitle = nClean(anchor.text), title = lvWithoutBookName(originalTitle, bookName) || originalTitle;
                if (chapter && chapter.part === 1 && title) entries.push({name: (label ? label + " " : "") + title, url: chapter.url});
            }
        }
        return nNumberChapters(entries).map(chapter => ({...chapter,
            // Preserve the global sorting prefix and number-recognition
            // protection on the chapter text.
            name: chapter.name.replace(/^([0-9]+)｜/, "$1 | ")
        }));
    }
    async getDetail(url) {
        const book = lvBook(N_SITE.base + "/", url);
        if (!book) throw nError("URL", "請使用嗶哩繁體站的作品網址");
        const id = /\/novel\/(\d+)\.html$/.exec(book)[1], result = await this._page(book, {ready: "h1"}), document = new Document(result.html);
        if (lvBook(N_SITE.base, result.url) !== book) throw nError("BOOK", "網站未回到指定作品");
        const meta = key => nAttr(document, 'meta[property="' + key + '"]', "content"), name = nClean(meta("og:title"));
        if (!name) throw nError("DETAIL", "未辨識到作品資料");
        const catalogue = N_SITE.base + "/novel/" + id + "/catalog", toc = await this._page(catalogue, {ready: "#volumes .jsChapter"});
        if (toc.url.split(/[?#]/)[0].replace(/\/$/, "") !== catalogue) throw nError("TOC", "網站未回到指定目錄");
        return {name, link: book, author: nClean(meta("og:novel:author")), imageUrl: nImage(result.url, meta("og:image")), description: nPlain(meta("og:description")), genre: [nClean(meta("og:novel:category"))].filter(Boolean), status: /完結|完结|完本/.test(meta("og:novel:status")) ? 1 : /連載|连载/.test(meta("og:novel:status")) ? 0 : 5, chapters: this._chapters(toc.html, id, name)};
    }
    async _chapterPage(url) {
        // Some reader pages return HTTP 200 with a temporary loading error.
        // Retry that same subpage, never append a placeholder or skip ahead.
        for (let attempt = 0; attempt < 3; attempt++) {
            const result = await this._page(url, {ready: "#acontent"});
            const content = nFirst(new Document(result.html), "#acontent");
            const text = nClean(content && content.text).replace(/[\s，。！!：:….,]/g, "");
            const failed = content && !content.select("img").length &&
                /^(?:本章)?(?:內容|内容|正文)(?:加載|加载|載入|读取|讀取)(?:失敗|失败)(?:請|请)?(?:稍後|稍后)?(?:重試|重试|刷新|重新整理)?$/.test(text);
            if (!failed) return result;
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
        throw nError("CONTENT-TEMPORARY", "網站暫時未載入本章內容，請稍後重試");
    }
    async getHtmlContent(name, url) {
        const first = lvPart(N_SITE.base, url);
        if (!first) throw nError("URL", "章節網址格式錯誤");
        const seen = new Set(), output = []; let current = first;
        while (current && seen.size < 100) {
            if (seen.has(current.url)) throw nError("PAGES", "章內分頁重複，請回報作品網址");
            seen.add(current.url);
            const result = await this._chapterPage(current.url), document = new Document(result.html), actual = lvPart(N_SITE.base, result.url), params = lvParams(document, result.params);
            if (!actual || actual.url !== current.url || String(params.articleid) !== first.book || String(params.chapterid) !== first.chapter || Number(params.page) !== current.part) throw nError("CHAPTER", "網站未回傳指定章節分頁");
            if (String(params.chapterisvip) !== "0") throw nError("VIP", "此章節未正常開放，請到網站使用官方閱讀權限");
            const content = nFirst(document, "#acontent");
            if (!content) throw nError("CONTENT", "未取得章節正文");
            output.push(content.innerHtml);
            const next = lvPart(result.url, params.url_next, first.book);
            if (next && next.chapter === first.chapter) {
                if (next.part !== current.part + 1) throw nError("PAGES", "章內分頁不連續，避免遺漏正文請重新整理");
                current = next;
            } else {
                if (params.url_next && !nTrusted(nAbsolute(result.url, params.url_next))) throw nError("PAGES", "下一頁離開指定網站");
                current = null;
            }
        }
        if (current) throw nError("PAGES", "章內分頁超過支援上限");
        return nArticle(name, output.join("\n"), first.url);
    }
}
