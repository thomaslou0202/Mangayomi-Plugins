/* Official desktop reader bridge. Never executes scripts from fetched chapters. */
async function lvDesktopFetch(options) {
    const bridge = window.flutter_inappwebview;
    if (!bridge || window[options.nonce]) return;
    window[options.nonce] = true;
    const reply = (kind, extra) => bridge.callHandler("setResponse", JSON.stringify({kind, url: location.href, ...extra}));
    const trusted = value => {
        const u = new URL(value);
        return u.protocol === "https:" && u.hostname === "www.linovelib.com" && !u.username && !u.password && (!u.port || u.port === "443");
    };
    try {
        if (!trusted(location.href) || new URL(location.href).pathname !== "/robots.txt") return reply("outside");
        if (nChallenge(document.documentElement.outerHTML)) return reply("challenge");
        if (options.platformOnly) return reply("platform", {windows: /Win/i.test(navigator.platform || "")});
        const target = new URL(options.target);
        if (!trusted(target.href) || target.pathname !== options.path) return reply("outside");
        const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 15000);
        let response, html;
        try { response = await fetch(target.href, {cache: "no-store", signal: abort.signal}); html = await response.text(); }
        finally { clearTimeout(timer); }
        if (!trusted(response.url) || new URL(response.url).pathname !== options.path) return reply("outside");
        if (nChallenge(html)) return reply("challenge");
        if (response.status === 429) return reply("rate");
        if (!response.ok) return reply("http-error", {status: response.status});
        const d = new DOMParser().parseFromString(html, "text/html"), content = d.querySelector("#TextContent");
        const identity = [...d.querySelectorAll("script")].map(s => s.textContent).find(s => /\bvar\s+ReadParams\s*=/.test(s)) || "";
        const params = {};
        for (const m of identity.matchAll(/\b(articleid|chapterid|page|chapterisvip)\s*:\s*(?:['"]([^'"\\]*)['"]|(\d+))/g)) params[m[1]] = m[2] === undefined ? m[3] : m[2];
        if (params.articleid !== options.book || params.chapterid !== options.chapter || Number(params.page) !== options.part) return reply("wrong-chapter");
        if (params.chapterisvip !== "0") return reply("vip");
        if (!content || (!content.textContent.trim() && !content.querySelector("img")) || lvEmbeddedReaderFailure(content.textContent)) return reply("incomplete");
        // The desktop response is complete before the chapterlog script adds decoys.
        // Reject a changed response format rather than returning obfuscated text.
        const unusualLayout = [...content.querySelectorAll('style,[hidden],[style*="transform"],[style*="visibility"],[style*="display"],[style*="opacity"]')]
            .some(e => !e.closest("ins,.adsbygoogle"));
        if ([...content.querySelectorAll("*")].some(e => [...e.attributes].some(a => a.name.startsWith("data-k"))) || unusualLayout) return reply("incomplete");
        const next = [...d.querySelectorAll("a[href]")].find(a => /^(?:下一|下)[页頁章]/.test(a.textContent.replace(/\s/g, "")));
        if (!next) return reply("missing-next");
        const href = next.getAttribute("href") || "";
        if (/^javascript:/i.test(href) && /没有|沒有|最后|最後/.test(href)) params.url_next = "";
        else {
            const u = new URL(href, target.href);
            if (!trusted(u.href) || !new RegExp("^/novel/" + options.book + "/[1-9]\\d*(?:_[1-9]\\d*)?\\.html$").test(u.pathname)) return reply("wrong-next");
            params.url_next = "https://tw.linovelib.com" + u.pathname;
        }
        const copy = content.cloneNode(true);
        for (const e of copy.querySelectorAll("script,style,iframe,object,embed,noscript,form,input,textarea,button,select,ins,.adsbygoogle")) e.remove();
        for (const img of copy.querySelectorAll("img")) {
            const raw = img.getAttribute("data-src") || img.getAttribute("src") || "";
            const u = new URL(raw, target.href);
            if (raw && u.protocol === "https:" && ["www.linovelib.com", "tw.linovelib.com", "img3.readpai.com"].includes(u.hostname) && !u.username && !u.password && (!u.port || u.port === "443")) {
                img.setAttribute("src", u.href); img.removeAttribute("data-src");
            } else img.remove();
        }
        return reply("desktop-page", {desktopUrl: response.url, canonicalUrl: options.canonical, params, html: '<div id="acontent">' + copy.innerHTML + '</div>'});
    } catch (_) { return reply("browser-error"); }
}

function lvDesktopScript(options) {
    return "(function(){const nChallenge=" + nChallenge.toString() + ";const lvEmbeddedReaderFailure=" + lvEmbeddedReaderFailure.toString() + ";return (" + lvDesktopFetch.toString() + ")(" + JSON.stringify({...options, nonce: "__lv_desktop_" + Date.now().toString(36) + Math.random().toString(36).slice(2)}) + ");})()";
}
