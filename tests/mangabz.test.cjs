const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {Document,parseHTML}=require('./helpers/harness.cjs');
const {ingestFresh,readingOrder}=require('./helpers/app-chapter-identity.cjs');
const {readerHeaders,downloadHeaders}=require('./helpers/app-image-headers.cjs');
const base='https://www.mangabz.com',chapter=base+'/m101/';
const reply=(url,body,statusCode=200)=>({statusCode,body,request:{url}});
const chapterHtml=(id=101,count=3)=>`<script>var MANGABZ_CID=${id};var MANGABZ_MID=1;var MANGABZ_IMAGE_COUNT=${count};var MANGABZ_VIEWSIGN_DT='2026-10-24 12:34:56';var MANGABZ_VIEWSIGN='a+b&c';</script>`;
const imageScript=(files=['/1.jpg','/2.jpg'],id=101,prefix='https://image.mangabz.com/1/1/101')=>`function dm5imagefun(){var cid=${id};var key='abc';var pix=${JSON.stringify(prefix)};var pvalue=${JSON.stringify(files)};for(var i=0;i<pvalue.length;i++){pvalue[i]=pix+pvalue[i]+'?cid=${id}&key=abc&uk='}return pvalue}var d;d=dm5imagefun();`;
const detail=(sort=2)=>`<script>var MANGABZ_COMIC_MID=1;var MANGABZ_COMIC_SORT=${sort};</script><p class="detail-info-title">測試作品</p><img class="detail-info-cover" src="https://cover.mangabz.com/cover.jpg"><p class="detail-info-tip">作者：<a href="/search?title=甲">甲</a>狀態：連載中<span class="item">冒險</span></p><p class="detail-info-content">完整介紹</p><div id="chapterlistload">${(sort===2?[103,102,101]:[101,102,103]).map(id=>`<a class="detail-list-form-item hide" href="/m${id}/">第${id-100}話<span>（15P）</span></a>`).join('')}<a href="/m101/">重複</a></div>`;
const list=(pagination='',empty=false)=>`<div class="result-title">搜索結果</div><ul class="mh-list">${empty?'':'<li><div class="mh-item"><a href="/1bz/"><img class="mh-cover" src="https://cover.mangabz.com/cover.jpg"></a><h2 class="title"><a href="/1bz/">作品</a></h2></div></li>'}</ul><div class="page-pagination">${pagination}</div>`;
function load({get=async()=>{throw Error('Unexpected request');},browser=async()=>{throw Error('Unexpected browser');}}={}){
 class Client{get(...args){return get(...args);}}
 const context=vm.createContext({Document,Client,MProvider:class{},evaluateJavascriptViaWebview:browser});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../javascript/manga/src/zh/mangabz.js'),'utf8')+';globalThis.ext=new DefaultExtension()',context);return {ext:context.ext,context};
}
test('Mangabz has a unique native manga source ID and stays out of anime and novel indexes',()=>{
 const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'../'+f),'utf8'));
 const entry=read('index.json').find(x=>x.id===1827634458);assert.equal(entry.name,'Mangabz');assert.equal(entry.itemType,0);assert.equal(entry.isManga,true);assert.match(entry.sourceCodeUrl,/manga\/src\/zh\/mangabz.js$/);assert.ok(![...read('anime_index.json'),...read('novel_index.json')].some(x=>x.id===entry.id));
});
test('catalogue and search use observed distinct pagination URLs and keep Chinese query characters',async()=>{
 const calls=[];const {ext}=load({get:async url=>{calls.push(url);return reply(url,list(url.includes('search?')?'<a href="/search?title=狗與剪刀&amp;page=3">3</a>':'<a data-index="3" href="/manga-list-p3/">3</a>'));}});
 assert.equal((await ext.getPopular(2)).hasNextPage,true);assert.equal((await ext.getLatestUpdates(3)).hasNextPage,false);const found=await ext.search('狗與剪刀 & +',2);assert.equal(found.list.length,1);assert.equal(found.hasNextPage,true);assert.equal(calls[0],base+'/manga-list-p2/');assert.equal(calls[1],base+'/manga-list-0-0-2-p3/');assert.equal(new URL(calls[2]).searchParams.get('title'),'狗與剪刀 & +');assert.equal(new URL(calls[2]).searchParams.get('page'),'2');
 assert.equal((await ext.search('',1)).list.length,0);assert.equal(calls.length,3);
});
test('a real empty search succeeds but missing catalogue markup fails explicitly',async()=>{
 const {ext}=load({get:async url=>reply(url,list('',true))});assert.equal((await ext.search('無結果',1)).list.length,0);
 await assert.rejects(load({get:async url=>reply(url,'<html>changed</html>')}).ext.getPopular(1),/BZ-LIST/);
});
test('hidden chapters, repeated labels and all reading positions survive app ingestion',async()=>{
 for(const sort of [1,2]){
  const {ext}=load({get:async url=>reply(url,detail(sort))});const d=await ext.getDetail('/1bz/');assert.equal(d.chapters.length,3);assert.equal(d.author,'甲');assert.equal(d.status,0);assert.equal(ingestFresh(d.name,Array.from(d.chapters)).length,3);assert.deepEqual(readingOrder(d.name,d.chapters).map(c=>c.url),[101,102,103].map(id=>base+'/m'+id+'/'));assert.equal(d.chapters.at(-1).name,'0001｜第１話');assert.ok(!d.chapters[0].name.includes('P'));
 }
});
test('wrong book identity and missing chapter lists never become empty successful details',async()=>{
 for(const html of [detail().replace('MANGABZ_COMIC_MID=1','MANGABZ_COMIC_MID=2'),detail().replace('chapterlistload','changed')])await assert.rejects(load({get:async url=>reply(url,html)}).ext.getDetail('/1bz/'),/BZ-(?:DETAIL|CHAPTERS)/);
});
test('image handler is paged to the full declared count with correctly encoded public reader tokens',async()=>{
 const calls=[];const {ext}=load({get:async(url,headers)=>{calls.push({url,headers});if(url===chapter)return reply(url,chapterHtml());const page=Number(new URL(url).searchParams.get('page'));return reply(url,imageScript(page===1?['/1.jpg','/2.jpg']:['/3.jpg']));}});
 const pages=Array.from(await ext.getPageList('/m101/'));assert.equal(pages.length,3);assert.deepEqual(pages.map(p=>new URL(p.url).pathname.split('/').at(-1)),['1.jpg','2.jpg','3.jpg']);assert.equal(calls.length,3);
 for(const call of calls.slice(1)){const q=new URL(call.url).searchParams;assert.equal(q.get('_sign'),'a+b&c');assert.equal(q.get('_dt'),'2026-10-24 12:34:56');assert.equal(q.get('cid'),'101');assert.equal(call.headers.Referer,chapter);}
 const independent=load().ext;assert.equal(independent.getHeaders(base).Referer,undefined);
 for(const p of pages){assert.equal(readerHeaders(p,independent.getHeaders(base)).Referer,chapter);assert.equal(downloadHeaders(p,independent.getHeaders(base)).Referer,chapter);}
});
test('packed image response is decoded as string data without running its JavaScript',async()=>{
 const script=imageScript(),packed='eval(function(p,a,c,k,e,d){throw new Error("MUST NOT RUN");return p;}('+JSON.stringify(script)+',62,1,"".split("|"),0,{}))';
 const {ext}=load({get:async url=>reply(url,url===chapter?chapterHtml(101,2):packed)});assert.equal((await ext.getPageList(chapter)).length,2);
});
test('wrong chapters, repeated batches, missing files, malicious expressions and foreign image hosts fail without partial lists',async()=>{
 for(const handler of [imageScript(['/1.jpg'],102),imageScript(['/1.jpg'],'101','https://image.mangabz.com.evil.test'),imageScript(['/1.jpg']).replace('["/1.jpg"]','["/1.jpg",run()]'),imageScript(['/1.jpg']).replace("+'?cid=101&key=abc&uk='","+'?cid=101&key=abc&uk='+run()"),imageScript(['/1.jpg']),imageScript([])]){
  const {ext}=load({get:async url=>reply(url,url===chapter?chapterHtml():handler)});await assert.rejects(ext.getPageList(chapter),/BZ-(?:CHAPTER|IMAGES|IMAGE-HOST|INCOMPLETE)/);
 }
 await assert.rejects(load({get:async url=>reply(url,chapterHtml(102))}).ext.getPageList(chapter),/BZ-CHAPTER/);
});
test('URL validation rejects foreign origins and public chapter redirects to a different ID',async()=>{
 const {ext}=load();for(const url of ['https://www.mangabz.com.evil.test/m101/','https://evil.test/m101/','javascript:alert(1)'])await assert.rejects(ext.getPageList(url),/BZ-URL/);
 await assert.rejects(load({get:async()=>reply(base+'/m102/',chapterHtml())}).ext.getPageList(chapter),/BZ-URL/);
});
test('challenge fallback uses normal WebView, rate limiting is not retried and challenge results stay errors',async()=>{
 let calls=0;const {ext}=load({get:async url=>reply(url,'blocked',403),browser:async url=>{calls++;return JSON.stringify({kind:'page',url,status:200,body:list()});}});assert.equal((await ext.getPopular(1)).list.length,1);assert.equal(calls,1);
 const rate=load({get:async url=>reply(url,'limited',429),browser:async()=>{throw Error('Must not retry');}}).ext;await assert.rejects(rate.getPopular(1),/BZ-RATE/);
 await assert.rejects(load({get:async url=>reply(url,'blocked',403),browser:async()=>JSON.stringify({kind:'challenge'})}).ext.getPopular(1),/BZ-CHALLENGE/);
});
test('browser handler fetch stays on the public origin and never extracts cookies',async()=>{
 const {context}=load(),endpoint=chapter+'chapterimage.ashx?cid=101';context.endpoint=endpoint;
 const script=vm.runInContext('bzBrowserScript(endpoint)',context),{document}=parseHTML('<html><body></body></html>');Object.defineProperty(document,'cookie',{get(){throw Error('No cookie access');}});let data,request;
 const browser={window:{flutter_inappwebview:{callHandler:async(_,raw)=>{data=JSON.parse(raw);}}},document,location:new URL(chapter),URL,fetch:async(url,options)=>{request={url,options};return {url,status:200,text:async()=>imageScript()};}};
 await vm.runInNewContext(script,browser);assert.equal(data.kind,'page');assert.equal(request.options.credentials,'same-origin');assert.equal(request.url,endpoint);
 context.endpoint='https://evil.test/chapterimage.ashx';await vm.runInNewContext(vm.runInContext('bzBrowserScript(endpoint)',context),{...browser,fetch:async()=>{throw Error('No outside request');}});assert.equal(data.kind,'outside');
});
