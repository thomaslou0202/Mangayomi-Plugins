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
