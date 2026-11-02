const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {load,page,parseHTML}=require('./helpers/harness.cjs');
const {ingestFresh,readingOrder}=require('./helpers/app-chapter-identity.cjs');
const base='https://tw.linovelib.com',book=base+'/novel/123.html',chapter=base+'/novel/123/900.html';
const cards='<a class="book-layout" href="/novel/123.html"><img src="/loading.svg" data-src="/files/123.jpg" alt="完整的作品書名"><h4 class="book-title">被截斷的...</h4></a><a class="book-layout" href="https://ad.invalid/novel/456.html"><h4>廣告</h4></a><a href="/wenku/allvisit_0_0_0_0_0_0_0_2_0.html">2</a>';
const detail='<h1>作品</h1><meta property="og:title" content="測試作品"><meta property="og:novel:author" content="作者"><meta property="og:description" content="簡介"><meta property="og:image" content="/cover.jpg"><meta property="og:novel:status" content="連載">';
const toc='<div id="volumes"><div class="catalog-volume"><li class="chapter-bar"><h3>第一卷</h3></li><li class="jsChapter"><a href="/novel/123/900.html">第1章</a></li><li class="jsChapter"><a href="/novel/123/901.html">插圖</a></li></div><div class="catalog-volume"><li class="chapter-bar"><h3>第二卷</h3></li><li class="jsChapter"><a href="/novel/123/902.html">第1章</a></li></div></div>';
const response=(url,body)=>({statusCode:200,request:{url},body});
function renderCapture(script,html,params,{width=390,elapsed=false,beforeCapture,onResponse}={}) {
 const {document}=parseHTML(html);Object.defineProperty(document,'readyState',{value:'complete'});
 for(const e of document.querySelectorAll('*'))e.getBoundingClientRect=()=>({width:e.style.transform&&e.style.transform!=='none'?0:100,height:e.style.transform&&e.style.transform!=='none'?0:20});
 if(beforeCapture)beforeCapture(document);
 let result='';
 const clock=elapsed?{now:(()=>{let n=0;return()=>n++*20000;})()}:Date;
 vm.runInNewContext(script,{document,location:{href:chapter},Date:clock,URL,setTimeout,window:{innerWidth:width,ReadParams:params,getComputedStyle:e=>({display:e.style.display||'block',visibility:e.style.visibility||'visible',opacity:e.style.opacity||'1',transform:e.style.transform||'none'}),flutter_inappwebview:{callHandler:(name,body)=>{result=body;if(onResponse)onResponse(body);}}}});
 return result;
}

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
 assert.match(work.chapters[0].name,/0003 \| 第二卷/);
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
 const {ext}=load('linovelib',{http:async()=>({statusCode:403,body:'blocked'}),browser:async(url,headers,scripts)=>{captured=renderCapture(scripts[0],reader(),params);return captured;}});
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

