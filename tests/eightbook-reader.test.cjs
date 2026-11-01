const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {load}=require('./helpers/harness.cjs');
const base='https://www.8book.com',chapter=base+'/read/12/?101';
function reader(mode='substr',extra='') {
 const route=mode==='substr'?"q.substr(q.length-three,five),three":"q * three % modulus,five";
 const digits=mode==='substr'?'0'.repeat(101)+'246':'123456789987654321';
 return `<meta name="itemid" content="12"><div id="text"></div><script>var seven=7;var two=2;var one=1;var three=3;var five=5;var modulus=4;var table="101,102,${digits}".split(',');${extra}$.get(unescape((typeof(td)!='undefined'?td:'')+'%2f%'+seven+'4%78%74%2f9%'+two+'f12%2f'+q+table[table.length-one].substr(${route})+'%2e%68%'+seven+'4%6d%6c'),function(text){window.location='https://ads.invalid/';});</script>`;
}
function urlFor(html){const{context}=load('eightbook');context.html=html;return vm.runInContext(`ebContentUrl(html, '${chapter}')`,context);}

test('8book resolves both public loader variants without executing page scripts',()=>{
 assert.equal(urlFor(reader()),base+'/txt/9/12/101246.html');
 assert.equal(urlFor(reader('mod','throw new Error("must not execute");')),base+'/txt/9/12/10145678.html');
});
test('8book direct HTTP reader avoids WebView and preserves a long complete chapter',async()=>{
 const calls=[];const body=Array.from({length:281},(_,i)=>'第'+i+'段測試正文<br>').join('');
 const {ext}=load('eightbook',{http:async(url,headers)=>{calls.push({url,headers});return {statusCode:200,request:{url},body:url.includes('/txt/')?body:reader('mod')};}});
 const result=await ext.getHtmlContent('長章節',chapter);assert.equal(calls.length,2);assert.match(calls[1].url,/\/txt\/9\/12\/10145678\.html$/);assert.equal(calls[1].headers.Referer,chapter);assert.match(calls[0].headers['User-Agent'],/Windows/);assert.match(result,/第280段/);assert.equal((result.match(/<br>/g)||[]).length,281);
});
test('8book catalogue, search and detail also use HTTP without loading ad scripts',async()=>{
 const urls=[];
 const list='<div class="card"><div class="border_gray"><a class="nowraphide" href="/novelbooks/12/"><img src="/cover.jpg"><li class="nowraphide">測試作品</li></a></div></div>';
 const detail='<meta property="og:title" content="測試作品"><div id="chapters"><div class="folder"><div class="vol-title"><h3>第一卷 / 1</h3></div><span class="fc">1</span><a class="episode_li" href="https://finance.binaccount.com/read/12/?101">第一章</a></div></div>';
 const {ext}=load('eightbook',{http:async url=>{urls.push(url);return {statusCode:200,request:{url},body:url.includes('/novelbooks/')?detail:list};}});
 assert.equal((await ext.getPopular(1)).list[0].name,'測試作品');
 assert.equal((await ext.getLatestUpdates(1)).list.length,1);
 assert.equal((await ext.search('測試',1)).list.length,1);
 assert.equal((await ext.getDetail(base+'/novelbooks/12/')).chapters.length,1);
 assert.equal(urls.length,4);
});
test('8book decodes charset-less UTF-8 from Dart latin1 fallback',async()=>{
 const {ext}=load('eightbook',{http:async url=>({statusCode:200,request:{url},body:Buffer.from(url.includes('/txt/')?'<p>中文正文與插圖</p>':reader('mod'),'utf8').toString('latin1')})});
 assert.match(await ext.getHtmlContent('測試',chapter),/中文正文與插圖/);
});
test('8book public body removes scripts, handlers and unrelated images',async()=>{
 const {ext}=load('eightbook',{http:async url=>({statusCode:200,request:{url},body:url.includes('/txt/')?'<p onclick="bad()">正文</p><script>bad()</script><img src="https://www.8book.com/illustration.jpg"><img src="https://ads.invalid/pixel">':reader('mod')})});
 const body=await ext.getHtmlContent('章',chapter);assert.match(body,/illustration.jpg/);assert.doesNotMatch(body,/bad\(|onclick|ads.invalid/);
});
test('8book rejects missing chapter identity, unfamiliar operations, and offsite HTTP redirects',async()=>{
 assert.throws(()=>urlFor(reader('mod').replace('content="12"','content="13"')),/CHAPTER/);
 assert.throws(()=>urlFor(reader('mod').replace('101,102,','103,104,')),/CHAPTER/);
 assert.throws(()=>urlFor(reader('mod').replace('q * three % modulus','q.constructor(three)')),/LOADER/);
 assert.throws(()=>urlFor(reader('mod').replace("'%2f%'","'https://evil.invalid/%'")),/LOADER/);
 const {ext}=load('eightbook',{http:async()=>({statusCode:200,request:{url:'https://ads.invalid/'},body:reader('mod')})});await assert.rejects(ext.getHtmlContent('章',chapter),/8B-URL/);
});
test('8book does not return an HTTP error document as chapter content or retry rate limits',async()=>{
 const {ext}=load('eightbook',{http:async url=>({statusCode:200,request:{url},body:url.includes('/txt/')?'<html><title>404.Not Found</title></html>':reader('mod')})});await assert.rejects(ext.getHtmlContent('章',chapter),/8B-CONTENT/);
 const limited=load('eightbook',{http:async()=>({statusCode:429,body:'rate limit'})}).ext;await assert.rejects(limited.getHtmlContent('章',chapter),/8B-RATE/);
});
