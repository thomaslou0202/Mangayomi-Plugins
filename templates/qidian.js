/* Qidian official mobile pages. MIT; OpenCC search data: Apache-2.0. */
const mangayomiSources = [{
    name: "起點中文網（測試版）", id: 1827634459, lang: "zh", baseUrl: "https://m.qidian.com", apiUrl: "",
    iconUrl: "https://m.qidian.com/favicon.ico", typeSource: "single", itemType: 2, isManga: false,
    sourceCodeLanguage: 1, version: "0.1.0", appMinVerReq: "0.9.9", pkgPath: "novel/src/zh/qidian.js",
    hasCloudflare: true, isNsfw: false, notes: "官方手機站、熱門榜、繁簡搜尋、完整分卷目錄及免費正文。付費章節請使用官方網站或 App。"
}];
const N_SITE = {name: "起點中文網", code: "QD", base: "https://m.qidian.com", hosts: ["m.qidian.com", "www.qidian.com", "qidian.com"], images: ["bookcover.yuewen.com", "qidian.qpic.cn"]};
/*__OPENCC_NOTICE__*/
const QD_T2S = /*__T2S_DICT__*/;
const QD_T2S_MAX = /*__T2S_MAX__*/;
/*__COMMON__*/
function qdId(value) { const text = String(value || ""); return /^[1-9]\d{0,14}$/.test(text) ? text : ""; }
function qdBook(value) {
    const url = nAbsolute(N_SITE.base + "/", value);
    if (!nTrusted(url)) return "";
    const match = /^https:\/\/[^/]+\/(?:book\/(\d+)\/?|chapter\/(\d+)\/0\/?)(?:[?#].*)?$/.exec(url);
    const id = match && qdId(match[1] || match[2]);
    return id ? N_SITE.base + "/book/" + id + "/" : "";
}
function qdChapter(value) {
    const url = nAbsolute(N_SITE.base + "/", value);
    if (!nTrusted(url)) return "";
    const match = /^https:\/\/[^/]+\/chapter\/(\d+)\/(\d+)\/?(?:[?#].*)?$/.exec(url);
    return match && qdId(match[1]) && qdId(match[2]) ? N_SITE.base + "/chapter/" + match[1] + "/" + match[2] + "/" : "";
}
function qdSearchText(text) {
    const chars = Array.from(text), output = [];
    for (let index = 0; index < chars.length;) {
        let found = false;
        for (let size = Math.min(QD_T2S_MAX, chars.length - index); size > 0; size--) {
            const key = chars.slice(index, index + size).join("");
            if (Object.prototype.hasOwnProperty.call(QD_T2S, key)) { output.push(QD_T2S[key]); index += size; found = true; break; }
        }
        if (!found) output.push(chars[index++]);
    }
    return output.join("");
}
function qdData(html) {
    const script = nFirst(new Document(html), "#vite-plugin-ssr_pageContext");
    let props;
    try { props = script && JSON.parse(script.text).pageContext.pageProps; } catch (_) { throw nError("FORMAT", "網站資料格式已變更，請更新來源"); }
    if (props && props.is404) throw nError("NOT-FOUND", "作品或章節不存在，請在來源 WebView 確認");
    if (!props || !props.pageData || typeof props.pageData !== "object") throw nError("DATA", "未取得作品資料，請在來源 WebView 確認網站驗證");
    return props.pageData;
}
// Read the normal page's JSON data, without running embedded source strings.
// Return only fields this source needs; account/session data is excluded.
function qdBrowserTask(options) {
    const bridge = window.flutter_inappwebview;
    const once = "__qdSourceCapture_" + options.nonce;
    if (!bridge || window[once]) return;
    window[once] = true;
    const start = Date.now();
    const reply = (kind, html) => bridge.callHandler("setResponse", JSON.stringify({kind, url: location.href, html: html || ""}));
    function capture() {
        try {
            const url = new URL(location.href);
            if (url.protocol !== "https:" || !options.hosts.includes(url.hostname) || url.username || url.password || (url.port && url.port !== "443")) return reply("outside");
            const script = document.getElementById("vite-plugin-ssr_pageContext");
            if (script) {
                const props = JSON.parse(script.textContent).pageContext.pageProps;
                const data = props.pageData || {}, selected = {};
                for (const key of ["bookInfo", "hotRank", "popNovel", "vs", "bookId", "bookName", "chapterTotalCnt", "chapterInfo"]) if (data[key] !== undefined) selected[key] = data[key];
                const json = JSON.stringify({pageContext: {pageProps: {is404: props.is404, pageData: selected}}}).replace(/</g, "\\u003c");
                return reply("page", '<script id="vite-plugin-ssr_pageContext" type="application/json">' + json + '</script>');
            }
            if (Date.now() - start < 18000) return setTimeout(capture, 250);
            return reply("challenge");
        } catch (_) { return reply("browser-error"); }
    }
    capture();
}
class DefaultExtension extends NativeNovel {
    constructor() { super(); this.client = new Client({timeout: 25, connectTimeout: 10}); }
    // Request the mobile layout consistently on Windows and Android.
    getHeaders() { return {Referer: N_SITE.base + "/", "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"}; }
    _page(url) {
        const task = this.pageQueue.then(() => this._fetch(url));
        this.pageQueue = task.catch(() => {}); return task;
    }
    async _fetch(url) {
        if (!nTrusted(url)) throw nError("URL", "網址不在起點網站內");
        let response;
        try { response = await this.client.get(url, this.getHeaders()); } catch (_) { /* Try the normal in-app page. */ }
        if (response) {
            const actual = response.request && response.request.url || url;
            if (!nTrusted(actual)) throw nError("URL", "網頁離開起點網站");
            if (Number(response.statusCode) === 200 && typeof response.body === "string" && /id=["']vite-plugin-ssr_pageContext["']/.test(response.body)) return {url: actual, html: response.body};
            if (Number(response.statusCode) === 404) throw nError("NOT-FOUND", "作品或章節不存在");
            if (Number(response.statusCode) === 429) throw nError("RATE", "網站請求過於頻繁，請稍後重試");
        }
        if (typeof evaluateJavascriptViaWebview !== "function") throw nError("VERIFY", "請在來源 WebView 開啟作品並手動完成驗證後重試");
        let result;
        const options = {hosts: N_SITE.hosts, nonce: Date.now().toString(36) + Math.random().toString(36).slice(2)};
        try { result = JSON.parse(await evaluateJavascriptViaWebview(url, this.getHeaders(), ["(" + qdBrowserTask.toString() + ")(" + JSON.stringify(options) + ");"], 30)); }
        catch (_) { throw nError("BROWSER", "內建網頁讀取失敗，請在來源 WebView 確認後重試"); }
        if (!result || !nTrusted(result.url || "")) throw nError("URL", "內建網頁離開起點網站");
        if (result.kind !== "page" || typeof result.html !== "string") throw nError("VERIFY", "請在來源 WebView 手動完成網站驗證後重試");
        return result;
    }
    _cards(records) {
        const seen = new Set(), list = [];
        for (const record of records) {
            const id = qdId(record.bid), name = nClean(record.bName);
            if (!id || !name || seen.has(id)) continue;
            seen.add(id); list.push({name, link: N_SITE.base + "/book/" + id + "/", imageUrl: nImage(N_SITE.base, record.imgUrl) || "https://bookcover.yuewen.com/qdbimg/349573/" + id + "/180"});
        }
        return list;
    }
    async getPopular(page) {
        if (nPage(page) > 1) return {list: [], hasNextPage: false};
        const result = await this._page(N_SITE.base + "/"), data = qdData(result.html);
        const records = Array.isArray(data.hotRank) ? data.hotRank : data.popNovel;
        if (!Array.isArray(records) || !records.length) throw nError("LIST", "未取得熱門小說清單");
        const list = this._cards(records);
        if (!list.length) throw nError("LIST", "熱門小說資料格式已變更");
        return {list, hasNextPage: false};
    }
    async search(query, page) {
        query = String(query || "").trim(); page = nPage(page);
        if (!query) return {list: [], hasNextPage: false};
        const direct = qdBook(/^\d+$/.test(query) ? "/book/" + query + "/" : query);
        if (direct) {
            if (page > 1) return {list: [], hasNextPage: false};
            const detail = await this.getDetail(direct);
            return {list: [{name: detail.name, link: direct, imageUrl: detail.imageUrl}], hasNextPage: false};
        }
        const url = N_SITE.base + "/soushu/" + encodeURIComponent(qdSearchText(query)) + ".html?pageNum=" + page;
        const result = await this._page(url), info = qdData(result.html).bookInfo;
        if (!info || !Array.isArray(info.records) || Number(info.pageNum) !== page) throw nError("SEARCH", "搜尋頁碼或資料格式不符，請重新整理");
        const list = this._cards(info.records);
        if (info.records.length && !list.length) throw nError("SEARCH", "未辨識到搜尋結果");
        return {list, hasNextPage: list.length > 0 && (info.isLast === 0 || info.isLast === "0" || info.isLast === false) && page * Number(info.pageSize || 20) < Number(info.total)};
    }
    _chapters(data, bookId) {
        if (qdId(data.bookId) !== bookId || !Array.isArray(data.vs)) throw nError("TOC", "未取得指定作品的完整目錄");
        const entries = [];
        for (const volume of data.vs) {
            if (!Array.isArray(volume.cs)) throw nError("TOC", "分卷目錄尚未完整載入");
            for (const chapter of volume.cs) {
                const id = qdId(chapter.id), title = nClean(chapter.cN);
                if (!id || !title) continue;
                const vip = Number(volume.vS) === 1 && Number(chapter.sS) === 0;
                entries.push({url: N_SITE.base + "/chapter/" + bookId + "/" + id + "/", name: (nClean(volume.vN) ? nClean(volume.vN) + " · " : "") + (vip ? "【VIP】" : "") + title});
            }
        }
        if (Number(data.chapterTotalCnt) > new Set(entries.map(item => item.url)).size) throw nError("TOC-INCOMPLETE", "目錄章數不足，請重新整理，避免漏章");
        return nNumberChapters(entries);
    }
    async getDetail(url) {
        const book = qdBook(url);
        if (!book) throw nError("URL", "請使用起點作品網址");
        const id = /\/book\/(\d+)/.exec(book)[1], result = await this._page(book), info = qdData(result.html).bookInfo;
        if (qdBook(result.url) !== book || !info || qdId(info.bookId) !== id || !nClean(info.bookName)) throw nError("DETAIL", "未取得指定作品資料");
        const catalogUrl = book + "catalog/", catalog = await this._page(catalogUrl);
        if (catalog.url.split(/[?#]/)[0].replace(/\/$/, "") !== catalogUrl.replace(/\/$/, "")) throw nError("TOC", "網站未回到指定目錄");
        return {name: nClean(info.bookName), link: book, imageUrl: "https://bookcover.yuewen.com/qdbimg/349573/" + id + "/180", author: nClean(info.authorName),
            description: nPlain(info.desc), genre: [nClean(info.chanName), nClean(info.subCateName)].filter(Boolean),
            status: /完本|完结|完結/.test(String(info.actionStatus || info.bookStatus || "")) ? 1 : /连载|連載/.test(String(info.actionStatus || info.bookStatus || "")) ? 0 : 5,
            chapters: this._chapters(qdData(catalog.html), id)};
    }
    async getHtmlContent(name, url) {
        const chapter = qdChapter(url);
        if (!chapter) throw nError("URL", "章節網址格式錯誤");
        const ids = /\/chapter\/(\d+)\/(\d+)/.exec(chapter), result = await this._page(chapter), data = qdData(result.html), info = data.chapterInfo;
        if (qdChapter(result.url) !== chapter || !info || qdId(info.chapterId) !== ids[2] || !data.bookInfo || qdId(data.bookInfo.bookId) !== ids[1]) throw nError("CHAPTER", "網站未回傳指定章節");
        if (Number(info.price) > 0 || Number(info.freeStatus) === 1) throw nError("VIP", "本來源支援免費章節；付費正文請到起點官方網站或 App 閱讀");
        if (info.fixedFontTtf || info.fixedFontWoff2 || info.randomFont || Number(info.cES) > 0 || Number(info.eFW) > 0 || (info.riskbe && Number(info.riskbe.be) > 0)) throw nError("PROTECTED", "此章節使用受限閱讀格式，請到官方網站或 App 閱讀");
        if (typeof info.content !== "string") throw nError("CONTENT", "未取得免費章節正文");
        return nArticle(name, info.content, result.url);
    }
}
