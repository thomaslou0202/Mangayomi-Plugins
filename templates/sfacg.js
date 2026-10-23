/* SFACG native novel source. MIT; OpenCC search data: Apache-2.0. */
const mangayomiSources = [{
    name: "SF輕小說（測試版）", id: 1827634453, lang: "zh", baseUrl: "https://book.sfacg.com", apiUrl: "",
    iconUrl: "https://book.sfacg.com/favicon.ico", typeSource: "single", itemType: 2, isManga: false,
    sourceCodeLanguage: 1, version: "0.1.0", appMinVerReq: "0.9.9", pkgPath: "novel/src/zh/sfacg.js",
    hasCloudflare: true, isNsfw: false, notes: "支援書庫、繁簡中文搜尋及免費章節。VIP 章節保留於目錄並標示；本版不支援付費正文。"
}];
const N_SITE = {name: "SF輕小說", code: "SF", base: "https://book.sfacg.com", hosts: ["book.sfacg.com", "s.sfacg.com"], images: ["rs.sfacg.com", "rss.sfacg.com", "book.sfacg.com"]};
/*__OPENCC_NOTICE__*/
const SF_SEARCH_T2S = /*__T2S_DICT__*/;
const SF_SEARCH_MAX = /*__T2S_MAX__*/;
/*__COMMON__*/
const SF_GENRES = [["-1", "全部"], ["21", "魔幻"], ["22", "玄幻"], ["23", "古風"], ["24", "科幻"], ["25", "校園"], ["26", "都市"], ["27", "遊戲"], ["28", "同人"], ["29", "懸疑"]];
function sfBook(base, value) { const url = nAbsolute(base, value); const match = /^https:\/\/book\.sfacg\.com\/Novel\/(\d+)\/?(?:[?#].*)?$/i.exec(url); return match ? N_SITE.base + "/Novel/" + match[1] + "/" : ""; }
function sfChapter(base, value, bookId) {
    const url = nAbsolute(base, value);
    const free = /^https:\/\/book\.sfacg\.com\/Novel\/(\d+)\/(\d+)\/(\d+)\/?(?:[?#].*)?$/i.exec(url);
    if (free && (!bookId || free[1] === bookId)) return N_SITE.base + "/Novel/" + free.slice(1).join("/") + "/";
    const vip = /^https:\/\/book\.sfacg\.com\/vip\/c\/(\d+)\/?(?:[?#].*)?$/i.exec(url);
    return vip ? N_SITE.base + "/vip/c/" + vip[1] + "/" : "";
}
function sfSearchText(query) {
    const chars = Array.from(query), output = [];
    for (let index = 0; index < chars.length;) {
        let found = false;
        for (let size = Math.min(SF_SEARCH_MAX, chars.length - index); size > 0; size--) {
            const key = chars.slice(index, index + size).join("");
            if (Object.prototype.hasOwnProperty.call(SF_SEARCH_T2S, key)) { output.push(SF_SEARCH_T2S[key]); index += size; found = true; break; }
        }
        if (!found) output.push(chars[index++]);
    }
    return output.join("");
}
class DefaultExtension extends NativeNovel {
    getSourcePreferences() { return [{key: "category", listPreference: {title: "書庫分類", summary: "切換後重新整理來源首頁。", valueIndex: 0, entries: SF_GENRES.map(item => item[1]), entryValues: SF_GENRES.map(item => item[0])}}]; }
    _list(html, url, page, search) {
        const document = new Document(html), list = [], seen = new Set();
        const cards = search ? document.select('a[id*="_ResultList_LinkInfo_"]') : document.select("ul.Comic_Pic_List");
        for (const card of cards) {
            const anchor = search ? card : nFirst(card, "strong a[href]");
            if (!anchor) continue;
            const link = sfBook(url, anchor.attr("href")), name = nClean(anchor.text);
            if (!link || !name || seen.has(link)) continue;
            seen.add(link);
            const image = search ? nFirst(document, '[id="' + anchor.attr("id").replace("LinkInfo_", "Cover_") + '"]') : nFirst(card, "img");
            list.push({name, link, imageUrl: image ? nImage(url, image.attr("data-src") || image.attr("src")) : ""});
        }
        if (!list.length && !(search ? /共搜索到\s*0\s*个结果/.test(html) : nFirst(document, ".list_tabs"))) throw nError("LIST", "未辨識到書籍清單，網站可能已改版");
        return {list, hasNextPage: !search && list.length > 0 && nNext(document, url, page, ".pagebar a[href]", "PageIndex")};
    }
    async getPopular(page) {
        page = nPage(page);
        const category = await this._preference("category", SF_GENRES.map(item => item[0]), "-1");
        const result = await this._page(N_SITE.base + "/List/default.aspx?tid=" + category + "&PageIndex=" + page);
        return this._list(result.html, result.url, page, false);
    }
    async search(query, page) {
        query = String(query || "").trim(); page = nPage(page);
        if (!query || page > 1) return {list: [], hasNextPage: false};
        const direct = sfBook(N_SITE.base + "/", /^\d+$/.test(query) ? "/Novel/" + query + "/" : query);
        if (direct) { const detail = await this.getDetail(direct); return {list: [{name: detail.name, link: direct, imageUrl: detail.imageUrl}], hasNextPage: false}; }
        const result = await this._page("https://s.sfacg.com/?Key=" + encodeURIComponent(sfSearchText(query)) + "&S=1&SS=0");
        return this._list(result.html, result.url, page, true);
    }
    _chapters(html, url, bookId) {
        const document = new Document(html), entries = [];
        for (const group of document.select(".story-catalog")) {
            const volume = nText(group, ".catalog-title").replace(/^【[^]*?】\s*/, "");
            for (const anchor of group.select(".catalog-list a[href]")) {
                const chapter = sfChapter(url, anchor.attr("href"), bookId);
                let title = nClean(anchor.attr("title") || anchor.text).replace(/^VIP\s*/i, "");
                if (chapter && title) entries.push({url: chapter, name: (volume ? volume + " · " : "") + (/\/vip\/c\//.test(chapter) ? "【VIP】" : "") + title});
            }
        }
        return nNumberChapters(entries);
    }
    async getDetail(url) {
        const book = sfBook(N_SITE.base + "/", url);
        if (!book) throw nError("URL", "請使用 SF 書籍網址");
        const result = await this._page(book), document = new Document(result.html);
        if (sfBook(N_SITE.base + "/", result.url) !== book) throw nError("BOOK", "網站未回到指定作品");
        const title = nFirst(document, ".summary-content h1.title .text");
        const name = title ? nClean(nPlain(title.innerHtml.replace(/<span\b[^>]*class=["'][^"']*\btag\b[^"']*["'][^>]*>[^]*?<\/span>/gi, ""))) : "";
        if (!name) throw nError("DETAIL", "未辨識到作品資料");
        const toc = await this._page(book + "MainIndex/");
        if (toc.url.split(/[?#]/)[0].replace(/\/$/, "") !== (book + "MainIndex").replace(/\/$/, "")) throw nError("TOC", "網站未回到指定目錄");
        return {name, link: book, imageUrl: nImage(result.url, nAttr(document, ".summary-pic img", "src")), author: nText(document, ".author-name"),
            description: nText(document, ".introduce"), genre: document.select('.d-summary a[href*="/stag/"]').map(node => nClean(node.text).replace(/^[^\u4e00-\u9fffA-Za-z]+/, "")),
            status: /已完结|已完結/.test(nText(document, ".count-detail")) ? 1 : /连载中|連載中/.test(nText(document, ".count-detail")) ? 0 : 5,
            chapters: this._chapters(toc.html, toc.url, /\/Novel\/(\d+)/i.exec(book)[1])};
    }
    async getHtmlContent(name, url) {
        const chapter = sfChapter(N_SITE.base + "/", url);
        if (!chapter) throw nError("URL", "章節網址格式錯誤");
        if (/\/vip\/c\//.test(chapter)) throw nError("VIP", "這是付費章節，本版僅支援免費正文；請到官方網站或 App 使用已購買的閱讀權限");
        const result = await this._page(chapter, {waitFor: "#ChapterBody"});
        if (sfChapter(N_SITE.base + "/", result.url) !== chapter) throw nError("CHAPTER", "網站未回到指定章節");
        const content = nFirst(new Document(result.html), "#ChapterBody");
        if (!content) throw nError("CONTENT", "未取得免費章節正文，請在來源 WebView 確認");
        return nArticle(name, content.innerHtml, result.url);
    }
}
