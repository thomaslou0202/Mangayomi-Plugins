const test = require('node:test');
const assert = require('node:assert/strict');
const {load, parseHTML} = require('./helpers/harness.cjs');

const chapterUrl = 'https://www.wenku8.net/novel/3/3152/138935.htm';
function source(content, preferences = {}, url = chapterUrl) {
    const {ext} = load('wenku8', {preferences});
    ext.source = {baseUrl: 'https://www.wenku8.net'};
    ext._getPage = async () => ({url, html: '<div id="content">' + content + '</div>'});
    return ext;
}

test('Wenku8: illustration chapter keeps all images without the old WebView banner', async () => {
    const images = Array.from({length: 17}, (_, i) => '<img src="https://pic.wenku8.com/' + i + '.jpg">').join('<br>');
    const html = await source(images).getHtmlContent('0009｜第一卷 · 插圖', chapterUrl);
    const document = parseHTML(html).document;
    assert.equal(document.querySelectorAll('img').length, 17);
    assert.equal(document.querySelectorAll('a').length, 0);
    assert.doesNotMatch(html, /在 App [內内]查看|共 17 [張张]/);
    assert.equal(document.querySelector('article').children[1].tagName.toLowerCase(), 'img');
});

test('Wenku8: mixed text and illustrations keep body order and safe image URLs', async () => {
    const html = await source('<p>插圖前</p><img src="http://pic.wenku8.com/a.jpg" alt="甲&amp;乙"><p>插圖後</p><img data-src="/pictures/b.jpg">')
        .getHtmlContent('章節', chapterUrl);
    const document = parseHTML(html).document;
    assert.equal(document.querySelectorAll('a').length, 0);
    assert.deepEqual(Array.from(document.querySelectorAll('img'), node => node.getAttribute('src')),
        ['https://pic.wenku8.com/a.jpg', 'https://www.wenku8.net/pictures/b.jpg']);
    assert.equal(document.querySelector('img').getAttribute('alt'), '甲&乙');
    assert.ok(html.indexOf('插圖前') < html.indexOf('<img'));
    assert.ok(html.indexOf('<img') < html.indexOf('插圖後'));
});

test('Wenku8: text-only chapters get no illustration link and blank chapters still fail', async () => {
    const ext = source('<p>正常正文</p><script><img src="https://example.test/ad.jpg"></script><img src="javascript:alert(1)">');
    const html = await ext.getHtmlContent('正常章節', chapterUrl);
    const document = parseHTML(html).document;
    assert.equal(document.querySelectorAll('a, img, script').length, 0);
    assert.match(document.querySelector('article').textContent, /正常正文/);
    await assert.rejects(source('<img src="data:image/png;base64,AAA">').getHtmlContent('空章節', chapterUrl), /章節正文是空的/);
});

test('Wenku8: repeated cleaning retains images and escapes the chapter heading', async () => {
    const url = chapterUrl + '?a=1&b=2';
    const ext = source('<img src="https://pic.wenku8.com/a.jpg">', {}, url);
    const html = await ext.getHtmlContent('插圖 <img src=x onerror=alert(1)>', url);
    assert.equal(parseHTML(html).document.querySelector('h3').textContent, '插圖 <img src=x onerror=alert(1)>');
    const once = await ext.cleanHtmlContent(html);
    const twice = await ext.cleanHtmlContent(once);
    assert.equal(twice, once);
    const document = parseHTML(twice).document;
    assert.equal(document.querySelectorAll('a').length, 0);
    assert.equal(document.querySelectorAll('img').length, 1);
});

test('Wenku8: cleaning retains only site chapter links and drops event handlers', async () => {
    const ext = source('');
    const html = await ext.cleanHtmlContent('<a href="/novel/3/3152/138935.htm" onclick="alert(1)" target="_blank">章節</a>'
        + '<a href="javascript:alert(1)">腳本</a><a href="https://evil.test/novel/3/3152/138935.htm">外站</a>'
        + '<a href="https://www.wenku8.net@evil.test/novel/3/3152/138935.htm">偽裝</a><a href="/login.php">登入</a>');
    const document = parseHTML(html).document;
    assert.equal(document.querySelectorAll('a').length, 1);
    assert.deepEqual(Array.from(document.querySelector('a').attributes, attr => attr.name), ['href']);
    assert.equal(document.querySelector('a').getAttribute('href'), chapterUrl);
    assert.match(html, /腳本.*外站.*偽裝.*登入/);
});

test('Wenku8: neither language setting adds the removed illustration action', async () => {
    for (const traditionalChinese of [true, false]) {
        const html = await source('<img src="https://pic.wenku8.com/a.jpg">', {traditionalChinese})
            .getHtmlContent('插图', chapterUrl);
        assert.equal(parseHTML(html).document.querySelectorAll('img').length, 1);
        assert.equal(parseHTML(html).document.querySelectorAll('a').length, 0);
        assert.doesNotMatch(html, /在 App [內内]查看/);
    }
});

test('Wenku8: image wrappers do not hide illustrations or introduce navigation', async () => {
    const html = await source('<a href="https://pic.wenku8.com/a.jpg"><img src="https://pic.wenku8.com/a.jpg"></a>'
        + '<br><a href="https://pic.wenku8.com/b.jpg"><img src="https://pic.wenku8.com/b.jpg"></a>')
        .getHtmlContent('插圖', chapterUrl);
    const document = parseHTML(html).document;
    assert.equal(document.querySelectorAll('a').length, 0);
    assert.deepEqual(Array.from(document.querySelectorAll('img'), img => img.getAttribute('src')),
        ['https://pic.wenku8.com/a.jpg', 'https://pic.wenku8.com/b.jpg']);
});
