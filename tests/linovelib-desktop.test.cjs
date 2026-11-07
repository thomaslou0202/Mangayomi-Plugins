const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {DOMParser}=require('linkedom');
const {load,parseHTML}=require('./helpers/harness.cjs');
const base='https://tw.linovelib.com',first=base+'/novel/123/900.html';
function fixture(part=1,next='/novel/123/901.html',body='<p>头发，准备出发。</p>',params={}){
 const values={articleid:'123',chapterid:'900',page:String(part),chapterisvip:'0',...params};
 return '<html><body><div id="TextContent">'+body+'<ins class="adsbygoogle" style="display:block"></ins></div><a href="'+next.replaceAll('"','&quot;')+'">下一页</a><script>var ReadParams={'+Object.entries(values).map(([k,v])=>k+':'+JSON.stringify(v)).join(',')+'};</script></body></html>';
}
function setup({platform='Win32',preferences={},fetchPage=async()=>fixture(),parent='<html><body>robots</body></html>',mobileHttp=async()=>{throw Error('Unexpected mobile HTTP request');}}={}){
 const requests=[],browserCalls=[];
 const {ext}=load('linovelib',{preferences,browser:(url,headers,scripts)=>new Promise((resolve,reject)=>{
  browserCalls.push(url);
  const {document}=parseHTML(parent);
  const context={document,location:{href:url},navigator:{platform},URL,DOMParser,AbortController,setTimeout,clearTimeout,window:{flutter_inappwebview:{callHandler:(name,body)=>resolve(body)}},fetch:async(target)=>{
   requests.push(target);const result=await fetchPage(target);
   return {ok:!result.status||result.status===200,status:result.status||200,url:result.url||target,text:async()=>typeof result==='string'?result:result.html};
  }};
  try{for(const script of scripts)vm.runInNewContext(script,context,{timeout:1000});}catch(e){reject(e);}
 }),http:mobileHttp});
 return {ext,requests,browserCalls};
}
test('Windows automatically reads four official desktop parts in order and converts text only',async()=>{
 const pages=[first,first.replace('.html','_2.html'),first.replace('.html','_3.html'),first.replace('.html','_4.html')];
 const bodies=['<p>头发，准备出发。</p>','<p>感谢大家。</p>','<p>第三页正文。</p>','<p>第四页结束。</p>'];
 const {ext,requests}=setup({fetchPage:async url=>{const i=pages.indexOf(url.replace('www.linovelib.com','tw.linovelib.com'));assert.notEqual(i,-1);return fixture(i+1,(pages[i+1]||base+'/novel/123/901.html').replace(base,''),bodies[i]);}});
 const html=await ext.getHtmlContent('測試章',first);
 assert.deepEqual(requests,pages.map(p=>p.replace('tw.linovelib.com','www.linovelib.com')));
 assert.match(html,/<p>頭髮，準備出發。<\/p>\s*<p>感謝大家。<\/p>\s*<p>第三頁正文。<\/p>\s*<p>第四頁結束。<\/p>/);
 assert.doesNotMatch(html,/adsbygoogle|display:block|下一页/);
});
test('desktop chapter identity, part, VIP and missing navigation fail closed',async()=>{
 for(const data of [fixture(2),fixture(1,undefined,undefined,{articleid:'456'}),fixture(1,undefined,undefined,{chapterid:'901'}),fixture().replace(/<a[^]*?<\/a>/,''),fixture(1,'https://ad.invalid/novel/123/901.html')]){
  const {ext,requests}=setup({preferences:{reader_mode:'desktop'},fetchPage:async()=>data});
  await assert.rejects(ext.getHtmlContent('章',first),/LN-DESKTOP-CONTENT/);assert.equal(requests.length,1);
 }
 const {ext}=setup({preferences:{reader_mode:'desktop'},fetchPage:async()=>fixture(1,undefined,undefined,{chapterisvip:'1'})});
 await assert.rejects(ext.getHtmlContent('章',first),/LN-VIP/);
});
test('desktop pagination never skips a middle part or crosses a book',async()=>{
 const skip=setup({preferences:{reader_mode:'desktop'},fetchPage:async()=>fixture(1,'/novel/123/900_3.html')});
 await assert.rejects(skip.ext.getHtmlContent('章',first),/LN-PAGES/);assert.equal(skip.requests.length,1);
 const wrongBook=setup({preferences:{reader_mode:'desktop'},fetchPage:async()=>fixture(1,'/novel/456/901.html')});
 await assert.rejects(wrongBook.ext.getHtmlContent('章',first),/LN-DESKTOP-CONTENT/);
});
test('desktop verification and rate limits are not retried',async()=>{
 const challenge=setup({preferences:{reader_mode:'desktop'},parent:'<html><title>Just a moment...</title></html>'});
 await assert.rejects(challenge.ext.getHtmlContent('章',first),/LN-DESKTOP-VERIFY/);assert.equal(challenge.requests.length,0);
 const rate=setup({preferences:{reader_mode:'desktop'},fetchPage:async()=>({status:429,html:'Rate limited'})});
 await assert.rejects(rate.ext.getHtmlContent('章',first),/LN-RATE/);assert.equal(rate.requests.length,1);
});
test('desktop rejects embedded failures, unexpected obfuscation and redirects',async()=>{
 for(const body of ['<p>內容加載失敗！請重載或更換瀏覽器</p>','<p data-k1>不確定正文</p>','<p style="transform:scale(0)">隱藏段落</p>']){
  const {ext}=setup({preferences:{reader_mode:'desktop'},fetchPage:async()=>fixture(1,undefined,body)});
  await assert.rejects(ext.getHtmlContent('章',first),/LN-DESKTOP-CONTENT/);
 }
 const {ext}=setup({preferences:{reader_mode:'desktop'},fetchPage:async()=>({url:'https://ad.invalid/',html:fixture()})});
 await assert.rejects(ext.getHtmlContent('章',first),/LN-DESKTOP-CONTENT/);
});
test('desktop image chapters keep trusted lazy images and exclude foreign images',async()=>{
 const {ext}=setup({preferences:{reader_mode:'desktop'},fetchPage:async()=>fixture(1,undefined,'<img src="/loading.svg" data-src="https://img3.readpai.com/pic.jpg"><img src="https://ad.invalid/ad.jpg">')});
 const html=await ext.getHtmlContent('插圖',first);assert.match(html,/img3.readpai.com\/pic.jpg/);assert.doesNotMatch(html,/loading.svg|ad.invalid/);
});
test('Android automatic mode keeps the existing Traditional mobile reader',async()=>{
 let calls=0;const mobile='<div id="acontent"><p>臺灣手機原文（繁體）。</p></div><script>var ReadParams={articleid:"123",chapterid:"900",page:"1",chapterisvip:"0",url_next:"/novel/123/901.html"};</script>';
 const {ext,requests,browserCalls}=setup({platform:'Linux armv8l',mobileHttp:async url=>{calls++;return {statusCode:200,request:{url},body:mobile};}});
 const html=await ext.getHtmlContent('章',first);assert.match(html,/臺灣手機原文（繁體）。/);assert.equal(calls,1);assert.equal(requests.length,0);assert.equal(browserCalls.length,1);
});
test('an explicit final-chapter navigation ends without inventing another page',async()=>{
 const {ext,requests}=setup({preferences:{reader_mode:'desktop'},fetchPage:async()=>fixture(1,'javascript:alert("沒有下一章")')});
 assert.match(await ext.getHtmlContent('終章',first),/頭髮/);assert.equal(requests.length,1);
});