test('Linovelib retries transport/server failures once without browser execution',async()=>{
 for(const failure of [new Error('temporary socket failure'),502,503,504]) {
  let calls=0,browsers=0;
  const {ext,context}=load('linovelib',{http:async()=>{calls++;if(calls===1){if(failure instanceof Error)throw failure;return {statusCode:failure,body:'temporary'};}return {statusCode:200,body:reader()};},browser:async()=>{browsers++;throw Error('unexpected');}});
  context.setTimeout=fn=>fn();
  assert.match(await ext.getHtmlContent('作品',chapter),/正文甲/);assert.equal(calls,2);assert.equal(browsers,0);
 }
});
test('Linovelib never retries rate limits or missing chapters',async()=>{
 for(const statusCode of [429,404]) {
  let calls=0;const {ext,context}=load('linovelib',{http:async()=>{calls++;return {statusCode,body:'error'};}});context.setTimeout=fn=>fn();
  await assert.rejects(ext.getHtmlContent('作品',chapter),statusCode===429?/LN-RATE/:/LN-NOT-FOUND/);assert.equal(calls,1);
 }
});
test('Linovelib retries only the failed subpage and retains earlier content once',async()=>{
 const calls=[];let second=0;
 const {ext,context}=load('linovelib',{http:async url=>{calls.push(url);return {statusCode:200,body:url===chapter?reader(1,'/novel/123/900_2.html','<p>第一頁</p>'):reader(2,'/novel/123/901.html',++second<3?'<p>內容加載失敗，請稍後重試。</p>':'<p>第二頁</p>')};}});context.setTimeout=fn=>fn();
 const html=await ext.getHtmlContent('作品',chapter);assert.match(html,/第一頁/);assert.match(html,/第二頁/);assert.doesNotMatch(html,/加載失敗/);assert.equal((html.match(/第一頁/g)||[]).length,1);assert.equal(calls.filter(url=>url===chapter).length,1);assert.equal(second,3);
});
test('Linovelib persistent placeholder throws instead of returning partial content',async()=>{
 let calls=0;const {ext,context}=load('linovelib',{http:async()=>{calls++;return {statusCode:200,body:reader(1,'/novel/123/901.html','<p>内容加载失败</p>')};}});context.setTimeout=fn=>fn();
 await assert.rejects(ext.getHtmlContent('作品',chapter),/LN-CONTENT-TEMPORARY/);assert.equal(calls,3);
});
test('Linovelib does not retry ordinary prose that mentions a loading error',async()=>{
 let calls=0;const {ext}=load('linovelib',{http:async()=>{calls++;return {statusCode:200,body:reader(1,'/novel/123/901.html','<p>畫面顯示內容加載失敗，他嘆了一口氣。</p>')};}});
 assert.match(await ext.getHtmlContent('作品',chapter),/他嘆了一口氣/);assert.equal(calls,1);
});

test('Linovelib removes the whole book name and formats the requested Mushoku chapter labels',async()=>{
 const name='無職轉生 ～到了異世界就拿出真本事～';
 const meta=detail.replace('測試作品',name);
 const labels=['插圖','序章','第一話「難道是：異世界」'];
 const catalogue='<div id="volumes"><div class="catalog-volume"><li class="chapter-bar"><h3>無職轉生 ~ 到了異世界就拿出真本事 ~ 1 幼年期</h3></li>'+labels.map((title,i)=>'<li class="jsChapter"><a href="/novel/123/'+(900+i)+'.html">'+title+'</a></li>').join('')+'</div></div>';
 const {ext}=load('linovelib',{http:async url=>response(url,url.endsWith('/catalog')?catalogue:meta)});
 const work=await ext.getDetail(book),ordered=readingOrder(name,ingestFresh(name,work.chapters));
 assert.deepEqual(ordered.map(c=>c.name),['0001 | 第一卷 幼年期 插圖','0002 | 第一卷 幼年期 序章','0003 | 第一卷 幼年期 第一話「難道是：異世界」']);
 assert.deepEqual(ordered.map(c=>c.url),[900,901,902].map(id=>base+'/novel/123/'+id+'.html'));
});
test('Linovelib retains other titles, prose-like chapter names and repeated volume labels',()=>{
 const {ext,context}=load('linovelib');
 assert.equal(vm.runInContext('lvWithoutBookName("無職轉生外傳 第一話", "無職轉生")',context),'無職轉生外傳 第一話');
 assert.equal(vm.runInContext('lvWithoutBookName("第一話「無職轉生」", "無職轉生")',context),'第一話「無職轉生」');
 assert.equal(vm.runInContext('lvWithoutBookName("作品 ~ 副標 ~ １２ 幼年期", "作品～副標～")',context),'１２ 幼年期');
 assert.equal(vm.runInContext('lvWithoutBookName("第一卷", "")',context),'第一卷');
 const catalogue=toc.replaceAll('第一卷','測試作品 1 幼年期').replaceAll('第二卷','測試作品 2 少年期');
 const chapters=ext._chapters(catalogue,'123','測試作品');
 assert.equal(chapters.length,3);assert.equal(chapters[2].name,'0001 | 第一卷 幼年期 第１章');assert.equal(chapters[0].name,'0003 | 第二卷 少年期 第１章');
 assert.equal(ingestFresh('測試作品',chapters).length,3);
 const titled=ext._chapters(toc.replace('第1章','測試作品'),'123','測試作品');assert.equal(titled.length,3);assert.match(titled[2].name,/測試作品$/);
});

