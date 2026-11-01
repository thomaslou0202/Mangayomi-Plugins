/* Linovelib Traditional Chinese public pages. Original code: MIT. */
const mangayomiSources = [{
    name: "嗶哩輕小說（繁體）", id: 1827634460, lang: "zh", baseUrl: "https://tw.linovelib.com", apiUrl: "",
    iconUrl: "https://tw.linovelib.com/favicon.ico", typeSource: "single", itemType: 2, isManga: false,
    sourceCodeLanguage: 1, version: "0.1.0", appMinVerReq: "0.9.9", pkgPath: "novel/src/zh/linovelib.js",
    hasCloudflare: true, isNsfw: false, notes: "繁體文庫、最新更新、站方 Google 搜尋、分卷目錄、章內分頁與插圖。僅提供網站正常開放的章節。"
}];
const N_SITE = {name: "嗶哩輕小說", code: "LN", base: "https://tw.linovelib.com", hosts: ["tw.linovelib.com"], images: ["tw.linovelib.com", "img3.readpai.com"]};
/*__COMMON__*/
function lvBook(base, value) {
    const url = nAbsolute(base, value);
    if (!nTrusted(url)) return "";
    const match = /^https:\/\/tw\.linovelib\.com\/novel\/([1-9]\d*)\.html(?:[?#].*)?$/.exec(url);
    return match ? N_SITE.base + "/novel/" + match[1] + ".html" : "";
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
    _page(url, options) {
        const task = this.pageQueue.then(async () => {
            if (!nTrusted(url)) throw nError("URL", "請使用嗶哩繁體站網址");
            let response;
            try { response = await this.client.get(url, this.getHeaders()); } catch (_) { /* Normal browser fallback. */ }
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
    _chapters(html, bookId) {
        const document = new Document(html), entries = [];
        for (const volume of document.select("#volumes .catalog-volume")) {
            const label = nText(volume, ".chapter-bar h3");
            for (const anchor of volume.select("li.jsChapter a[href]")) {
                const chapter = lvPart(N_SITE.base, anchor.attr("href"), bookId), title = nClean(anchor.text);
                if (chapter && chapter.part === 1 && title) entries.push({name: (label ? label + " · " : "") + title, url: chapter.url});
            }
        }
        return nNumberChapters(entries);
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
        return {name, link: book, author: nClean(meta("og:novel:author")), imageUrl: nImage(result.url, meta("og:image")), description: nPlain(meta("og:description")), genre: [nClean(meta("og:novel:category"))].filter(Boolean), status: /完結|完结|完本/.test(meta("og:novel:status")) ? 1 : /連載|连载/.test(meta("og:novel:status")) ? 0 : 5, chapters: this._chapters(toc.html, id)};
    }
    async getHtmlContent(name, url) {
        const first = lvPart(N_SITE.base, url);
        if (!first) throw nError("URL", "章節網址格式錯誤");
        const seen = new Set(), output = []; let current = first;
        while (current && seen.size < 100) {
            if (seen.has(current.url)) throw nError("PAGES", "章內分頁重複，請回報作品網址");
            seen.add(current.url);
            const result = await this._page(current.url, {ready: "#acontent"}), document = new Document(result.html), actual = lvPart(N_SITE.base, result.url), params = lvParams(document, result.params);
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
