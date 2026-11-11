const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const {load, parseHTML} = require('./helpers/harness.cjs');
const {ingestFresh, readingOrder} = require('./helpers/app-chapter-identity.cjs');
const base = 'https://www.lightnovel.fun/tw', proxy = 'https://www.lightnovel.fun/api/pc-proxy/api/';
const reply = (url, data) => ({statusCode:200, request:{url}, body:JSON.stringify({code:0,data})});
const listing = (list, page=1, more=false) => ({list,page_info:{cur:page,has_next:more?1:0,count:list.length}});
const book = {book_id:1,title:'测试作品',author_name:'作者',summary:'<p>介绍</p>',cover_url:'https://api.lightnovel.fun/upload-files/cover.jpg?m=abc&t=123',tags:[{name:'冒险'}],is_completed:1,chapter_count:3};
const volumes = [{volume_id:10,book_id:1,title:'第一卷'},{volume_id:20,book_id:1,title:'第二卷'}];
function catalogue(url, headers, body) {
  const input = JSON.parse(body);
  if (url.endsWith('/get-book-detail')) return reply(url,book);
  if (url.endsWith('/get-book-volumes')) return reply(url,{book_id:1,...listing(volumes)});
  if (url.endsWith('/get-volume-chapters')) {
    const ids = input.volume_id==='10'?[100,101]:[200];
    return reply(url,{book_id:1,volume_id:input.volume_id,...listing(ids.map(id=>({book_id:1,volume_id:input.volume_id,chapter_id:id,title:'序章'})))});
  }
  throw Error('Unexpected API '+url);
}

test('native Mangayomi JSON transport sends an object, not a JSON-encoded string',async()=>{
  const {ext}=load('lightnovel',{http:async(url,headers,wireBody)=>{
    // JsHttpClient._toHttpResponse JSON-encodes application/json bodies itself.
    const received=JSON.parse(wireBody);
    assert.equal(typeof received,'object');
    assert.equal(received.pageSize,20);
    assert.equal(received.page,1);
    return reply(url,listing([book]));
  }});
  assert.equal((await ext.getPopular(1)).list[0].name,'測試作品');
});

test('LightNovel.fun lists popular/latest and zero-based search pages with Traditional Chinese', async()=>{
  const calls=[];
  const {ext}=load('lightnovel',{http:async(url,headers,body)=>{const p=JSON.parse(body);calls.push({url,p,headers});return reply(url,listing([book,book],/(?:apk-search-result|home-recent-updates-feed)-v1$/.test(url)?p.page+1:p.page,true));}});
  const popular=await ext.getPopular(1); assert.equal(popular.list.length,1);assert.equal(popular.list[0].name,'測試作品');assert.equal(popular.list[0].link,base+'/book/1'); assert.match(popular.list[0].imageUrl,/[?]m=abc&t=123$/); assert.equal(popular.hasNextPage,true);
  await ext.getLatestUpdates(2);await ext.search('無職',2);
  assert.match(calls[0].url,/home-feed-v1$/);assert.match(calls[1].url,/home-recent-updates-feed-v1$/);assert.equal(calls[1].p.page,1);assert.equal(calls[2].p.page,1);assert.equal(calls[2].p.q,'無職');assert.equal(calls[2].headers['Content-Type'],'application/json');
});

test('empty search makes no request and no-results remains an empty list',async()=>{
  let calls=0;const {ext}=load('lightnovel',{http:async url=>{calls++;return reply(url,listing([]));}});
  assert.equal((await ext.search(' ',1)).list.length,0);assert.equal(calls,0);assert.equal((await ext.search('not found',1)).list.length,0);
});

test('complete catalogue retains repeated titles in separate volumes and reader order',async()=>{
  const {ext}=load('lightnovel',{http:catalogue});const work=await ext.getDetail('/tw/book/1');
  assert.equal(work.name,'測試作品');assert.equal(work.description,'介紹');assert.equal(work.genre[0],'冒險');assert.equal(work.status,1);assert.equal(work.chapters.length,3);
  const chapters=ingestFresh(work.name,work.chapters);
  assert.deepEqual(Array.from(readingOrder(work.name,chapters),c=>c.url),[100,101,200].map(id=>base+'/reader/1/'+id));
  assert.match(work.chapters[0].name,/0003.*第二卷/);
});

test('volume and chapter pages are read completely without merging alternate versions',async()=>{
  const pages=[];const {ext}=load('lightnovel',{http:async(url,headers,body)=>{
    const p=JSON.parse(body);pages.push([url,p.page]);
    if(url.endsWith('get-book-detail'))return reply(url,{...book,chapter_count:2});
    if(url.endsWith('get-book-volumes'))return reply(url,{book_id:1,alternate_versions:[{book_id:999}],...listing([volumes[p.page-1]],p.page,p.page===1),pagination:{total:2}});
    return reply(url,{book_id:1,volume_id:p.volume_id,...listing([{book_id:1,volume_id:p.volume_id,chapter_id:p.volume_id,title:'第一章'}]),pagination:{total:1}});
  }}); assert.equal((await ext.getDetail(base+'/book/1')).chapters.length,2);assert.equal(pages.filter(([u])=>u.endsWith('get-book-volumes')).length,2);
});

