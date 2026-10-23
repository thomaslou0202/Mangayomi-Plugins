/* Anime1 native JavaScript anime source for Mangayomi 0.9.9. MIT.
 * Uses the site's public list and normal anonymous player request.
 * Playback cookies come only from that API response; never read browser cookies.
 */
const mangayomiSources = [{
    name: "Anime1（測試版）", id: 1827634456, lang: "zh", baseUrl: "https://anime1.me", apiUrl: "",
    iconUrl: "https://anime1.me/favicon-32x32.png", typeSource: "single", itemType: 1, isManga: false,
    sourceCodeLanguage: 1, version: "0.1.1", appMinVerReq: "0.9.9", pkgPath: "anime/src/zh/anime1.js",
    hasCloudflare: true, isNsfw: false,
    notes: "依動畫列表分組，支援搜尋、年份／季節篩選、完整集數與站方播放器的原始影片。網站未提供各作封面，使用站方圖示。影片連結失效時請重新開啟該集。"
}];
const A1_BASE = "https://anime1.me";
const A1_INDEX = A1_BASE + "/animelist.json";
const A1_API = "https://v.anime1.me/api";
const A1_IMAGE = "https://sta.anicdn.com/logo/260x260.png";
function a1Error(code, message) { return new Error("Anime1：" + message + "（A1-" + code + "）。"); }
function a1Clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function a1HasClass(node, name) { return (" " + a1Clean(node.attr("class")) + " ").includes(" " + name + " "); }
function a1First(scope, selector) { const nodes = scope.select(selector); return nodes.length ? nodes[0] : null; }
function a1Text(scope, selector) { const node = a1First(scope, selector); return node ? a1Clean(node.text) : ""; }
function a1Plain(value) { const text = String(value || ""); if (!/[<&]/.test(text)) return a1Clean(text); const document = new Document("<body>" + text + "</body>"); return a1Text(document, "body"); }
function a1Page(value) { const number = Number(value); return Number.isSafeInteger(number) && number > 0 ? number : 1; }
function a1Site(url) { return /^https:\/\/anime1\.me(?::443)?(?:[/?#]|$)/i.test(url) && !/[\u0000-\u0020\\]/.test(url); }
function a1Absolute(base, value) {
    const raw = String(value || "").trim().replace(/&amp;/gi, "&");
    if (!raw || /[\u0000-\u0020\\]/.test(raw)) return "";
    if (/^https?:\/\//i.test(raw)) return raw.replace(/^http:/i, "https:");
    if (raw.slice(0, 2) === "//") return "https:" + raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";
    const clean = base.split(/[?#]/)[0];
    if (raw[0] === "?") return clean + raw;
    if (raw[0] === "/") return A1_BASE + raw;
    return clean.replace(/[^/]*$/, "") + raw;
}
function a1Category(url) {
    if (!a1Site(url)) return "";
    const match = /[?&]cat=([1-9]\d*)(?:&|$)/.exec(url);
    return match ? match[1] : "";
}
function a1Post(base, value) {
    const url = a1Absolute(base, value);
    if (!a1Site(url)) return "";
    const match = /^https:\/\/anime1\.me(?:\/([1-9]\d*)\/?(?:[?#].*)?|\/\?p=([1-9]\d*)(?:&.*)?)$/i.exec(url);
    return match ? A1_BASE + "/" + (match[1] || match[2]) : "";
}
function a1Header(headers, name) { const key = Object.keys(headers || {}).find(key => key.toLowerCase() === name); return key ? headers[key] : ""; }
function a1PlaybackCookies(headers) {
    const value = a1Header(headers, "set-cookie"), lines = Array.isArray(value) ? value : [String(value || "")], cookies = {};
    for (const line of lines) {
        const pattern = /(?:^|,)\s*(e|p|h)=([^;,\r\n]*)/gi; let match;
        while ((match = pattern.exec(line)) !== null) {
            if (match[2] && match[2].length <= 8192 && !/[\u0000-\u0020\u007f"\\]/.test(match[2])) cookies[match[1].toLowerCase()] = match[2];
        }
    }
    if (!["e", "p", "h"].every(name => cookies[name])) throw a1Error("PLAYBACK-HEADERS", "未取得完整播放授權，請重新開啟這一集；若持續發生請回報錯誤碼");
    return ["e", "p", "h"].map(name => name + "=" + cookies[name]).join("; ");
}
function a1Media(value) {
    const raw = String(value || "").trim(), url = raw.slice(0, 2) === "//" ? "https:" + raw : raw.replace(/^http:/i, "https:");
    return /^https:\/\/(?:[a-z0-9-]+\.)*v\.anime1\.me\/(?:[^\s\\#]*)\.(?:mp4|m3u8)(?:\?[^\s\\#]*)?$/i.test(url) ? url : "";
}
function a1Challenge(html) {
    return /<title[^>]*>\s*(?:Just a moment(?:\.{3}|…)?|Attention Required!?(?:\s*\|\s*Cloudflare)?)\s*<\/title>/i.test(html)
        || /\bid=["'](?:challenge-form|challenge-running|cf-challenge-running)["']/i.test(html);
}
function a1BrowserScript(kind, category) {
    function capture(options) {
        const bridge = window.flutter_inappwebview;
        if (!bridge || typeof bridge.callHandler !== "function") return;
        const reply = (kind, body) => bridge.callHandler("setResponse", JSON.stringify({kind, url: location.href, body: body || ""}));
        try {
            const url = new URL(location.href);
            if (url.protocol !== "https:" || url.hostname !== "anime1.me" || url.username || url.password || (url.port && url.port !== "443")) return reply("outside");
            if (a1Challenge(document.documentElement.outerHTML)) return reply("challenge");
            if (options.kind === "json") return reply("page", document.body ? document.body.textContent : "");
            if (options.kind === "archive") {
                const id = String(options.category || "");
                if (!/^[1-9]\d*$/.test(id) || !document.body || !document.body.classList.contains("category-" + id)) return reply("category");
                const entries = [];
                for (const post of document.querySelectorAll("article")) {
                    const match = /^post-([1-9]\d*)$/.exec(post.id);
                    if (!match || !post.classList.contains("category-" + id)) continue;
                    const heading = post.querySelector(".entry-title"), date = post.querySelector("time[datetime]");
                    if (!heading || !heading.textContent.trim()) continue;
                    entries.push({title: heading.textContent, url: "https://anime1.me/" + match[1], date: date ? date.getAttribute("datetime") : ""});
                }
                const previous = Array.from(document.querySelectorAll(".nav-previous a[href]")).map(anchor => anchor.getAttribute("href"));
                return reply("page", JSON.stringify({category: id, entries, previous}));
            }
            const copy = document.documentElement.cloneNode(true);
            for (const node of copy.querySelectorAll("script,style,iframe,object,embed,noscript,form,input,textarea")) node.remove();
            return reply("page", copy.outerHTML);
        } catch (_) { return reply("error"); }
    }
    return "(function(){const a1Challenge=" + a1Challenge.toString() + ";return (" + capture.toString() + ")(" + JSON.stringify({kind, category}) + ");})()";
}
class DefaultExtension extends MProvider {
    constructor() { super(); this.client = new Client(); this.prefs = new SharedPreferences(); this.indexTask = null; this.indexLoadedAt = 0; this.browserQueue = Promise.resolve(); }
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: A1_BASE + "/", Origin: A1_BASE}; }
    getFilterList() { return []; }
    async getPageList() { return []; }
    getSourcePreferences() {
        const years = Array.from({length: Math.max(1, new Date().getFullYear() - 2015)}, (_, index) => String(new Date().getFullYear() - index));
        return [
            {key: "year", listPreference: {title: "首頁年份", summary: "僅篩選首頁及最新清單；搜尋仍查詢全部作品。", valueIndex: 0, entries: ["全部"].concat(years, ["2015及以前"]), entryValues: [""].concat(years, ["older"])}},
            {key: "season", listPreference: {title: "首頁季節", summary: "依站方動畫列表的季節欄位篩選。", valueIndex: 0, entries: ["全部", "春", "夏", "秋", "冬"], entryValues: ["", "春", "夏", "秋", "冬"]}}
        ];
    }
    async _browser(url, kind, category) {
        if (typeof evaluateJavascriptViaWebview !== "function") throw a1Error("WEBVIEW", "請先在來源 WebView 確認網站可開啟，並使用 Mangayomi 0.9.9 或更新版本");
        const task = this.browserQueue.then(async () => {
            const raw = await evaluateJavascriptViaWebview(url, {}, [a1BrowserScript(kind, category)], 30);
            if (!raw) throw a1Error("TIMEOUT", "內建網頁讀取逾時，請先在來源 WebView 開啟網站");
            let response; try { response = JSON.parse(raw); } catch (_) { throw a1Error("WEBVIEW", "內建網頁回傳格式錯誤"); }
            if (!response || typeof response !== "object") throw a1Error("WEBVIEW", "內建網頁回傳格式錯誤");
            if (response.kind === "challenge") throw a1Error("CHALLENGE", "請在來源 WebView 手動完成網站驗證後重試");
            if (response.kind === "category") throw a1Error("CATEGORY", "網站沒有回傳指定動畫的集數頁");
            if (response.kind !== "page" || !a1Site(response.url) || typeof response.body !== "string") throw a1Error("WEBVIEW", "未取得 Anime1 網頁，請在來源 WebView 確認");
            return {body: response.body, url: response.url};
        });
        this.browserQueue = task.catch(() => {}); return task;
    }
    async _get(url, kind) {
        if (!a1Site(url)) throw a1Error("URL", "只接受 Anime1 的動畫及集數網址");
        let response;
        try { response = await this.client.get(url, this.getHeaders()); } catch (_) { return this._browser(url, kind); }
        if (Number(response.statusCode) === 429) throw a1Error("RATE", "網站限制請求頻率，請稍後再試");
        if (Number(response.statusCode) === 403 || a1Challenge(String(response.body || ""))) return this._browser(url, kind);
        if (Number(response.statusCode) !== 200 || typeof response.body !== "string") throw a1Error("HTTP", "網站暫時無法讀取，請稍後重試");
        const actual = response.request && response.request.url || url;
        if (!a1Site(actual)) throw a1Error("URL", "網站轉到 Anime1 以外的網址");
        return {body: response.body, url: actual};
    }
    _parseIndex(body) {
        let rows; try { rows = JSON.parse(body); } catch (_) { throw a1Error("INDEX", "動畫列表不是有效資料，網站可能正在維護"); }
        if (!Array.isArray(rows)) throw a1Error("INDEX", "動畫列表格式已變更");
        const seen = new Set(), result = [];
        for (const row of rows) {
            if (!Array.isArray(row) || row.length < 6 || !/^[1-9]\d*$/.test(String(row[0])) || seen.has(String(row[0]))) continue;
            const id = String(row[0]), name = a1Plain(row[1]);
            if (!name) continue;
            seen.add(id); result.push({id, name, episodes: a1Plain(row[2]), year: a1Plain(row[3]), season: a1Plain(row[4]), subtitles: a1Plain(row[5])});
        }
        if (!result.length) throw a1Error("INDEX", "動畫列表暫時沒有可用作品");
        return result;
    }
    _index() {
        if (this.indexTask && Date.now() - this.indexLoadedAt > 60000) this.indexTask = null;
        if (!this.indexTask) { this.indexLoadedAt = Date.now(); this.indexTask = this._get(A1_INDEX, "json").then(result => this._parseIndex(result.body)).catch(error => { this.indexTask = null; throw error; }); }
        return this.indexTask;
    }
    _slice(rows, page) { const start = (a1Page(page) - 1) * 20; return {list: rows.slice(start, start + 20).map(row => ({name: row.name, link: A1_BASE + "/?cat=" + row.id, imageUrl: A1_IMAGE})), hasNextPage: start + 20 < rows.length}; }
    async getPopular(page) {
        if (a1Page(page) === 1) this.indexTask = null;
        const rows = await this._index(), savedYear = String(await this.prefs.get("year") || ""), season = String(await this.prefs.get("season") || "");
        const year = savedYear === "older" || (/^\d{4}$/.test(savedYear) && Number(savedYear) >= 2016 && Number(savedYear) <= new Date().getFullYear()) ? savedYear : "";
        const filtered = rows.filter(row => (!year || (year === "older" ? Number(row.year) > 0 && Number(row.year) <= 2015 : row.year === year)) && (!["春", "夏", "秋", "冬"].includes(season) || row.season === season));
        return this._slice(filtered, page);
    }
    async getLatestUpdates(page) { return this.getPopular(page); }
    async search(query, page) {
        query = a1Clean(query);
        if (!query) return {list: [], hasNextPage: false};
        const rows = await this._index(), direct = a1Category(query);
        if (direct) return this._slice(rows.filter(row => row.id === direct), page);
        const normalize = text => text.toLowerCase().replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
        const terms = normalize(query).split(/\s+/);
        return this._slice(rows.filter(row => { const text = normalize([row.name, row.year, row.season, row.subtitles].join(" ")); return terms.every(term => text.includes(term)); }), page);
    }
    _episodes(html, url, id) {
        const document = new Document(html), entries = [], previous = [];
        const body = a1First(document, "body");
        if (!body || !a1HasClass(body, "category-" + id)) throw a1Error("CATEGORY", "網站沒有回傳指定動畫的集數頁");
        for (const post of document.select("article")) {
            const match = /^post-([1-9]\d*)$/.exec(post.attr("id"));
            if (!match || !a1HasClass(post, "category-" + id)) continue;
            const heading = a1First(post, ".entry-title"), title = heading && a1Clean(heading.text);
            if (!title) continue;
            const date = a1First(post, "time");
            entries.push({title, url: A1_BASE + "/" + match[1], date: date ? date.attr("datetime") : ""});
        }
        for (const navigation of document.select(".nav-previous")) for (const anchor of navigation.select("a")) if (anchor.attr("href")) previous.push(anchor.attr("href"));
        return this._archiveData({category: id, entries, previous}, url, id);
    }
    _archiveData(data, url, id) {
        if (!data || String(data.category) !== id || !Array.isArray(data.entries) || !Array.isArray(data.previous)) throw a1Error("CATEGORY", "集數資料與指定動畫不符");
        const entries = [];
        for (const entry of data.entries) {
            if (!entry || typeof entry.title !== "string" || typeof entry.url !== "string") continue;
            const title = a1Clean(entry.title), link = a1Post(url, entry.url), timestamp = typeof entry.date === "string" ? Date.parse(entry.date) : NaN;
            if (!title || !link) continue;
            const bracket = /[\[【]([^\]】]+)[\]】]\s*$/.exec(title), label = bracket ? bracket[1] : title;
            const number = /^\s*(\d+(?:\.\d+)?)(?:\s*[-~～]\s*\d+)?\s*$/.exec(label);
            entries.push({name: title, label, url: link, timestamp, number: number ? Number(number[1]) : null});
        }
        let next = "";
        for (const href of data.previous) {
            const candidate = a1Absolute(url, href);
            if (!a1Site(candidate) || !(/\/page\/[1-9]\d*(?:[/?#]|$)/.test(candidate) || /[?&]paged=[1-9]\d*(?:&|$)/.test(candidate))) throw a1Error("PAGINATION", "集數翻頁格式已變更，請回報動畫網址");
            if (next && next !== candidate) throw a1Error("PAGINATION", "集數頁出現多個不同的上一頁");
            next = candidate;
        }
        return {entries, next};
    }
    async _archive(result, id) {
        const direct = this._episodes(result.body, result.url, id);
        if (direct.entries.length) return direct;
        // A successful HTTP response can still differ from the rendered page.
        // Read only archive metadata with the WebView's own DOM, once per page.
        const rendered = await this._browser(result.url, "archive", id);
        let data; try { data = JSON.parse(rendered.body); } catch (_) { throw a1Error("EPISODES", "集數頁回傳格式錯誤，請回報動畫網址"); }
        const parsed = this._archiveData(data, rendered.url, id);
        if (!parsed.entries.length) throw a1Error("EPISODES", "網站與內建網頁均未取得集數，請回報動畫網址");
        return parsed;
    }
    async getDetail(url) {
        const id = a1Category(url);
        if (!id) throw a1Error("URL", "請從動畫列表或搜尋結果開啟作品");
        const row = (await this._index()).find(row => row.id === id);
        if (!row) throw a1Error("NOTFOUND", "站方動畫列表中找不到此作品");
        const entries = [], seenPosts = new Set(), seenPages = new Set(); let next = A1_BASE + "/?cat=" + id;
        while (next && seenPages.size < 200) {
            if (seenPages.has(next)) throw a1Error("PAGINATION", "集數頁重複，請稍後重試或回報動畫網址");
            seenPages.add(next);
            const result = await this._get(next, "html"), parsed = await this._archive(result, id);
            for (const entry of parsed.entries) if (!seenPosts.has(entry.url)) { seenPosts.add(entry.url); entries.push(entry); }
            next = parsed.next;
        }
        if (next) throw a1Error("PAGINATION", "集數超過支援的翻頁上限，請回報動畫網址");
        entries.reverse();
        if (entries.every(entry => entry.number !== null) && new Set(entries.map(entry => entry.number)).size === entries.length) entries.sort((a, b) => a.number - b.number);
        else if (entries.every(entry => Number.isFinite(entry.timestamp))) entries.sort((a, b) => a.timestamp - b.timestamp);
        const width = Math.max(4, String(entries.length).length);
        const episodes = entries.map((entry, index) => ({name: String(index + 1).padStart(width, "0") + "｜" + entry.label.replace(/[0-9]/g, digit => String.fromCharCode(digit.charCodeAt(0) + 0xfee0)),
            url: entry.url, scanlator: "", dateUpload: Number.isFinite(entry.timestamp) ? String(entry.timestamp) : ""})).reverse();
        return {name: row.name, link: A1_BASE + "/?cat=" + id, imageUrl: A1_IMAGE, author: "", artist: "",
            description: "集數：" + row.episodes + "\n年份：" + row.year + "\n季節：" + row.season + (row.subtitles ? "\n字幕組：" + row.subtitles : ""),
            genre: [row.year ? row.year + "年" : "", row.season ? row.season + "季" : ""].filter(Boolean),
            status: /連載|连载/.test(row.episodes) ? 0 : /^\d+(?:-\d+)?$/.test(row.episodes) || /完|電影|剧场|劇場/.test(row.episodes) ? 1 : 5, episodes};
    }
    async getVideoList(url) {
        const episode = a1Post(A1_BASE + "/", url);
        if (!episode) throw a1Error("URL", "集數網址格式錯誤");
        const result = await this._get(episode, "html");
        if (a1Post(A1_BASE + "/", result.url) !== episode) throw a1Error("EPISODE", "網站沒有回到指定集數");
        const document = new Document(result.body), id = /\/(\d+)$/.exec(episode)[1], post = a1First(document, "#post-" + id);
        if (!post) throw a1Error("EPISODE", "未辨識到這一集的播放器");
        const videos = [], seen = new Set(), requests = post.select("video[data-apireq]");
        if (!requests.length) throw a1Error("PLAYER", "這一集沒有支援的站方播放器，請在來源 WebView 確認");
        for (let index = 0; index < requests.length; index++) {
            const data = requests[index].attr("data-apireq");
            if (!data || data.length > 16384 || /[&\r\n\u0000]/.test(data)) throw a1Error("PLAYER", "站方播放請求格式已變更");
            let response;
            try { response = await this.client.post(A1_API, {Referer: episode, Origin: A1_BASE, "Content-Type": "application/x-www-form-urlencoded"}, "d=" + data); }
            catch (_) { throw a1Error("PLAYBACK", "站方播放介面未回應，請稍後重新開啟此集"); }
            if (Number(response.statusCode) !== 200) throw a1Error("PLAYBACK", "站方暫時無法提供影片，請先在來源 WebView 確認這一集");
            if (response.request && response.request.url && response.request.url !== A1_API) throw a1Error("PLAYBACK", "播放介面發生非預期轉址，請在來源 WebView 確認");
            let playback; try { playback = JSON.parse(response.body); } catch (_) { throw a1Error("PLAYBACK", "站方播放介面格式已變更"); }
            if (!playback || !Array.isArray(playback.s) || !playback.s.length) throw a1Error("PLAYBACK", "站方沒有回傳可播放的影片");
            const cookie = a1PlaybackCookies(response.headers);
            for (const source of playback.s) {
                if (!source || typeof source !== "object") continue;
                const media = a1Media(source.src);
                if (!media || seen.has(media)) continue;
                seen.add(media);
                videos.push({url: media, originalUrl: media, quality: (requests.length > 1 ? "片段 " + (index + 1) + " · " : "") + (/\.m3u8(?:\?|$)/i.test(media) ? "原始 HLS" : "原始 MP4"),
                    headers: {Referer: episode, Origin: A1_BASE, Cookie: cookie}});
            }
        }
        if (!videos.length) throw a1Error("MEDIA", "影片網址不在站方支援的播放網域，請更新套件或回報");
        return videos;
    }
}
