const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {load,page,parseHTML}=require('./helpers/harness.cjs');
const {ingestFresh,readingOrder}=require('./helpers/app-chapter-identity.cjs');
const base='https://m.qidian.com',book=base+'/book/123/',chapter=base+'/chapter/123/901/';
const html=(data,extra={})=>'<script id="vite-plugin-ssr_pageContext" type="application/json">'+JSON.stringify({pageContext:{pageProps:{pageData:data,...extra}}}).replace(/</g,'\\u003c')+'</script>';
const response=(url,data)=>({statusCode:200,request:{url},body:html(data)});
const info={bookId:123,bookName:'測試小說',authorName:'測試作者',desc:'簡介<br>第二行',chanName:'玄幻',subCateName:'東方玄幻',actionStatus:'连载中',isVip:1};
const toc={bookId:123,chapterTotalCnt:3,vs:[{vN:'第一卷',vS:0,cs:[{id:901,cN:'第1章 開始',sS:1},{id:902,cN:'第2章 經過',sS:1}]},{vN:'第二卷',vS:1,cs:[{id:903,cN:'第1章 後續',sS:0}]}]};
const reader=(overrides={})=>({bookInfo:info,chapterInfo:{chapterId:901,price:0,freeStatus:0,vipStatus:0,content:'<p>測試正文</p>',...overrides}});

