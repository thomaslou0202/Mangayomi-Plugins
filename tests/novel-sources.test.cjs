const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const {load,page,parseHTML}=require('./helpers/harness.cjs');
const {ingestFresh,readingOrder}=require('./helpers/app-chapter-identity.cjs');
const sfBase='https://book.sfacg.com',ebBase='https://www.8book.com',twBase='https://www.twbook.cc';
const sfList=`<div class="list_tabs"><ul class="Comic_Pic_List"><li><img src="http://rs.sfacg.com/cover.jpg"></li><li><strong><a href="/Novel/12/">測試作品</a></strong></li></ul></div><ul class="pagebar"><li><a href="?PageIndex=2">下一頁</a></li></ul>`;
const ebList=`<div class="card"><div class="border_gray"><img src="/pics/test.jpg"><a class="nowraphide" href="/novelbooks/12"><li class="nowraphide"><font>測試作品</font></li><li>分類與簡介</li></a></div></div><div id="x_pager"><a href="2.html">下一頁</a></div>`;
const twList=`<div class="search-list"><ul class="list"><li><img src="https://i1.twbook.cc/test.jpg"><h3><a href="/00012345/">測試作品</a></h3><p>簡介</p></li></ul></div><div class="pagination"><a href="?page=2">下一頁</a></div>`;
const sfToc=`<div class="story-catalog"><h3 class="catalog-title">【測試作品】第一卷</h3><div class="catalog-list"><a href="/Novel/12/90/101/">序章</a><a href="/Novel/12/90/102/">Ch. 1</a></div></div><div class="story-catalog"><h3 class="catalog-title">【測試作品】第二卷</h3><div class="catalog-list"><a href="/Novel/12/91/103/">Ep. 1</a><a href="/vip/c/104/">VIP 章節 2</a><a href="/Novel/12/90/101/">重複</a><a href="/Novel/13/91/103/">其他作品</a><a href="https://evil.test/Novel/12/90/105/">外站</a></div></div>`;
const ebToc=`<div id="chapters"><div class="folder"><div class="vol-title"><h3>第一卷 / 2</h3></div><span class="fc">2</span><a class="episode_li" href="//sport.thepaperbooks.com/read/12/?101">序章</a><a class="episode_li" href="/read/12/?102">第1章</a></div><div class="folder"><div class="vol-title"><h3>第二卷 / 1</h3></div><span class="fc">1</span><a class="episode_li" href="/read/12/?103">第1章</a><a class="episode_li" href="/read/13/?104">其他作品</a></div></div>`;
const twToc=`<div class="meta-dir"><span>章節：3</span></div><div class="chaplist"><a href="/00012345/3.html">最新重複</a><ul class="all"><li><a href="/00012345/3.html">第3章</a></li><li><a href="/00012345/1.html">第1章</a></li><li><a href="/00012345/2.html">第2章</a></li><li><a href="/00012345/2.html">重複</a></li><li><a href="/00012346/4.html">其他作品</a></li></ul></div>`;
const font={fontFile:'f24092.woff2',fontHash:'4287ef986834d02762283c9265285cd7aa29b90c1dc1e7671d959359786c7db2'};