test('Linovelib unifies only Arabic volume numbers into Chinese volume labels',()=>{
 const {context}=load('linovelib');
 const cases=[['1 幼年期','第一卷 幼年期'],['17 青年期 阿斯拉王國篇（後）','第十七卷 青年期 阿斯拉王國篇（後）'],['第１７卷 青年期','第十七卷 青年期'],['17卷青年期','第十七卷 青年期'],['17冊 青年期','第十七卷 青年期'],['０ 序篇','第零卷 序篇'],['10','第十卷'],['11','第十一卷'],['20','第二十卷'],['101 番外','第一百零一卷 番外'],['110 番外','第一百一十卷 番外'],['1001 番外','第一千零一卷 番外'],['001 幼年期','第一卷 幼年期'],['第十六卷 青年期 阿斯拉王國篇·前','第十六卷 青年期 阿斯拉王國篇·前'],['短篇','短篇'],['BD特典 1','BD特典 1'],['2026年 特別篇','2026年 特別篇'],['17歲的少年','17歲的少年'],['1.5 番外','1.5 番外']];
 for(const [input,expected]of cases)assert.equal(vm.runInContext('lvVolumeLabel('+JSON.stringify(input)+')',context),expected,input);
});
test('Linovelib mixed Arabic and Chinese volumes keep sequential chapter identity',()=>{
 const {ext}=load('linovelib');
 const catalogue='<div id="volumes">'+['第十六卷 青年期 阿斯拉王國篇·前','17 青年期 阿斯拉王國篇（後）'].map((v,i)=>'<div class="catalog-volume"><li class="chapter-bar"><h3>'+v+'</h3></li><li class="jsChapter"><a href="/novel/123/'+(900+i)+'.html">第十話「第17個計畫」</a></li></div>').join('')+'</div>';
 const chapters=ext._chapters(catalogue,'123','測試作品'),ordered=readingOrder('測試作品',ingestFresh('測試作品',chapters));
 assert.deepEqual(ordered.map(c=>c.name),['0001 | 第十六卷 青年期 阿斯拉王國篇·前 第十話「第１７個計畫」','0002 | 第十七卷 青年期 阿斯拉王國篇（後） 第十話「第１７個計畫」']);
 assert.deepEqual(ordered.map(c=>c.url),[chapter,base+'/novel/123/901.html']);
});

