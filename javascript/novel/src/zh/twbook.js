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
const TW_FONT_MAP = {"괗":"二","굛":"十","굜":"丁","궝":"七","귷":"八","그":"人","극":"入","깇":"九","깊":"了","꺅":"刀","꺆":"力","꺗":"又","꺘":"三","꺛":"干","꺱":"士","꺲":"工","꺳":"才","꺴":"寸","꺵":"丈","꺶":"大","껗":"上","께":"小","껙":"口","껚":"山","껛":"巾","껜":"千","껡":"亡","껣":"之","껥":"已","껦":"弓","껧":"己","껩":"也","꼆":"乞","꼇":"川","꼊":"么","꼋":"久","꼌":"勺","꼍":"丸","꼎":"凡","꼐":"及","꽗":"叉","꽬":"夫","꽭":"天","꽮":"元","꽱":"扎","꾉":"五","꾊":"支","꾦":"犬","꾨":"尤","꾩":"匹","꾫":"巨","꾬":"牙","꾭":"屯","꾮":"互","꾿":"切","꿀":"止","꿁":"少","꿂":"日","꿗":"中","꿛":"手","꿢":"午","꿤":"升","꿦":"仁","꿧":"片","꿨":"化","꿩":"仇","꿫":"仍","꿭":"斤","꿮":"爪","꿯":"反","꿰":"介","꿵":"父","꿷":"今","꿸":"凶","꿹":"乏","꿻":"氏","뀐":"欠","뀑":"丹","뀔":"勾","뀖":"六","뀗":"文","뀘":"方","뀙":"火","뀞":"心","뀟":"尺","뀧":"巴","뀪":"以","뀫":"允","뀬":"予","냪":"幻","냫":"玉","냬":"末","냭":"未","녈":"打","녉":"巧","녊":"正","녌":"功","녍":"扔","녠":"甘","녡":"世","녢":"古","녤":"本","녦":"可","녧":"丙","녨":"左","녪":"石","녿":"右","놀":"布","놂":"平","놅":"的","놆":"是","놇":"在","놊":"不","놋":"有","놌":"和","놖":"我","놘":"由","놙":"只","놚":"要","놛":"他","뇽":"叫","뇾":"用","눁":"四","눂":"失","눃":"生","누":"到","눑":"代","눒":"作","눓":"地","눕":"出","늀":"就","늁":"分","늂":"乎","늄":"令","늅":"成","늉":"句","늌":"外","늳":"冬","늵":"包","덿":"主","뎀":"市","뎃":"年","돗":"它","땡":"百","땢":"同","땣":"能","땤":"而","떘":"下","떚":"子"};
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