for(const [source,base,html]of [['sfacg',sfBase,sfList],['eightbook',ebBase,ebList],['twbook',twBase,twList]]) {
    test(source+': list excludes navigation, keeps title/cover and next-page link',()=>{
        const {ext}=load(source);const url=base+(source==='sfacg'?'/List/default.aspx?PageIndex=1':source==='eightbook'?'/booklists/rank/1.html':'/bookstack/?page=1');
        const result=ext._list(html,url,1,false);assert.equal(result.list.length,1);assert.equal(result.list[0].name,'測試作品');assert.match(result.list[0].imageUrl,/^https:/);assert.equal(result.hasNextPage,true);
    });
    test(source+': empty query makes no request and invalid category falls back',async()=>{
        const visited=[];const {ext}=load(source,{preferences:{category:'../../evil'},browser:async url=>{visited.push(url);return page(url,html);}});
        assert.equal((await ext.search(' ',1,[])).list.length,0);assert.equal(visited.length,0);await ext.getPopular(1);assert.equal(visited.length,1);assert.ok(!visited[0].includes('evil'));
    });
    test(source+': login verification failures are explicit and do not look like empty lists',async()=>{
        for(const kind of ['challenge','outside']) {
            const {ext}=load(source,{browser:async url=>JSON.stringify({kind,url})});
            await assert.rejects(ext.getPopular(1),kind==='challenge'?/CHALLENGE/:/URL/);
        }
        const {ext}=load(source,{browser:async()=>'{bad json'});await assert.rejects(ext.getPopular(1),/RESPONSE/);
    });
    test(source+': rejects untrusted chapter URLs before requesting a page',async()=>{
        const {ext}=load(source);await assert.rejects(ext.getHtmlContent('章節','https://evil.test/1.html'),/URL/);
    });
}
test('SF: traditional search converts words, UTF-8 encodes query and empty result is valid',async()=>{
    let visited='';const {ext}=load('sfacg',{browser:async url=>{visited=url;return page(url,'<h1>共搜索到0个结果</h1>');}});
    assert.equal((await ext.search('狗與剪刀',1,[])).list.length,0);assert.equal(new URL(visited).searchParams.get('Key'),'狗与剪刀');
    assert.equal((await ext.search('狗',2,[])).list.length,0);
});
test('SF: recognizes search result covers and excludes other media',()=>{
    const {ext}=load('sfacg');const html='<img id="SearchResultList1___ResultList_Cover_0" src="//rs.sfacg.com/a.jpg"><strong><a id="SearchResultList1___ResultList_LinkInfo_0" href="https://book.sfacg.com/Novel/12">書名</a></strong><a href="https://manhua.sfacg.com/Novel/99">漫畫</a>';
    const result=ext._list(html,'https://s.sfacg.com/',1,true);assert.equal(result.list.length,1);assert.equal(result.list[0].imageUrl,'https://rs.sfacg.com/a.jpg');
});
test('SF: VIP chapter is labelled in TOC and blocked clearly without a request',async()=>{
    const {ext}=load('sfacg');const chapters=ext._chapters(sfToc,sfBase+'/Novel/12/MainIndex/','12');
    assert.equal(chapters.length,4);assert.match(chapters[0].name,/VIP/);await assert.rejects(ext.getHtmlContent(chapters[0].name,chapters[0].url),/SF-VIP/);
});
test('SF: title badges are excluded and complete free/VIP TOC is returned',async()=>{
    const detail='<div class="summary-content"><h1 class="title"><span class="text">測試作品<span class="tag blue">VIP</span><span class="tag">2026</span></span></h1></div><div class="summary-pic"><img src="//rs.sfacg.com/c.jpg"></div><div class="author-name">作者</div><p class="introduce">簡介</p>';
    const {ext}=load('sfacg',{browser:async url=>page(url,url.includes('MainIndex')?sfToc:detail)});const result=await ext.getDetail(sfBase+'/Novel/12/');assert.equal(result.name,'測試作品');assert.equal(result.chapters.length,4);assert.equal(result.author,'作者');
});
for(const [source,base,toc,book,expected]of [['sfacg',sfBase,sfToc,'12',4],['eightbook',ebBase,ebToc,'12',3],['twbook',twBase,twToc,'00012345',3]]) {
    test(source+': complete unique catalogue survives native app dedup and reader next/previous sorting',()=>{
        const {ext}=load(source);const chapters=Array.from(ext._chapters(toc,base+'/',book));assert.equal(chapters.length,expected);
        const reading=chapters.slice().reverse();assert.equal(ingestFresh('測試作品',chapters).length,expected);
        const shuffled=chapters.filter((_,i)=>i%2===0).reverse().concat(chapters.filter((_,i)=>i%2));
        assert.deepEqual(readingOrder('測試作品',shuffled).map(c=>c.url),reading.map(c=>c.url));
        assert.deepEqual(chapters.slice().sort((a,b)=>a.name<b.name?-1:1).map(c=>c.url),reading.map(c=>c.url));
        assert.ok(reading.every((c,i)=>c.name.startsWith(String(i+1).padStart(4,'0')+'｜')));
    });
}
test('8book: refuses incomplete volume instead of silently losing chapters',()=>{
    const {ext}=load('eightbook');assert.throws(()=>ext._chapters(ebToc.replace('class="fc">2','class="fc">30'),ebBase+'/','12'),/TOC-PARTIAL/);
});
test('TW: full directory excludes newest-chapter duplicates and refuses partial TOC',()=>{
    const {ext}=load('twbook');assert.throws(()=>ext._chapters(twToc.replace('章節：3','章節：5'),twBase+'/','00012345'),/TOC-PARTIAL/);
});
test('8book: actual site reader redirect retains chapter identity and body HTML is sanitized',async()=>{
    const {ext}=load('eightbook',{browser:async url=>page(url.replace('www.8book.com','sport.thepaperbooks.com'),'<div id="text"><p onclick="bad()">正文甲</p><script>bad()</script><img src="https://evil.test/pixel"><img src="https://www.8book.com/a.jpg"></div>')});
    ext.readers.set(ebBase+'/read/12/?101','sport.thepaperbooks.com');
    const result=await ext.getHtmlContent('<測試>',ebBase+'/read/12/?101');assert.match(result,/正文甲/);assert.match(result,/&lt;測試&gt;/);assert.ok(!/script|onclick|evil/.test(result));assert.match(result,/8book.com\/a.jpg/);
});
test('8book: different returned chapter is rejected',async()=>{
    const {ext}=load('eightbook',{browser:async()=>page(ebBase+'/read/12/?102','<div id="text">正文</div>')});ext.readers.set(ebBase+'/read/12/?101','www.8book.com');await assert.rejects(ext.getHtmlContent('章節',ebBase+'/read/12/?101'),/CHAPTER/);
});
test('8book: fresh runtime discovers a different reader host from this book TOC and keeps its images',async()=>{
    const visited=[];const {ext}=load('eightbook',{browser:async url=>{
        visited.push(url);return url.includes('/novelbooks/')?page(url,ebToc.replaceAll('sport.thepaperbooks.com','finance.binaccount.com'))
            :page(url.replace('www.8book.com','finance.binaccount.com'),'<div id="text"><p>正文</p><img src="/illustration.jpg"><img src="https://evil.test/a.jpg"></div>');
    }});
    const result=await ext.getHtmlContent('章節',ebBase+'/read/12/?101');assert.equal(visited.length,2);assert.match(visited[0],/novelbooks\/12/);assert.match(result,/https:\/\/finance.binaccount.com\/illustration.jpg/);assert.ok(!result.includes('evil.test'));
});
test('8book: refuses a redirect to a reader not linked for this chapter',async()=>{
    const {ext}=load('eightbook',{browser:async url=>page(url.replace('www.8book.com','finance.binaccount.com'),'<div id="text">正文</div>')});
    ext.readers.set(ebBase+'/read/12/?101','sport.thepaperbooks.com');await assert.rejects(ext.getHtmlContent('章節',ebBase+'/read/12/?101'),/8B-URL/);
});
test('TW: maps known display glyphs in text, keeps URL attributes and verifies font identity',()=>{
    const {ext}=load('twbook');assert.equal(ext._decode('<p>꿁年놋侍</p><img src="/꿁.jpg">',font),'<p>少年有侍</p><img src="/꿁.jpg">');
    assert.throws(()=>ext._decode('꿁',{...font,fontHash:'different'}),/FONT-UPDATED/);
});
test('TW: reads chapter subpages without following the next chapter or changing book ID',async()=>{
    const visited=[];const {ext}=load('twbook',{browser:async url=>{visited.push(url);return page(url,'<div class="chapter-content"><div class="content"><p>꿁年正文'+(url.includes('_2')?'乙':'甲')+'</p></div></div><div class="foot-nav">'+(url.includes('_2')?'<a href="/00012345/2.html">下一章</a>':'<a href="/00012345/1_2.html">下一頁</a>')+'</div>',font);}});
    const result=await ext.getHtmlContent('第一章',twBase+'/00012345/1.html');assert.equal(visited.length,2);assert.match(result,/少年正文甲/);assert.match(result,/少年正文乙/);assert.ok(visited.every(url=>url.includes('/00012345/1')));
});
test('10,003 chapter names retain global numbering, width and app reader order',()=>{
    const {context}=load('sfacg');const entries=Array.from({length:10003},(_,i)=>({name:'Volume 1 · Ep. 1',url:sfBase+'/Novel/12/1/'+(i+1)+'/'}));
    context.entries=entries;const chapters=Array.from(vm.runInContext('nNumberChapters(entries)',context));assert.match(chapters.at(-1).name,/^00001｜/);assert.equal(ingestFresh('測試作品',chapters).length,10003);assert.equal(readingOrder('測試作品',chapters)[10002].url,entries[10002].url);
});
test('page requests serialize and recover after one failure',async()=>{
    let active=0,max=0,calls=0;const {ext}=load('sfacg',{browser:async url=>{active++;max=Math.max(max,active);const call=calls++;await new Promise(r=>setTimeout(r,3));active--;if(!call)throw new Error('failure');return page(url,'<html>ok</html>');}});
    const results=await Promise.allSettled([ext._page(sfBase+'/1'),ext._page(sfBase+'/2'),ext._page(sfBase+'/3')]);assert.equal(max,1);assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
});
test('browser script retains books inside forms, removes controls/widgets and does not mutate live DOM',async()=>{
    const {context}=load('eightbook');const script=vm.runInContext('nBrowserScript({hosts:["www.8book.com"],nonce:"test"})',context);
    const {document}=parseHTML('<html><head><title>正常網頁</title></head><body><form action="/post"><input value="secret"><textarea>secret</textarea><div class="card">測試書籍</div></form><div class="gadBlock">廣告</div><script>bad()</script></body></html>');
    let reply;const window={flutter_inappwebview:{callHandler:async(name,value)=>{reply=JSON.parse(value);}}};
    await vm.runInNewContext(script,{window,document,location:new URL(ebBase+'/'),URL,setTimeout,clearTimeout});assert.equal(reply.kind,'page');assert.match(reply.html,/測試書籍/);assert.ok(!/secret|<form|<script|廣告/.test(reply.html));assert.equal(document.querySelector('input').getAttribute('value'),'secret');
});
test('browser script waits for dynamic content before replying',async()=>{
    const {context}=load('eightbook');const script=vm.runInContext('nBrowserScript({hosts:["www.8book.com"],nonce:"dynamic",waitFor:"#text"})',context);
    const {document}=parseHTML('<html><body><div id="text"></div></body></html>');let complete;
    const result=new Promise(resolve=>complete=resolve);const window={flutter_inappwebview:{callHandler:async(name,value)=>complete(JSON.parse(value))}};
    vm.runInNewContext(script,{window,document,location:new URL(ebBase+'/'),URL,setTimeout,clearTimeout});setTimeout(()=>{document.querySelector('#text').textContent='動態正文';},15);const reply=await result;assert.match(reply.html,/動態正文/);
});
test('browser font capture uses allowlisted public CSS/font without credentials and hashes bytes',async()=>{
    const {context}=load('twbook');const script=vm.runInContext('nBrowserScript({hosts:["www.twbook.cc"],nonce:"font",fonts:true})',context);
    const {document}=parseHTML('<html><head><link rel="stylesheet" href="https://i1.twbook.cc/min/read.38.css"></head><body>正文</body></html>');
    const bytes=Uint8Array.of(1,2,3);let reply;const requests=[];
    const fetch=async(url,options)=>{requests.push({url,options});return url.endsWith('.css')?{ok:true,text:async()=>"@font-face{font-family:'bqg';src:url(/fonts/f24092.woff2) format('woff2')}",}:{ok:true,arrayBuffer:async()=>bytes.buffer};};
    const window={flutter_inappwebview:{callHandler:async(name,value)=>{reply=JSON.parse(value);}}};
    await vm.runInNewContext(script,{window,document,location:new URL(twBase+'/'),URL,fetch,crypto:crypto.webcrypto,AbortController,Uint8Array,setTimeout,clearTimeout});
    assert.equal(reply.kind,'page');assert.equal(reply.fontFile,font.fontFile);assert.equal(reply.fontHash,crypto.createHash('sha256').update(bytes).digest('hex'));assert.equal(requests.length,2);assert.ok(requests.every(r=>r.options.credentials==='omit'));
});