test('Linovelib renders dynamic reader pages and removes hidden injected paragraphs',async()=>{
 const params={articleid:'123',chapterid:'900',page:'1',chapterisvip:'0',url_next:'/novel/123/901.html'};
 const raw=reader().replace('</body>','<script src="/chapterlog.js"></script></body>');
 const html='<div id="acontent"><p data-k1>日記最後一頁</p><p data-k2 style="transform:matrix(0,0,0,0,0,0)">愛夏露出燦爛的笑容。</p><div style="display:none"><p>咦？怎麼突然這麼問？</p></div><p data-k3>正確接續的正文</p><img data-src="https://img3.readpai.com/a.jpg"><p data-k4>完整章末</p></div>';
 let browsers=0;
 const {ext}=load('linovelib',{http:async url=>response(url,raw),browser:async(url,headers,scripts)=>{browsers++;assert.match(headers['User-Agent'],/Android.*Mobile/);return renderCapture(scripts[0],html,params);}});
 const result=await ext.getHtmlContent('章',chapter);assert.equal(browsers,1);assert.match(result,/日記最後一頁[\s\S]*正確接續的正文[\s\S]*完整章末/);assert.match(result,/img3.readpai.com/);assert.doesNotMatch(result,/燦爛|突然/);
});
test('Linovelib rejects wide desktop rendering rather than returning incomplete text',async()=>{
 let calls=0;const params={articleid:'123',chapterid:'900',page:'1',chapterisvip:'0',url_next:'/novel/123/901.html'};
 const {ext}=load('linovelib',{http:async url=>response(url,reader()+'<script src="/chapterlog.js"></script>'),browser:async(url,headers,scripts)=>{calls++;return renderCapture(scripts[0],reader(),params,{width:1280});}});
 await assert.rejects(ext.getHtmlContent('章',chapter),/LN-READER-VIEWPORT/);assert.equal(calls,1);
});
test('Linovelib retries temporary rendered page failures without duplicating earlier subpages',async()=>{
 let second=0;const calls=[];
 const {ext,context}=load('linovelib',{http:async url=>response(url,reader()+'<script src="/chapterlog.js"></script>'),browser:async url=>{calls.push(url);if(url.includes('_2')){if(++second===1)throw Error('temporary WebView failure');return page(url,reader(2,'/novel/123/901.html','<p>第二頁完整章末</p>'));}return page(url,reader(1,'/novel/123/900_2.html','<p>第一頁正文</p>'));}});context.setTimeout=fn=>fn();
 const result=await ext.getHtmlContent('章',chapter);assert.equal(calls.filter(url=>url===chapter).length,1);assert.equal(second,2);assert.equal((result.match(/第一頁正文/g)||[]).length,1);assert.match(result,/第二頁完整章末/);
});
test('Linovelib embedded loading failures never become successful partial chapter content',async()=>{
 let calls=0;const params={articleid:'123',chapterid:'900',page:'1',chapterisvip:'0',url_next:'/novel/123/901.html'};
 const html=reader(1,'/novel/123/901.html','<p>前段正文（內容加載失敗！請重載或更換瀏覽器）</p>');
 const {ext,context}=load('linovelib',{http:async url=>response(url,html),browser:async(url,headers,scripts)=>{calls++;return renderCapture(scripts[0],html,params,{elapsed:true});}});context.setTimeout=fn=>fn();
 await assert.rejects(ext.getHtmlContent('章',chapter),/LN-CONTENT-TEMPORARY/);assert.equal(calls,3);
});
test('Linovelib does not retry rendered verification pages or offsite navigation',async()=>{
 for(const [result,code] of [[{kind:'challenge',url:chapter},'VERIFY'],[{kind:'page',url:'https://ad.invalid/',html:reader()},'URL']]){
  let calls=0;const {ext}=load('linovelib',{http:async url=>response(url,reader()+'<script src="/chapterlog.js"></script>'),browser:async()=>{calls++;return JSON.stringify(result);}});
  await assert.rejects(ext.getHtmlContent('章',chapter),new RegExp('LN-'+code));assert.equal(calls,1);
 }
});

test('Linovelib waits for paragraph layout markers before returning reader text',async()=>{
 const params={articleid:'123',chapterid:'900',page:'1',chapterisvip:'0',url_next:'/novel/123/901.html'};
 const html='<div id="acontent"><p>正常正文</p><p>尚未隱藏的干擾</p></div><script src="/chapterlog.js"></script>';
 let prepared=false;
 const {ext}=load('linovelib',{http:async url=>response(url,html),browser:async(url,headers,scripts)=>new Promise(resolve=>{
  renderCapture(scripts[0],html,params,{beforeCapture:doc=>setTimeout(()=>{const p=doc.querySelectorAll('#acontent p');p[0].setAttribute('data-k1','');p[1].setAttribute('data-k2','');p[1].style.transform='matrix(0,0,0,0,0,0)';prepared=true;},20),onResponse:body=>{assert.equal(prepared,true);resolve(body);}});
 })});
 const result=await ext.getHtmlContent('章',chapter);assert.match(result,/正常正文/);assert.doesNotMatch(result,/尚未隱藏/);
});
test('Linovelib missing runtime chapter identity is an incomplete page',async()=>{
 const {ext}=load('linovelib',{browser:async(url,headers,scripts)=>renderCapture(scripts[0],reader(),{},{elapsed:true})});
 await assert.rejects(ext._capture(chapter,'#acontent',false,0,true),/LN-CONTENT-TEMPORARY/);
});
test('Linovelib rendered illustration-only chapters retain lazy offscreen images',async()=>{
 const params={articleid:'123',chapterid:'900',page:'1',chapterisvip:'0',url_next:'/novel/123/901.html'};
 const html='<div id="acontent"><img style="opacity:0" src="/loading.svg" data-src="https://img3.readpai.com/illustration.jpg"></div><script src="/chapterlog.js"></script>';
 const {ext}=load('linovelib',{http:async url=>response(url,html),browser:async(url,headers,scripts)=>renderCapture(scripts[0],html,params)});
 assert.match(await ext.getHtmlContent('插圖',chapter),/img3.readpai.com\/illustration.jpg/);
});
