/*
 * KadoKado 角角者 native JavaScript novel source for Mangayomi.
 * Version 0.1.0. UTF-8, no dependencies or embedded credentials.
 * MIT license; see LICENSE.txt.
 *
 * Catalogue, search, title details and chapter lists come from the site's
 * public API (Traditional Chinese originals). The site shows chapter text only
 * to signed-in members, so reading goes through the app WebView, where the
 * reader signs in once on www.kadokado.cn. Paid chapters are not listed.
 */
const mangayomiSources = [{
    name: "KadoKado 角角者", id: 1827634462, lang: "zh",
    baseUrl: "https://www.kadokado.cn", apiUrl: "https://api.kadokado.cn",
    iconUrl: "https://www.kadokado.cn/static/favicon.ico",
    typeSource: "single", itemType: 2, isManga: false, sourceCodeLanguage: 1,
    version: "0.1.0", appMinVerReq: "0.9.9", pkgPath: "novel/src/zh/kadokado.js",
    hasCloudflare: false, isNsfw: false,
    notes: "台灣角川小說平台。排行、最新更新、搜尋與目錄免登入；網站只對會員顯示正文，請先在來源內建網頁登入 www.kadokado.cn。只列出免費章節。"
}];
const KK_SITE = "https://www.kadokado.cn";
// The .cn site talks to its own API host, which shares the sign-in cookie.
const KK_API = "https://api.kadokado.cn";
const KK_RANKINGS = [
    ["MostViewed|Week", "本週人氣"], ["MostViewed|Month", "本月人氣"], ["MostViewed|Day", "今日人氣"],
    ["MostFavorite|Week", "本週收藏"], ["MostFavorite|Month", "本月收藏"]
];
const KK_IMAGE_HOSTS = ["img.kadokado.com.tw", "storage.googleapis.com"];

