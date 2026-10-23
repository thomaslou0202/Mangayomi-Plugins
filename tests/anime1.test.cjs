const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {Document,parseHTML}=require('./helpers/harness.cjs');
const {ingestFresh,readingOrder}=require('./helpers/app-chapter-identity.cjs');
const base='https://anime1.me',api='https://v.anime1.me/api';
const rows=[[12,'測試 &amp; 動畫','1-3','2026','秋','字幕組'],[13,'Other Show 2','連載中(01)','2025','春','']];
const response=(url,body,headers={},statusCode=200)=>({statusCode,body:typeof body==='string'?body:JSON.stringify(body),headers,request:{url}});
const cookieHeaders={'Set-Cookie':'e=123; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/, p=proof%3D; Path=/, h=hash; Path=/, session=do-not-forward; Path=/'};
const episodeHtml=(id,data='opaque%7Brequest%7D')=>`<html><body><article id="post-${id}"><div class="entry-content"><video data-apireq="${data}"></video></div></article></body></html>`;
function load({get=async url=>response(url,rows),post=async()=>{throw Error('Unexpected POST');},browser=async()=>{throw Error('Unexpected browser');},preferences={}}={}) {
 class Client{get(...args){return get(...args);}post(...args){return post(...args);}}
 class SharedPreferences{get(key){return preferences[key];}}
 const context=vm.createContext({Document,Client,SharedPreferences,MProvider:class{},evaluateJavascriptViaWebview:browser});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../javascript/anime/src/zh/anime1.js'),'utf8')+'\nglobalThis.ext=new DefaultExtension();',context);
 return {ext:context.ext,context};
}
function archive(id,episodes,next='') {
 return `<html><body class="archive category category-${id}">${episodes.map(([post,label,date])=>`<article id="post-${post}" class="post category-${id}"><h2 class="entry-title"><a href="/${post}">測試 &amp; 動畫 [${label}]</a></h2><time datetime="${date||'2026-10-01T10:00:00+08:00'}"></time></article>`).join('')}${next?`<div class="nav-previous"><a href="${next}">上一頁</a></div>`:''}</body></html>`;
}
test('anime metadata is native JavaScript itemType 1 and appears only in anime index',()=>{
 const anime=JSON.parse(fs.readFileSync(path.join(__dirname,'../anime_index.json'),'utf8'));
 const novels=JSON.parse(fs.readFileSync(path.join(__dirname,'../novel_index.json'),'utf8'));
 const entry=anime.find(s=>s.id===1827634456);assert.equal(entry.itemType,1);assert.equal(entry.sourceCodeLanguage,1);assert.equal(entry.isManga,false);assert.match(entry.sourceCodeUrl,/javascript\/anime\/src\/zh\/anime1.js$/);assert.ok(!novels.some(s=>s.id===entry.id));assert.ok(novels.every(s=>s.itemType===2));
});
test('catalogue decodes names, excludes external rows and keeps stable category identity',()=>{
 const {ext}=load();const parsed=ext._parseIndex(JSON.stringify([...rows,[0,'外部作品','1','2026','秋',''],rows[0],['bad','錯誤','1','2026','秋','']]));
 assert.equal(parsed.length,2);assert.equal(parsed[0].name,'測試 & 動畫');assert.equal(parsed[0].id,'12');
});
test('malformed or missing index fails clearly instead of returning a false empty catalogue',()=>{
 const {ext}=load();for(const body of ['<html>maintenance</html>','{}','[]','[[0,"external","1","2026","秋",""]]'])assert.throws(()=>ext._parseIndex(body),/A1-INDEX/);
});
test('browse pagination shares one index fetch and latest follows website update order',async()=>{
 let calls=0;const all=Array.from({length:45},(_,i)=>[i+1,'作品 '+i,'1','2026','秋','']);const {ext}=load({get:async url=>{calls++;return response(url,all);}});
 const first=await ext.getPopular(1),second=await ext.getPopular(2),third=await ext.getLatestUpdates(3);assert.equal(calls,1);assert.equal(first.list.length,20);assert.equal(second.list.length,20);assert.equal(third.list.length,5);assert.equal(first.hasNextPage,true);assert.equal(third.hasNextPage,false);assert.equal(second.list[0].link,base+'/?cat=21');
});
test('year and season filter home only while search remains global',async()=>{
 const {ext}=load({preferences:{year:'2026',season:'秋'}});assert.equal((await ext.getPopular(1)).list.length,1);assert.equal((await ext.search('other SHOW ２',1,[])).list[0].link,base+'/?cat=13');
 const invalid=load({preferences:{year:'../../bad',season:'bad'}}).ext;assert.equal((await invalid.getPopular(1)).list.length,2);
});
test('refreshing first page and an expired cache fetch fresh index data',async()=>{
 let calls=0;const {ext}=load({get:async url=>{calls++;return response(url,[[12,'更新 '+calls,'1','2026','秋','']]);}});
 assert.equal((await ext.getPopular(1)).list[0].name,'更新 1');assert.equal((await ext.getLatestUpdates(1)).list[0].name,'更新 2');
 ext.indexLoadedAt=Date.now()-120000;assert.equal((await ext.search('更新',1,[])).list[0].name,'更新 3');assert.equal(calls,3);
});
test('empty query does not load data, no-results is empty, direct category URLs work',async()=>{
 let calls=0;const {ext}=load({get:async url=>{calls++;return response(url,rows);}});assert.equal((await ext.search(' ',1,[])).list.length,0);assert.equal(calls,0);assert.equal((await ext.search('no such title',1,[])).list.length,0);assert.equal((await ext.search(base+'/?cat=12',1,[])).list.length,1);
});
test('category pagination collects and deduplicates all posts in chronological episode order',async()=>{
 const {ext}=load({get:async url=>url.endsWith('/animelist.json')?response(url,rows):response(url,url.includes('/page/2')?archive(12,[[102,'02'],[101,'01']]):archive(12,[[103,'03'],[102,'02']],'/category/test/page/2'))});
 const detail=await ext.getDetail(base+'/?cat=12');assert.equal(detail.episodes.length,3);assert.equal(detail.name,'測試 & 動畫');const episodes=Array.from(detail.episodes);assert.equal(episodes[0].name,'0003｜０３');assert.equal(ingestFresh(detail.name,episodes).length,3);assert.deepEqual(readingOrder(detail.name,episodes).map(e=>e.url),[base+'/101',base+'/102',base+'/103']);
});
test('special episodes and revised duplicate episode numbers remain distinct posts',async()=>{
 const {ext}=load({get:async url=>url.endsWith('/animelist.json')?response(url,rows):response(url,archive(12,[[104,'SP'],[103,'01-v2'],[102,'01'],[101,'前導篇']]))});
 const detail=await ext.getDetail(base+'/?cat=12');assert.equal(detail.episodes.length,4);assert.equal(ingestFresh(detail.name,Array.from(detail.episodes)).length,4);
});
test('mismatched category, repeated pages and external pagination are rejected',async()=>{
 for(const html of [archive(13,[[101,'01']]),archive(12,[[101,'01']],base+'/?cat=12'),archive(12,[[101,'01']],'https://evil.test/page/2')]){
  const {ext}=load({get:async url=>url.endsWith('/animelist.json')?response(url,rows):response(url,html)});await assert.rejects(ext.getDetail(base+'/?cat=12'),/A1-(?:CATEGORY|PAGINATION)/);
 }
});
test('unknown and external categories do not trigger arbitrary page requests',async()=>{
 const {ext}=load();await assert.rejects(ext.getDetail('https://evil.test/?cat=12'),/A1-URL/);await assert.rejects(ext.getDetail(base+'/?cat=999'),/A1-NOTFOUND/);
});
test('normal player request preserves form encoding and forwards only playback cookies',async()=>{
 let request;const {ext}=load({get:async url=>response(url,episodeHtml(101)),post:async(...args)=>{request=args;return response(api,{s:[{src:'//muan.v.anime1.me/a.mp4',type:'video/mp4'}]},cookieHeaders);}});
 const videos=await ext.getVideoList(base+'/101');assert.equal(request[0],api);assert.equal(request[2],'d=opaque%7Brequest%7D');assert.equal(request[1].Origin,base);assert.equal(request[1].Referer,base+'/101');assert.equal(videos.length,1);assert.equal(videos[0].headers.Cookie,'e=123; p=proof%3D; h=hash');assert.equal(videos[0].originalUrl,videos[0].url);assert.equal(videos[0].quality,'原始 MP4');assert.ok(!videos[0].headers.Cookie.includes('session'));
});
test('separate Set-Cookie values and case-insensitive header names are supported',()=>{
 const {context}=load();context.headers={'SET-COOKIE':['p=value==; Path=/','h=token; Path=/','e=1; Expires=Wed, 21 Oct 2030 07:28:00 GMT']};assert.equal(vm.runInContext('a1PlaybackCookies(headers)',context),'e=1; p=value==; h=token');
});
test('multiple page players, HLS and duplicate stream URLs produce usable video choices',async()=>{
 let calls=0;const {ext}=load({get:async url=>response(url,episodeHtml(101).replace('</article>','<video data-apireq="second"></video></article>')),post:async()=>{calls++;return response(api,{s:[null,{src:'https://muan.v.anime1.me/'+calls+'.m3u8?x=1'}, {src:'https://muan.v.anime1.me/'+calls+'.m3u8?x=1'}]},cookieHeaders);}});
 const videos=await ext.getVideoList(base+'/101');assert.equal(calls,2);assert.equal(videos.length,2);assert.match(videos[1].quality,/片段 2.*HLS/);
});
test('stream URL allowlist rejects spoofed domains, userinfo and non-media links',async()=>{
 for(const src of ['https://muan.v.anime1.me.evil.test/a.mp4','https://evil.test@v.anime1.me/a.mp4','https://evil.test/a.mp4','javascript:bad()','https://v.anime1.me/api']){
  const {ext}=load({get:async url=>response(url,episodeHtml(101)),post:async()=>response(api,{s:[{src}]},cookieHeaders)});await assert.rejects(ext.getVideoList(base+'/101'),/A1-MEDIA/);
 }
});
test('missing cookies, malformed API data and unexpected API redirects have clear errors',async()=>{
 for(const reply of [response(api,{s:[{src:'//muan.v.anime1.me/a.mp4'}]}),response(api,'bad json'),response(api,{s:[]}),response('https://evil.test/',{s:[{src:'//muan.v.anime1.me/a.mp4'}]},cookieHeaders)]){
  const {ext}=load({get:async url=>response(url,episodeHtml(101)),post:async()=>reply});await assert.rejects(ext.getVideoList(base+'/101'),/A1-(?:PLAYBACK|PLAYBACK-HEADERS)/);
 }
});
test('wrong post, missing player and malformed payload are rejected before API requests',async()=>{
 for(const html of [episodeHtml(102),'<article id="post-101"></article>',episodeHtml(101,'bad&payload')]){
  const {ext}=load({get:async url=>response(url,html)});await assert.rejects(ext.getVideoList(base+'/101'),/A1-(?:EPISODE|PLAYER)/);
 }
 const {ext}=load();await assert.rejects(ext.getVideoList('https://evil.test/101'),/A1-URL/);
});
test('403 fallback uses a normal WebView; manual challenge and invalid replies remain errors',async()=>{
 const {ext}=load({get:async url=>response(url,'blocked',{},403),browser:async url=>JSON.stringify({kind:'page',url,body:JSON.stringify(rows)})});assert.equal((await ext.getPopular(1)).list.length,2);
 for(const raw of ['null','not json',JSON.stringify({kind:'challenge',url:base+'/'})]){
  const broken=load({get:async url=>response(url,'blocked',{},403),browser:async()=>raw}).ext;await assert.rejects(broken.getPopular(1),/A1-(?:WEBVIEW|CHALLENGE)/);
 }
});
test('rate limit fails without repeated requests and normal index failures can be retried',async()=>{
 let calls=0;const {ext}=load({get:async url=>{calls++;return calls===1?response(url,'limited',{},429):response(url,rows);}});await assert.rejects(ext.getPopular(1),/A1-RATE/);assert.equal(calls,1);assert.equal((await ext.getPopular(1)).list.length,2);
});
test('WebView metadata capture preserves player data without reading cookies or mutating page',async()=>{
 const {context}=load();const script=vm.runInContext('a1BrowserScript("html")',context);const {document}=parseHTML('<html><body><form><input value="private"></form>'+episodeHtml(101)+'</body></html>');
 Object.defineProperty(document,'cookie',{get(){throw Error('Cookie access forbidden');}});let captured;
 await vm.runInNewContext(script,{window:{flutter_inappwebview:{callHandler:async(name,raw)=>{captured=JSON.parse(raw);}}},document,location:new URL(base+'/101'),URL});assert.equal(captured.kind,'page');assert.match(captured.body,/data-apireq/);assert.ok(!captured.body.includes('private'));assert.ok(document.querySelector('input'));
});