test('Qidian hot rank uses distinct canonical book links and safe covers',async()=>{
 const {ext}=load('qidian',{http:async (url,headers)=>{assert.match(headers['User-Agent'],/Android.*Mobile/);return response(url,{hotRank:[{bid:123,bName:'第一本',imgUrl:'https://evil.test/a'},{bid:123,bName:'重複'},{bid:456,bName:'第二本'}]});}});
 const result=await ext.getPopular(1);assert.equal(result.list.length,2);assert.equal(result.list[0].link,book);assert.match(result.list[0].imageUrl,/bookcover\.yuewen\.com/);assert.equal(result.hasNextPage,false);assert.equal((await ext.getPopular(2)).list.length,0);
});
test('Qidian search converts traditional text and uses pageNum, with last/empty pages',async()=>{
 const urls=[];const {ext}=load('qidian',{http:async url=>{urls.push(url);const n=Number(new URL(url).searchParams.get('pageNum'));return response(url,{bookInfo:{records:n===3?[]:[{bid:120+n,bName:'搜尋結果'}],pageNum:n,pageSize:1,total:2,isLast:n===1?0:1}});}});
 assert.equal((await ext.search('靈劍',1)).hasNextPage,true);assert.match(decodeURIComponent(urls[0]),/soushu\/灵剑.html\?pageNum=1/);
 assert.equal((await ext.search('靈劍',2)).hasNextPage,false);assert.equal((await ext.search('靈劍',3)).list.length,0);assert.equal((await ext.search('',1)).list.length,0);assert.equal(urls.length,3);
 const wrong=load('qidian',{http:async url=>response(url,{bookInfo:{records:[],pageNum:1}})}).ext;await assert.rejects(wrong.search('書',2),/QD-SEARCH/);
});
test('Qidian detail accepts desktop links and retains chapter order across volumes',async()=>{
 const {ext}=load('qidian',{http:async url=>response(url,url.endsWith('catalog/')?toc:{bookInfo:info})});
 const d=await ext.getDetail('https://www.qidian.com/book/123/');assert.equal(d.author,'測試作者');assert.equal(d.status,0);assert.equal(d.chapters.length,3);assert.match(d.chapters[0].name,/0003.*VIP/);
 const kept=ingestFresh(d.name,d.chapters);assert.equal(kept.length,3);assert.deepEqual(Array.from(readingOrder(d.name,kept),c=>c.url),[901,902,903].map(id=>base+'/chapter/123/'+id+'/'));
 assert.equal((await ext.search('123',1)).list[0].link,book);assert.equal((await ext.search('https://m.qidian.com/chapter/123/0/',1)).list[0].link,book);
});
test('Qidian large complete catalogue retains every chapter and reader identity',()=>{
 const {ext}=load('qidian');const data={bookId:123,chapterTotalCnt:1707,vs:Array.from({length:9},(_,v)=>({vN:'第'+v+'卷',vS:v>0?1:0,cs:Array.from({length:v===8?187:190},(_,i)=>({id:10000+v*190+i,cN:'第'+(i+1)+'章',sS:0}))}))};
 const chapters=ext._chapters(data,'123');assert.equal(chapters.length,1707);assert.equal(ingestFresh('測試',chapters).length,1707);assert.equal(readingOrder('測試',chapters)[0].url,base+'/chapter/123/10000/');
 data.chapterTotalCnt=1708;assert.throws(()=>ext._chapters(data,'123'),/TOC-INCOMPLETE/);data.bookId=456;assert.throws(()=>ext._chapters(data,'123'),/QD-TOC/);
});
test('Qidian free reader sanitizes markup and validates requested book/chapter',async()=>{
 const {ext}=load('qidian',{http:async url=>response(url,reader({content:'<p onclick="bad()">正文</p><script>bad()</script><img src="https://bookcover.yuewen.com/a.jpg"><img src="https://evil.test/b.jpg">'}))});
 const text=await ext.getHtmlContent('第1章',chapter);assert.match(text,/正文/);assert.match(text,/<img/);assert.doesNotMatch(text,/onclick|script|evil\.test/);
 const wrong=load('qidian',{http:async url=>response(url,reader({chapterId:902}))}).ext;await assert.rejects(wrong.getHtmlContent('章',chapter),/QD-CHAPTER/);
 const other=load('qidian',{http:async url=>response(url,{...reader(),bookInfo:{...info,bookId:456}})}).ext;await assert.rejects(other.getHtmlContent('章',chapter),/QD-CHAPTER/);
});
test('Qidian paid/restricted chapters fail clearly, public author notes remain readable',async()=>{
 for(const flags of [{price:10,vipStatus:1,freeStatus:1},{freeStatus:1},{fixedFontWoff2:'font.woff2'},{cES:1},{riskbe:{be:1}}]){
  const {ext}=load('qidian',{http:async url=>response(url,reader(flags))});await assert.rejects(ext.getHtmlContent('章',chapter),/QD-(VIP|PROTECTED)/);
 }
 const {ext}=load('qidian',{http:async url=>response(url,reader({vipStatus:1,price:0,freeStatus:0}))});assert.match(await ext.getHtmlContent('後記',chapter),/測試正文/);
});
test('Qidian browser fallback captures normal JSON without session data or running scripts',async()=>{
 const {document}=parseHTML(html({hotRank:[{bid:123,bName:'瀏覽器作品'}],user:{token:'private'},settings:{secret:true}}));
 let captured,script;const {ext}=load('qidian',{http:async()=>({statusCode:202,body:'check'}),browser:async(url,headers,scripts)=>{
  script=scripts[0];vm.runInNewContext(script,{document,location:{href:url},URL,Date,setTimeout,window:{flutter_inappwebview:{callHandler:(name,body)=>{captured=body;}}}});return captured;
 }});
 assert.equal((await ext.getPopular(1)).list[0].name,'瀏覽器作品');assert.doesNotMatch(captured,/private|secret|"user"/);assert.doesNotMatch(script,/document\.cookie|localStorage/);
});
test('Qidian verification, offsite redirects, malformed JSON, and 404 fail explicitly',async()=>{
 const limited=load('qidian',{http:async()=>({statusCode:429,body:'rate limited'})}).ext;await assert.rejects(limited.getPopular(1),/QD-RATE/);
 const challenge=load('qidian',{http:async()=>({statusCode:403,body:'blocked'}),browser:async url=>JSON.stringify({kind:'challenge',url})}).ext;await assert.rejects(challenge.getPopular(1),/QD-VERIFY/);
 const outside=load('qidian',{http:async()=>({statusCode:200,request:{url:'https://evil.test/'},body:html({})})}).ext;await assert.rejects(outside.getPopular(1),/QD-URL/);
 const malformed=load('qidian',{http:async url=>({statusCode:200,request:{url},body:'<script id="vite-plugin-ssr_pageContext">throw Error("run")</script>'})}).ext;await assert.rejects(malformed.getPopular(1),/QD-FORMAT/);
 const missing=load('qidian',{http:async url=>({statusCode:200,request:{url},body:html({}, {is404:true})})}).ext;await assert.rejects(missing.getDetail(book),/QD-NOT-FOUND/);
 await assert.rejects(missing.getDetail('https://m.qidian.com.evil.test/book/123/'),/QD-URL/);
 await assert.rejects(missing.getHtmlContent('章','https://evil.test/chapter/123/901/'),/QD-URL/);
});