test('incomplete, repeated, cross-book or wrong-page catalogues fail instead of losing chapters',async()=>{
  for(const kind of ['missing','repeated','crossbook','wrongpage']){
    const {ext}=load('lightnovel',{http:async(url,h,b)=>{
      if(url.endsWith('get-volume-chapters')){
        const p=JSON.parse(b), row={chapter_id:100,book_id:kind==='crossbook'?2:1,volume_id:p.volume_id,title:'序章'};
        return reply(url,{book_id:1,volume_id:p.volume_id,...listing(kind==='repeated'?[row,row]:[row],kind==='wrongpage'?2:1),pagination:{total:kind==='missing'?50:kind==='repeated'?2:1}});
      }
      return catalogue(url,h,b);
    }});await assert.rejects(ext.getDetail(base+'/book/1'),/LK-(?:CATALOG|PAGE)/);
  }
});

test('body paragraphs/images keep order and image query signatures while text converts',async()=>{
  const raw='<p>第一段 简体</p><img src="https://api.lightnovel.fun/upload-files/pic.jpg?m=abc&amp;t=123" onerror="evil()"><p>最后一段</p><script>evil()</script><img src="https://evil.invalid/ad.jpg">';
  const {ext}=load('lightnovel',{http:async url=>reply(url,{book_id:1,chapter_id:100,title:'序章',locked:0,access_type:'public',body_snapshot:{body_html:raw}})});
  const content=await ext.getHtmlContent('測試作品',base+'/reader/1/100');
  assert(content.indexOf('第一段 簡體')<content.indexOf('<img'));assert(content.indexOf('<img')<content.indexOf('最後一段'));assert.match(content,/m=abc&amp;t=123/);assert.doesNotMatch(content,/script|onerror|evil.invalid/);
});

test('original language preference preserves original text and illustration-only chapters work',async()=>{
  const {ext}=load('lightnovel',{preferences:{display_language:'original'},http:async url=>reply(url,{book_id:1,chapter_id:100,title:'简体',locked:0,access_type:'public',body_snapshot:{body_html:'<img src="https://api.lightnovel.fun/p.jpg">'}})});
  const html=await ext.getHtmlContent('作品',base+'/reader/1/100');assert.match(html,/简体/);assert.match(html,/<img/);
});

test('locked, brave and paid chapters are never returned as readable preview text',async()=>{
  for(const flags of [{locked:1},{brave_required:1},{access_type:'paid',unlocked:0}]){
    const {ext}=load('lightnovel',{http:async url=>reply(url,{book_id:1,chapter_id:100,body_snapshot:{body_html:'<p>Preview</p>'},...flags}),browser:async url=>JSON.stringify({kind:'api',url,status:200,text:JSON.stringify({code:0,data:{book_id:1,chapter_id:100,...flags}})})});await assert.rejects(ext.getHtmlContent('作品',base+'/reader/1/100'),/LK-ACCESS/);
  }
});

test('wrong chapter identity, empty content, unsafe URLs and offsite API redirects fail',async()=>{
  for(const data of [{book_id:2,chapter_id:100},{book_id:1,chapter_id:101},{book_id:1,chapter_id:100,body_snapshot:{body_html:''}}]){
    const {ext}=load('lightnovel',{http:async url=>reply(url,data)});await assert.rejects(ext.getHtmlContent('作品',base+'/reader/1/100'),/LK-(?:IDENTITY|CONTENT)/);
  }
  const {ext}=load('lightnovel');await assert.rejects(ext.getDetail('https://evil.invalid/book/1'),/LK-URL/);await assert.rejects(ext.getHtmlContent('作品','javascript:alert(1)'),/LK-URL/);
  const redirect=load('lightnovel',{http:async()=>({statusCode:200,request:{url:'https://evil.invalid'},body:'{}'})}).ext;await assert.rejects(redirect.getPopular(1),/LK-URL/);
});

test('rate limits do not retry and transient transport/server failures retry once',async()=>{
  let calls=0;const rate=load('lightnovel',{http:async()=>{calls++;return {statusCode:429,body:''};}}).ext;await assert.rejects(rate.getPopular(1),/LK-RATE/);assert.equal(calls,1);
  calls=0;const {ext,context}=load('lightnovel',{http:async url=>{calls++;return calls===1?{statusCode:503,body:''}:reply(url,listing([book]));}});context.setTimeout=fn=>fn();assert.equal((await ext.getPopular(1)).list.length,1);assert.equal(calls,2);
});

test('API errors and missing pagination are reported clearly',async()=>{
  for(const body of ['<html>error</html>',JSON.stringify({code:3,data:{}}),JSON.stringify({code:0,data:{list:[book]}})]){
    const {ext}=load('lightnovel',{http:async()=>({statusCode:200,body})});await assert.rejects(ext.getPopular(1),/LK-(?:RESPONSE|API|PAGE)/);
  }
});

