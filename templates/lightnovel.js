/* LightNovel.fun official public PC APIs. No account mutations or unlock requests. */
const mangayomiSources = [{
    name: "輕之國度", id: 1827634461, lang: "zh", baseUrl: "https://www.lightnovel.fun/tw", apiUrl: "",
    iconUrl: "https://www.lightnovel.fun/favicon.ico", typeSource: "single", itemType: 2, isManga: false,
    sourceCodeLanguage: 1, version: "0.1.0", appMinVerReq: "0.9.10", pkgPath: "novel/src/zh/lightnovel.js",
    hasCloudflare: true, isNsfw: false, notes: "熱門、最近更新、繁簡搜尋、完整分卷目錄、公開正文與插圖。預設繁體，可切換原文；可沿用內建網頁已登入帳號；限定章節依站方閱讀權限。"
}];
const N_SITE = {name: "輕之國度", code: "LK", base: "https://www.lightnovel.fun/tw", hosts: ["www.lightnovel.fun"], images: ["www.lightnovel.fun", "api.lightnovel.fun"]};
/*__COMMON__*/
/*__LV_OPENCC_NOTICE__*/
const LK_OPENCC = (() => { const module = {exports: {}}; const exports = module.exports;
/*__LV_OPENCC__*/
return module.exports; })();
let lkConverter;
const LK_ORIGIN = "https://www.lightnovel.fun", LK_PROXY = LK_ORIGIN + "/api/pc-proxy/api/";
const LK_ENDPOINTS = ["bff/home-feed-v1", "bff/home-recent-updates-feed-v1", "bff/apk-search-result-v1", "new-content-read/get-book-detail", "new-content-read/get-book-volumes", "new-content-read/get-volume-chapters", "new-content-read/get-chapter-detail"];
function lkId(value) { return /^[1-9]\d{0,14}$/.test(String(value)) ? String(value) : ""; }
function lkPath(value, reading) {
    const url = nAbsolute(LK_ORIGIN + "/", value);
    if (!nTrusted(url)) return null;
    const match = (reading ? /^https:\/\/www\.lightnovel\.fun(?::443)?\/(?:tw\/|cn\/)?reader\/(\d+)\/(\d+)\/?(?:[?#].*)?$/ : /^https:\/\/www\.lightnovel\.fun(?::443)?\/(?:tw\/|cn\/)?book\/(\d+)\/?(?:[?#].*)?$/).exec(url);
    return match && lkId(match[1]) && (!reading || lkId(match[2])) ? {book: match[1], chapter: reading ? match[2] : ""} : null;
}
function lkBook(id) { return N_SITE.base + "/book/" + id; }
function lkChapter(book, chapter) { return N_SITE.base + "/reader/" + book + "/" + chapter; }
function lkLabel(title, bookTitle) {
    title = nClean(title); bookTitle = nClean(bookTitle);
    if (!bookTitle || !title.startsWith(bookTitle)) return title;
    const tail = title.slice(bookTitle.length);
    return /^[\s·:：—－-]|^第/.test(tail) ? tail.replace(/^[\s·:：—－-]+/, "").trim() || title : title;
}
function lkYes(value) { return value === true || value === 1 || value === "1"; }
function lkRestricted(chapter) {
    return lkYes(chapter.locked) || (!lkYes(chapter.unlocked) && (lkYes(chapter.brave_required) ||
        (chapter.access_type && !["public", "free"].includes(chapter.access_type))));
}
function lkData(text) {
    let reply;
    try { reply = JSON.parse(text); } catch (_) { throw nError("RESPONSE", "網站未回傳有效資料，請稍後重試"); }
    if (!reply || typeof reply !== "object" || Array.isArray(reply)) throw nError("RESPONSE", "網站回傳格式已變更");
    if (Number(reply.code) !== 0 || reply.code === undefined) throw nError("API", "網站拒絕此請求，請在內建網頁確認登入或閱讀權限");
    if (!reply.data || typeof reply.data !== "object" || Array.isArray(reply.data)) throw nError("RESPONSE", "網站資料格式已變更");
    return reply.data;
}
function lkPage(data, page) {
    if (!Array.isArray(data.list)) throw nError("LIST", "網站未回傳書籍或章節清單");
    const pagination = data.pagination || {}, info = data.page_info || {};
    const actual = info.cur === undefined ? pagination.page : info.cur;
    if (actual !== undefined && Number(actual) !== page) throw nError("PAGE", "網站回傳的分頁不符，請稍後重試");
    let more;
    if (info.has_next !== undefined) more = lkYes(info.has_next);
    else if (data.has_next !== undefined) more = lkYes(data.has_next);
    else if (data.hasMore !== undefined) more = lkYes(data.hasMore);
    else if (pagination.page_count !== undefined) more = Number(pagination.page_count) > page;
    else throw nError("PAGE", "網站未提供分頁資訊");
    return {list: data.list, more, total: pagination.total === undefined ? info.count : pagination.total};
}
async function lkBrowserApi(options) {
    const bridge = window.flutter_inappwebview;
    if (!bridge || window[options.nonce]) return;
    window[options.nonce] = true;
    const reply = (kind, extra) => bridge.callHandler("setResponse", JSON.stringify({kind, url: location.href, ...extra}));
    if (location.href !== "https://www.lightnovel.fun/robots.txt") return reply("outside");
    if (nChallenge(document.documentElement.outerHTML)) return reply("challenge");
    const target = new URL(options.url);
    if (target.origin !== "https://www.lightnovel.fun" || !options.endpoints.includes(target.pathname.slice("/api/pc-proxy/api/".length)) || !target.pathname.startsWith("/api/pc-proxy/api/")) return reply("outside");
    let body = options.body;
    if (options.session) {
        let key = "";
        for (const name of ["lk_security_key", "security_key", "lkSecurityKey", "pc_security_key"]) {
            const stored = window.localStorage.getItem(name);
            const cookie = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
            if (stored || cookie) { key = decodeURIComponent(stored || cookie[1]).trim(); if (key) break; }
        }
        if (!key) return reply("login");
        body = JSON.stringify({...JSON.parse(body), security_key: key});
    }
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(target.href, {method: "POST", headers: {"Content-Type": "application/json", Accept: "application/json"}, body, signal: controller.signal});
        if (response.url !== target.href) return reply("outside");
        const text = await response.text();
        return reply(nChallenge(text) ? "challenge" : "api", {status: response.status, text});
    } catch (_) { return reply("error"); }
    finally { clearTimeout(timer); }
}
class DefaultExtension extends NativeNovel {
    constructor() { super(); this.client = new Client({timeout: 25, connectTimeout: 10}); }
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: N_SITE.base + "/", "Accept-Language": "zh-TW,zh;q=0.9", Accept: "application/json"}; }
    getSourcePreferences() { return [{key: "display_language", listPreference: {title: "顯示文字", summary: "繁體會轉換書名、章名與正文，圖片與網址保持原樣。", valueIndex: 0, entries: ["繁體中文（建議）", "網站原文"], entryValues: ["tw", "original"]}}, {key: "account_mode", listPreference: {title: "閱讀帳號", summary: "先在來源內建網頁登入，再選擇沿用帳號。登入資訊保留在內建網頁，章節仍需符合站方權限。", valueIndex: 0, entries: ["訪客（公開章節）", "使用內建網頁已登入帳號"], entryValues: ["guest", "webview"]}}]; }
    async _language() { return this._preference("display_language", ["tw", "original"], "tw"); }
    _text(value, language) {
        const text = String(value || "");
        if (language === "original") return text;
        lkConverter ||= LK_OPENCC.Converter({from: "cn", to: "tw"});
        return lkConverter(text);
    }
    async _browserApi(url, body, session = false) {
        const options = {url, body, session, endpoints: LK_ENDPOINTS, nonce: "__lk_" + Date.now().toString(36) + Math.random().toString(36).slice(2)};
        const script = "(function(){const nChallenge=" + nChallenge.toString() + ";return (" + lkBrowserApi.toString() + ")(" + JSON.stringify(options) + ");})()";
        const task = this.pageQueue.then(async () => {
            let data;
            try { data = JSON.parse(await evaluateJavascriptViaWebview(LK_ORIGIN + "/robots.txt", {}, [script], 25)); }
            catch (_) { throw nError("BROWSER", "內建網頁未能完成讀取，請稍後重試"); }
            if (data.kind === "login") throw nError("LOGIN", "請先在來源內建網頁登入輕之國度，再重新整理或重試章節");
            if (data.kind === "challenge") throw nError("VERIFY", "請在來源內建網頁手動完成驗證後重試");
            if (data.kind !== "api" || data.url !== LK_ORIGIN + "/robots.txt") throw nError("BROWSER", "內建網頁未回傳此來源資料");
            return {statusCode: data.status, body: data.text};
        });
        this.pageQueue = task.catch(() => {}); return task;
    }
    async _api(endpoint, payload) {
        if (!LK_ENDPOINTS.includes(endpoint)) throw nError("URL", "不支援的網站介面");
        const url = LK_PROXY + endpoint, body = JSON.stringify(payload);
        const session = await this._preference("account_mode", ["guest", "webview"], "guest") === "webview";
        let response;
        if (session) response = await this._browserApi(url, body, true);
        for (let attempt = 0; attempt < (session ? 0 : 2); attempt++) {
            try { response = await this.client.post(url, {...this.getHeaders(), "Content-Type": "application/json"}, body); }
            catch (_) { if (attempt) throw nError("NETWORK", "連線中斷，請稍後重試"); }
            if (response && ![502, 503, 504].includes(response.statusCode)) break;
            if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (response && response.request && response.request.url && response.request.url !== url) throw nError("URL", "網站轉向非預期網址");
        if (!session && response && (response.statusCode === 403 || nChallenge(response.body || ""))) response = await this._browserApi(url, body);
        if (response && response.statusCode === 429) throw nError("RATE", "網站請求過於頻繁，請稍後重試");
        if (!response || response.statusCode !== 200) throw nError("HTTP", "網站暫時無法讀取，請稍後重試");
        return lkData(response.body);
    }
    async _listing(endpoint, page, extra) {
        page = nPage(page);
        const data = await this._api(endpoint, {page: ["bff/apk-search-result-v1", "bff/home-recent-updates-feed-v1"].includes(endpoint) ? page - 1 : page, pageSize: 20, page_size: 20, ...extra});
        const result = lkPage(data, page), language = await this._language(), seen = new Set();
        const list = result.list.flatMap(book => {
            const id = lkId(book.book_id), title = nClean(book.title);
            if (!id || !title || seen.has(id)) return [];
            seen.add(id);
            return [{name: this._text(title, language), link: lkBook(id), imageUrl: nImage(LK_ORIGIN, book.cover_url)}];
        });
        if (result.list.length && !list.length) throw nError("LIST", "網站書籍清單格式已變更");
        return {list, hasNextPage: result.more};
    }
    getPopular(page) { return this._listing("bff/home-feed-v1", page, {sort: "hot", read_filter: "all", status_filter: "all", category_filter: "all"}); }
    getLatestUpdates(page) { return this._listing("bff/home-recent-updates-feed-v1", page, {sort: "updated"}); }
    async search(query, page) {
        query = String(query || "").trim();
        if (!query) return {list: [], hasNextPage: false};
        const direct = lkPath(query, false);
        if (direct) { const book = await this.getDetail(lkBook(direct.book)); return {list: [{name: book.name, link: book.link, imageUrl: book.imageUrl}], hasNextPage: false}; }
        return this._listing("bff/apk-search-result-v1", page, {q: query, scope: "", source: "", sort: "relevance"});
    }
    async _all(endpoint, extra, idKey, book, volume) {
        const output = [], seen = new Set(); let total;
        for (let page = 1; page <= 1000; page++) {
            const data = await this._api(endpoint, {...extra, page, pageSize: 50, page_size: 50});
            if (String(data.book_id) !== book || (volume && String(data.volume_id) !== volume)) throw nError("IDENTITY", "網站未回傳指定作品的目錄");
            const result = lkPage(data, page);
            if (total === undefined && result.total !== undefined) total = Number(result.total);
            for (const row of result.list) {
                const id = lkId(row[idKey]);
                if (!id || seen.has(id) || (row.book_id !== undefined && String(row.book_id) !== book) || (volume && row.volume_id !== undefined && String(row.volume_id) !== volume)) throw nError("CATALOG", "目錄含重複或不符的章節，請稍後重新整理");
                seen.add(id); output.push(row);
            }
            if (!result.more) {
                if (Number.isFinite(total) && output.length !== total) throw nError("CATALOG", "目錄尚未完整載入，請稍後重新整理");
                return output;
            }
            if (!result.list.length) throw nError("PAGE", "目錄分頁未完整載入");
        }
        throw nError("PAGE", "目錄分頁超出讀取範圍");
    }
    async getDetail(url) {
        const target = lkPath(url, false);
        if (!target) throw nError("URL", "作品網址不屬於此來源");
        const book = await this._api("new-content-read/get-book-detail", {book_id: target.book, with_volumes: 0});
        if (String(book.book_id) !== target.book || !nClean(book.title)) throw nError("IDENTITY", "網站未回傳指定作品");
        const volumes = await this._all("new-content-read/get-book-volumes", {book_id: target.book}, "volume_id", target.book);
        const language = await this._language(), entries = [], chapterIds = new Set();
        for (const volume of volumes) {
            const chapters = await this._all("new-content-read/get-volume-chapters", {book_id: target.book, volume_id: String(volume.volume_id)}, "chapter_id", target.book, String(volume.volume_id));
            for (const chapter of chapters) {
                if (!nClean(chapter.title)) throw nError("CATALOG", "章節名稱尚未完整載入");
                if (chapterIds.has(String(chapter.chapter_id))) throw nError("CATALOG", "分卷目錄含重複章節，請稍後重新整理");
                chapterIds.add(String(chapter.chapter_id));
                entries.push({name: this._text([volume.title, lkLabel(chapter.title, book.title)].map(nClean).filter(Boolean).join(" · "), language) + (lkRestricted(chapter) ? " [需站方權限]" : ""), url: lkChapter(target.book, chapter.chapter_id)});
            }
        }
        if (book.chapter_count !== undefined && entries.length !== Number(book.chapter_count)) throw nError("CATALOG", "章節數尚未完整載入，請稍後重新整理");
        return {name: this._text(book.title, language), link: lkBook(target.book), imageUrl: nImage(LK_ORIGIN, book.cover_url), author: this._text(book.author_name, language), artist: this._text(book.illustrator_name, language), description: this._text(nPlain(book.summary || ""), language), genre: (book.visible_tags || book.tags || []).map(tag => this._text(typeof tag === "string" ? tag : tag.name || tag.tag_name || tag.label || "", language)).filter(Boolean), status: lkYes(book.is_completed) ? 1 : 0, chapters: nNumberChapters(entries)};
    }
    async getHtmlContent(name, url) {
        const target = lkPath(url, true);
        if (!target) throw nError("URL", "章節網址不屬於此來源");
        const chapter = await this._api("new-content-read/get-chapter-detail", {book_id: target.book, chapter_id: target.chapter});
        if (String(chapter.book_id) !== target.book || String(chapter.chapter_id) !== target.chapter) throw nError("IDENTITY", "網站未回傳指定章節");
        if (lkRestricted(chapter)) throw nError("ACCESS", "此章節需要登入、勇者資格或付費權限，請使用官方網站閱讀");
        const snapshot = chapter.body_snapshot || {}, preview = chapter.render_preview || {};
        let html = snapshot.body_html || preview.body_html;
        if (!html && (snapshot.body_text || preview.body_text)) html = String(snapshot.body_text || preview.body_text).split(/\r?\n/).map(line => "<p>" + nEscape(line) + "</p>").join("");
        if (typeof html !== "string" || !html.trim()) throw nError("CONTENT", "正文尚未完整載入，請稍後重試");
        const language = await this._language(), safe = nSanitize(html, lkChapter(target.book, target.chapter));
        const converted = safe.replace(/(^|>)([^<]*)(?=<|$)/g, (_, prefix, text) => prefix + this._text(text, language));
        return nArticle(this._text(lkLabel(chapter.title, chapter.book_title), language), converted, lkChapter(target.book, target.chapter));
    }
}
