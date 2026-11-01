const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {load,page,parseHTML}=require('./helpers/harness.cjs');
const {ingestFresh,readingOrder}=require('./helpers/app-chapter-identity.cjs');
const base='https://tw.linovelib.com',book=base+'/novel/123.html',chapter=base+'/novel/123/900.html';
const cards='<a class="book-layout" href="/novel/123.html"><img src="/loading.svg" data-src="/files/123.jpg" alt="完整的作品書名"><h4 class="book-title">被截斷的...</h4></a><a class="book-layout" href="https://ad.invalid/novel/456.html"><h4>廣告</h4></a><a href="/wenku/allvisit_0_0_0_0_0_0_0_2_0.html">2</a>';
const detail='<h1>作品</h1><meta property="og:title" content="測試作品"><meta property="og:novel:author" content="作者"><meta property="og:description" content="簡介"><meta property="og:image" content="/cover.jpg"><meta property="og:novel:status" content="連載">';
const toc='<div id="volumes"><div class="catalog-volume"><li class="chapter-bar"><h3>第一卷</h3></li><li class="jsChapter"><a href="/novel/123/900.html">第1章</a></li><li class="jsChapter"><a href="/novel/123/901.html">插圖</a></li></div><div class="catalog-volume"><li class="chapter-bar"><h3>第二卷</h3></li><li class="jsChapter"><a href="/novel/123/902.html">第1章</a></li></div></div>';
const response=(url,body)=>({statusCode:200,request:{url},body});
function reader(part=1,next='/novel/123/901.html',body='<p>正文甲</p>',extra={}){
 const data={articleid:'123',chapterid:'900',page:String(part),chapterisvip:'0',url_next:next,...extra};
 return '<html><body><div id="acontent">'+body+'</div><script>var ReadParams={'+Object.entries(data).map(([k,v])=>k+':'+JSON.stringify(v)).join(',')+'};throw new Error("do not execute");</script></body></html>';
}
test('Linovelib is a native novel source and public catalogue supports pagination',async()=>{
 const urls=[];const {ext}=load('linovelib',{http:async url=>{urls.push(url);return response(url,cards);}});
 const found=await ext.getPopular(1);assert.equal(found.list.length,1);assert.equal(found.list[0].name,'完整的作品書名');assert.equal(found.list[0].imageUrl,base+'/files/123.jpg');assert.equal(found.hasNextPage,true);
 await ext.getLatestUpdates(2);assert.match(urls[0],/allvisit_0_0_0_0_0_0_0_1_0/);assert.match(urls[1],/lastupdate_0_0_0_0_0_0_0_2_0/);
});
test('Linovelib full volume catalogue survives repeated chapter labels and app reader sorting',async()=>{
 const {ext}=load('linovelib',{http:async url=>response(url,url.endsWith('/catalog')?toc:detail)});const work=await ext.getDetail(book);assert.equal(work.name,'測試作品');assert.equal(work.author,'作者');assert.equal(work.chapters.length,3);
 const chapters=ingestFresh(work.name,work.chapters);assert.equal(chapters.length,3);assert.deepEqual(Array.from(readingOrder(work.name,chapters),c=>c.url),[900,901,902].map(id=>base+'/novel/123/'+id+'.html'));
 assert.match(work.chapters[0].name,/0003｜第二卷/);
});
test('Linovelib reads every subpage and stops before the next chapter',async()=>{
 const urls=[];const {ext}=load('linovelib',{http:async url=>{urls.push(url);return response(url,url.includes('_2')?reader(2, '/novel/123/901.html','<p>正文乙</p>'):reader(1,'/novel/123/900_2.html'));}});
 const html=await ext.getHtmlContent('測試章',chapter);assert.match(html,/正文甲/);assert.match(html,/正文乙/);assert.equal(urls.length,2);assert.doesNotMatch(html,/do not execute/);
});
test('Linovelib illustrations keep lazy image URLs and reject tracking or handlers',async()=>{
 const {ext}=load('linovelib',{http:async url=>response(url,reader(1, '/novel/123/901.html','<img src="/loading.svg" data-src="https://img3.readpai.com/123/900/1.jpg" onerror="bad()"><img src="https://ad.invalid/pixel"><p onclick="bad()">正文</p>'))});
 const html=await ext.getHtmlContent('插圖',chapter);assert.match(html,/img3.readpai.com\/123\/900\/1.jpg/);assert.doesNotMatch(html,/loading.svg|ad.invalid|onerror|onclick/);
});
test('Linovelib validates identity, VIP, missing/repeated pages and offsite continuation',async()=>{
 for(const [html,code]of [[reader(1, '/novel/123/901.html','正文',{chapterid:'999'}),'CHAPTER'],[reader(1,'/novel/123/901.html','正文',{chapterisvip:'1'}),'VIP'],[reader(1,'/novel/123/900.html'),'PAGES'],[reader(1,'/novel/123/900_3.html'),'PAGES'],[reader(1,'https://ad.invalid/a'),'PAGES']]){
  const{ext}=load('linovelib',{http:async url=>response(url,html)});await assert.rejects(ext.getHtmlContent('章',chapter),new RegExp('LN-'+code));
 }
 const {ext}=load('linovelib');await assert.rejects(ext.getHtmlContent('章','https://evil.invalid/novel/123/900.html'),/LN-URL/);
});
test('Linovelib search uses the site Google engine and keeps unique book pages only',async()=>{
 let request='';const {ext}=load('linovelib',{browser:async url=>{request=url;return page(url,'<div class="gsc-webResult"><a class="gs-title" data-ctorig="'+book+'">測試作品 - 嗶哩輕小說</a><a class="gs-title" href="'+book+'">重複</a><a class="gs-title" href="'+chapter+'">某章節</a><a class="gs-title" href="https://evil.invalid/novel/456.html">廣告</a></div><div class="gsc-cursor-page gsc-cursor-current-page">1</div><div class="gsc-cursor-page">2</div>');}});
 const result=await ext.search('無職',1);assert.equal(new URL(request).hostname,'cse.google.com');assert.equal(new URL(request).searchParams.get('cx'),'649de34f5e63448cb');assert.equal(new URL(request).searchParams.get('q'),'無職');assert.equal(result.list.length,1);assert.equal(result.list[0].name,'測試作品');assert.equal(result.hasNextPage,true);
});
test('Linovelib direct ID search avoids Google and empty queries make no requests',async()=>{
 let requests=0;const {ext}=load('linovelib',{http:async url=>{requests++;return response(url,url.endsWith('/catalog')?toc:detail);}});assert.equal((await ext.search('',1)).list.length,0);assert.equal(requests,0);assert.equal((await ext.search('123',1)).list[0].link,book);assert.equal(requests,2);assert.equal((await ext.search('123',2)).list.length,0);
});
test('Linovelib normal browser fallback retains reading params without account fields',async()=>{
 const {document}=parseHTML(reader());let captured='';const params={articleid:'123',chapterid:'900',page:'1',chapterisvip:'0',url_next:'/novel/123/901.html',userid:'private',token:'secret'};
 const {ext}=load('linovelib',{http:async()=>({statusCode:403,body:'blocked'}),browser:async(url,headers,scripts)=>{vm.runInNewContext(scripts[0],{document,location:{href:url},Date,URL,setTimeout,window:{ReadParams:params,flutter_inappwebview:{callHandler:(name,body)=>captured=body}}});return captured;}});
 assert.match(await ext.getHtmlContent('章',chapter),/正文甲/);assert.doesNotMatch(captured,/private|secret|throw new Error/);
});
test('Linovelib search waits for the requested page rather than a temporarily visible previous page',async()=>{
 const{document}=parseHTML('<html><body><div class="gsc-webResult"><a class="gs-title" href="'+book+'">作品</a></div><div class="gsc-cursor-page gsc-cursor-current-page">1</div></body></html>');
 const{ext}=load('linovelib',{browser:async(url,headers,scripts)=>new Promise(resolve=>{
  vm.runInNewContext(scripts[0],{document,location:{href:url},Date,URL,setTimeout,window:{flutter_inappwebview:{callHandler:(name,body)=>resolve(body)}}});
  setTimeout(()=>document.querySelector('.gsc-cursor-current-page').textContent='2',20);
 })});
 assert.equal((await ext.search('作品',2)).list.length,1);
});
test('Linovelib reports verification, offsite replies, unknown data and wrong search pages',async()=>{
 const blocked=load('linovelib',{http:async()=>({statusCode:403}),browser:async url=>JSON.stringify({kind:'challenge',url})}).ext;await assert.rejects(blocked.getDetail(book),/LN-VERIFY/);
 const offsite=load('linovelib',{http:async()=>({statusCode:200,request:{url:'https://evil.invalid/'},body:detail})}).ext;await assert.rejects(offsite.getDetail(book),/LN-URL/);
 const unknown=load('linovelib',{http:async url=>response(url,'<div id="acontent">正文</div>')}).ext;await assert.rejects(unknown.getHtmlContent('章',chapter),/LN-PARAMS/);
 const wrong=load('linovelib',{browser:async url=>page(url,'<div class="gs-no-results-result">無結果</div><div class="gsc-cursor-current-page">1</div>')}).ext;await assert.rejects(wrong.search('作品',2),/LN-SEARCH-PAGE/);
});