function kkError(code, message) { return new Error("KadoKado：" + message + "（KK-" + code + "）"); }
function kkClean(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
function kkEscape(text) {
    return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function kkPage(page) { const n = Number(page); return Number.isSafeInteger(n) && n > 0 ? n : 1; }
function kkId(value) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : 0; }
function kkTitleId(url) {
    const match = /^(?:https:\/\/www\.kadokado\.(?:cn|com\.tw))?\/book\/([1-9]\d*)(?:[/?#]|$)/.exec(String(url || "").trim());
    return match ? kkId(match[1]) : 0;
}
function kkChapterId(url) {
    const match = /^(?:https:\/\/www\.kadokado\.(?:cn|com\.tw))?\/chapter\/([1-9]\d*)(?:[/?#]|$)/.exec(String(url || "").trim());
    return match ? kkId(match[1]) : 0;
}
function kkImage(value) {
    const url = String(value || "").trim();
    const match = /^https:\/\/([^/?#]+)\//.exec(url);
    return match && KK_IMAGE_HOSTS.includes(match[1].toLowerCase()) ? url : "";
}
function kkCover(item) { return kkImage(Array.isArray(item.coverUrls) ? item.coverUrls[0] : ""); }
// Full-width digits in the global serial keep the app from folding chapters
// that share a number in their names, as the other novel sources here do.
function kkSerial(index, width) { return String(index + 1).padStart(width, "0"); }

// Removes anything active from chapter HTML and keeps text, paragraphs,
// emphasis, line breaks and images from the site's own image hosts.
function kkSanitize(html) {
    let text = String(html || "");
    text = text.replace(/<(script|style|iframe|object|embed|noscript|form|button|select|textarea)\b[\s\S]*?<\/\1\s*>/gi, "");
    text = text.replace(/<(script|style|iframe|object|embed|input|link|meta)\b[^>]*>/gi, "");
    return text.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (all, close, tag, attrs) => {
        tag = tag.toLowerCase();
        if (tag === "img") {
            const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs);
            const safe = src ? kkImage(src[1]) : "";
            return safe ? '<img src="' + kkEscape(safe) + '">' : "";
        }
        if (["p", "br", "b", "strong", "i", "em", "u", "s", "span", "div", "h1", "h2", "h3", "h4", "blockquote", "hr", "ruby", "rt", "rp"].includes(tag)) {
            return "<" + close + tag + ">";
        }
        return "";
    });
}

// Runs in the app WebView on www.kadokado.cn: asks the API for the chapter
// with the reader's own session, so the site's sign-in decides what is shown.
async function kkReadChapter(options) {
    const bridge = window.flutter_inappwebview;
    if (!bridge || window[options.nonce]) return;
    window[options.nonce] = true;
    const reply = (kind, extra) => bridge.callHandler("setResponse", JSON.stringify({kind, url: location.href, ...extra}));
    try {
        if (location.hostname !== "www.kadokado.cn") return reply("outside");
        const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 15000);
        let response;
        try {
            response = await fetch(options.api + "/v3/chapter/" + options.chapter + "/content", {
                credentials: "include", headers: {accept: "application/json", region: "CHINA"}, signal: abort.signal
            });
        } finally { clearTimeout(timer); }
        if (response.status === 401 || response.status === 403) return reply("signed-out");
        if (response.status === 429) return reply("rate");
        if (!response.ok) return reply("http-error", {status: response.status});
        const data = await response.json();
        return reply("chapter", {type: data.type, content: data.content, imageUrls: data.imageUrls || []});
    } catch (_) { return reply("browser-error"); }
}

class DefaultExtension extends MProvider {
    constructor() { super(); this.client = new Client({timeout: 15, connectTimeout: 8}); this.prefs = new SharedPreferences(); }
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: KK_SITE + "/", Origin: KK_SITE, Accept: "application/json"}; }
    getFilterList() { return []; }
    async getPageList() { return []; }
    async getVideoList() { return []; }
    getSourcePreferences() {
        return [{key: "kk_ranking", listPreference: {
            title: "熱門清單", summary: "「熱門」分頁顯示的排行。", valueIndex: 0,
            entries: KK_RANKINGS.map(r => r[1]), entryValues: KK_RANKINGS.map(r => r[0])
        }}];
    }
    _ranking() {
        let value = "";
        try { value = String(this.prefs.get("kk_ranking") || ""); } catch (_) {}
        return KK_RANKINGS.some(r => r[0] === value) ? value : KK_RANKINGS[0][0];
    }
    async _api(path) {
        let response;
        try { response = await this.client.get(KK_API + path, this.getHeaders()); }
        catch (_) { throw kkError("NETWORK", "無法連線到 KadoKado，請稍後重試"); }
        const status = Number(response.statusCode);
        if (status === 429) throw kkError("RATE", "請求過於頻繁，請稍後重試");
        if (status === 404) throw kkError("NOT-FOUND", "作品或章節不存在");
        if (status !== 200) throw kkError("HTTP", "網站回應錯誤 " + status);
        try { return JSON.parse(response.body); }
        catch (_) { throw kkError("FORMAT", "網站回傳格式錯誤"); }
    }
    _entry(item) {
        const id = kkId(item.titleId || item.id);
        const name = kkClean(item.titleDisplayName || item.displayName);
        if (!id || !name) return null;
        return {name, link: KK_SITE + "/book/" + id, imageUrl: kkCover(item)};
    }
    _list(items, hasNextPage) {
        const list = [], seen = new Set();
        for (const item of Array.isArray(items) ? items : []) {
            const entry = this._entry(item || {});
            if (!entry || seen.has(entry.link)) continue;
            seen.add(entry.link); list.push(entry);
        }
        return {list, hasNextPage: !!hasNextPage && list.length > 0};
    }
    async getPopular(page) {
        // Rankings come as one list of up to 100 titles.
        if (kkPage(page) > 1) return {list: [], hasNextPage: false};
        const [type, interval] = this._ranking().split("|");
        return this._list(await this._api("/v2/rankings?type=" + type + "&interval=" + interval), false);
    }
    async getLatestUpdates(page) {
        if (kkPage(page) > 1) return {list: [], hasNextPage: false};
        return this._list(await this._api("/v2/latestUpdatedTitles?limit=50"), false);
    }
    async search(query, page, filters) {
        query = String(query || "").trim(); page = kkPage(page);
        if (!query) return {list: [], hasNextPage: false};
        const direct = kkTitleId(query) || (/^\d+$/.test(query) ? kkId(query) : 0);
        if (direct && page === 1 && !/^\d+$/.test(query)) {
            const title = await this._api("/v2/titles/" + direct);
            return this._list([title], false);
        }
        const result = await this._api("/v3/search?keyword=" + encodeURIComponent(query) + "&current=" + page + "&limit=20&order=Relevance");
        return this._list(result.data, result.more);
    }
    async getDetail(url) {
        const id = kkTitleId(url);
        if (!id) throw kkError("URL", "請使用 KadoKado 作品網址");
        const title = await this._api("/v2/titles/" + id);
        const collections = await this._api("/v3/title/" + id + "/collection");
        const entries = [];
        for (const collection of Array.isArray(collections) ? collections : []) {
            const volume = kkClean(collection.collectionDisplayName);
            for (const chapter of Array.isArray(collection.chapters) ? collection.chapters : []) {
                const chapterId = kkId(chapter.chapterId), name = kkClean(chapter.chapterDisplayName);
                // Only chapters the site opens to every member.
                if (!chapterId || !name || chapter.isFree !== true) continue;
                entries.push({volume, name, chapterId, date: Date.parse(chapter.listingFrom) || 0});
            }
        }
        const width = Math.max(4, String(entries.length).length);
        const chapters = entries.map((entry, index) => ({
            name: kkSerial(index, width) + " | " + (entry.volume ? entry.volume + " " : "") + entry.name,
            url: KK_SITE + "/chapter/" + entry.chapterId,
            dateUpload: entry.date ? String(entry.date) : undefined
        })).reverse();
        const authors = (Array.isArray(title.authors) ? title.authors : []).map(a => kkClean(a.displayName)).filter(Boolean);
        const genres = (Array.isArray(title.genres) ? title.genres : []).map(g => kkClean(g.name))
            .concat(Array.isArray(title.tags) ? title.tags.map(kkClean) : []).filter(Boolean);
        return {
            name: kkClean(title.displayName), link: KK_SITE + "/book/" + id, imageUrl: kkCover(title),
            author: authors.join("、") || kkClean(title.ownerDisplayName), artist: "",
            description: String(title.logline || title.oneLineIntro || "").trim(),
            genre: [...new Set(genres)], status: title.isSerialized === false ? 1 : 0, chapters
        };
    }
    async getHtmlContent(name, url) {
        const chapter = kkChapterId(url);
        if (!chapter) throw kkError("URL", "章節網址格式錯誤");
        if (typeof evaluateJavascriptViaWebview !== "function") throw kkError("HELPER", "請使用 Mangayomi 0.9.9 或更新版本");
        const options = {api: KK_API, chapter, nonce: "__kk_" + Date.now().toString(36) + Math.random().toString(36).slice(2)};
        const script = "(" + kkReadChapter.toString() + ")(" + JSON.stringify(options) + ");";
        let result;
        try { result = JSON.parse(await evaluateJavascriptViaWebview(KK_SITE + "/robots.txt", {}, [script], 25)); }
        catch (_) { throw kkError("BROWSER", "內建網頁讀取失敗，請稍後重試"); }
        if (!result || result.kind === "outside") throw kkError("URL", "內建網頁離開了 KadoKado");
        if (result.kind === "signed-out") throw kkError("LOGIN", "請先在來源內建網頁登入 www.kadokado.cn");
        if (result.kind === "rate") throw kkError("RATE", "請求過於頻繁，請稍後重試");
        if (result.kind !== "chapter") throw kkError("CONTENT", "未取得章節內容，請稍後重試");
        let html = kkSanitize(result.content);
        if (result.type === "IMAGE" || (Array.isArray(result.imageUrls) && result.imageUrls.length)) {
            html += result.imageUrls.map(kkImage).filter(Boolean).map(src => '<img src="' + kkEscape(src) + '">').join("");
        }
        if (!kkClean(html.replace(/<[^>]+>/g, "")) && !/<img\s/i.test(html)) {
            // The site answers a reader who is not signed in with an empty page.
            throw kkError("LOGIN", "網站沒有回傳正文：請先在來源內建網頁登入 www.kadokado.cn，再重新開啟本章");
        }
        return "<article><h3>" + kkEscape(name) + "</h3>" + html + "</article>";
    }
    async cleanHtmlContent(html) { return kkSanitize(html); }
}