test('browser fallback uses only ordinary same-origin API fetch and requests manual verification',async()=>{
  let calls=0;
  const {ext}=load('lightnovel',{http:async()=>({statusCode:403,body:''}),browser:async(url,headers,scripts)=>new Promise(resolve=>{
    const {document}=parseHTML('<html><body>robots</body></html>');
    vm.runInNewContext(scripts[0],{document,location:{href:url},Date,URL,setTimeout,clearTimeout,AbortController,fetch:async(target,options)=>{calls++;assert.equal(target,proxy+'bff/home-feed-v1');assert.equal(JSON.parse(options.body).page,1);return {url:target,status:200,text:async()=>JSON.stringify({code:0,data:listing([book])})};},window:{flutter_inappwebview:{callHandler:(_,data)=>resolve(data)}}});
  })});assert.equal((await ext.getPopular(1)).list.length,1);assert.equal(calls,1);
  const blocked=load('lightnovel',{http:async()=>({statusCode:403,body:''}),browser:async url=>JSON.stringify({kind:'challenge',url})}).ext;await assert.rejects(blocked.getPopular(1),/LK-VERIFY/);
});

test('restricted chapter alone uses the WebView session and respects granted access',async()=>{
  let rawReply='';
  const {ext}=load('lightnovel',{preferences:{account_mode:'webview'},http:async url=>reply(url,{book_id:1,chapter_id:100,locked:1}),browser:async(url,h,scripts)=>new Promise(resolve=>{
    const {document}=parseHTML('<html><body>robots</body></html>');document.cookie='';
    vm.runInNewContext(scripts[0],{document,location:{href:url},Date,URL,setTimeout,clearTimeout,AbortController,fetch:async(target,options)=>{
      assert.equal(JSON.parse(options.body).security_key,'fixture-session-only');
      assert.equal(target,proxy+'new-content-read/get-chapter-detail');
      return {url:target,status:200,text:async()=>JSON.stringify({code:0,data:{book_id:1,chapter_id:100,access_type:'brave',brave_required:1,locked:0,unlocked:1,title:'序章',body_snapshot:{body_html:'<p>授權正文</p>'}}})};
    },window:{localStorage:{getItem:k=>k==='lk_security_key'?'fixture-session-only':null},flutter_inappwebview:{callHandler:(_,data)=>{rawReply=data;resolve(data);}}}});
  })});
  assert.match(await ext.getHtmlContent('作品',base+'/reader/1/100'),/授權正文/);
  assert.doesNotMatch(rawReply,/fixture-session-only/);
});

test('restricted chapters ask for normal WebView login when no session exists',async()=>{
  const {ext}=load('lightnovel',{preferences:{account_mode:'webview'},http:async url=>reply(url,{book_id:1,chapter_id:100,locked:1}),browser:async(url,h,scripts)=>new Promise(resolve=>{
    const {document}=parseHTML('<html><body>robots</body></html>');document.cookie='';
    vm.runInNewContext(scripts[0],{document,location:{href:url},URL,window:{localStorage:{getItem:()=>null},flutter_inappwebview:{callHandler:(_,data)=>resolve(data)}}});
  })});await assert.rejects(ext.getHtmlContent('作品',base+'/reader/1/100'),/LK-LOGIN/);
});

test('public browsing, catalogues and chapters never require login, including old account preferences',async()=>{
  for(const mode of [undefined,'guest','webview']){
    let browsers=0;
    const {ext}=load('lightnovel',{preferences:{account_mode:mode},browser:async()=>{browsers++;throw Error('Public content must not request login');},http:async(url,h,b)=>{
      if(url.endsWith('/get-chapter-detail'))return reply(url,{book_id:1,chapter_id:100,title:'序章',locked:0,access_type:'public',body_snapshot:{body_html:'<p>公開正文</p>'}});
      if(url.endsWith('/home-feed-v1')||url.endsWith('/apk-search-result-v1'))return reply(url,listing([book]));
      return catalogue(url,h,b);
    }});
    assert.equal((await ext.getPopular(1)).list.length,1);
    assert.equal((await ext.search('作品',1)).list.length,1);
    assert.equal((await ext.getDetail(base+'/book/1')).chapters.length,3);
    assert.match(await ext.getHtmlContent('作品',base+'/reader/1/100'),/公開正文/);
    assert.equal(browsers,0);
  }
});

test('authenticated retry must still return the requested book and chapter',async()=>{
  const {ext}=load('lightnovel',{http:async url=>reply(url,{book_id:1,chapter_id:100,locked:1}),browser:async url=>JSON.stringify({kind:'api',url,status:200,text:JSON.stringify({code:0,data:{book_id:2,chapter_id:100,unlocked:1,body_snapshot:{body_html:'<p>另一部作品</p>'}}})})});
  await assert.rejects(ext.getHtmlContent('作品',base+'/reader/1/100'),/LK-IDENTITY/);
});
