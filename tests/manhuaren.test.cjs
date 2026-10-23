const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {Document,parseHTML}=require('./helpers/harness.cjs');
const {ingestFresh,readingOrder}=require('./helpers/app-chapter-identity.cjs');
const base='https://www.manhuaren.com',comic=base+'/manhua-test/',chapter=base+'/m101/';
const reply=(url,body,statusCode=200)=>({statusCode,body:typeof body==='string'?body:JSON.stringify(body),headers:{},request:{url}});
const item=(id=1)=>({Title:'漫畫 &amp; '+id,UrlKey:'manhua-test'+id,ShowPicUrlB:'https://mhfm2tw.cdndm5.com/'+id+'.jpg'});
const chapterHtml=(id=101,script="var newImgs=['https://manhua1.cdndm5.com/1.jpg','https://manhua1.cdndm5.com/2.jpg'];")=>`<html><body><script>var DM5_CID=${id};</script><script>${script}</script></body></html>`;
function detail(groups=[[[103,'第3话'],[102,'第2话'],[101,'第1话']]],ascending=false){return `<html><body><script>var DM5_CURRENTURL='/manhua-test/';</script><p class="detail-main-info-title">測試作品</p><div class="detail-main-cover"><img src="https://mhfm2tw.cdndm5.com/cover.jpg"></div><p class="detail-main-info-author">作者：作者甲</p><p class="detail-desc">完整介紹</p><span class="detail-list-title-1">已完结</span><a class="detail-list-title-right sort-${ascending?1:2}"></a>${groups.map((rows,i)=>`<ul class="detail-list-select" id="detail-list-select-${i+1}" style="display:none">${rows.map(([id,name])=>`<li><a class="chapteritem" href="/m${id}/">${name}</a></li>`).join('')}</ul>`).join('')}</body></html>`;}
function load({get=async()=>{throw Error('Unexpected GET');},post=async()=>{throw Error('Unexpected POST');},browser=async()=>{throw Error('Unexpected browser');},unpacker}={}){
 class Client{get(...args){return get(...args);}post(...args){return post(...args);}}
 const c=vm.createContext({Document,Client,MProvider:class{},evaluateJavascriptViaWebview:browser,...(unpacker?{unpackJs:unpacker}:{})});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../javascript/manga/src/zh/manhuaren.js'),'utf8')+'\nglobalThis.ext=new DefaultExtension()',c);return{ext:c.ext,context:c};
}
test('manga catalogue contains native itemType 0 only and all three repository catalogues stay separate',()=>{
 const manga=JSON.parse(fs.readFileSync(path.join(__dirname,'../index.json'),'utf8')),anime=JSON.parse(fs.readFileSync(path.join(__dirname,'../anime_index.json'),'utf8')),novels=JSON.parse(fs.readFileSync(path.join(__dirname,'../novel_index.json'),'utf8'));
 const entry=manga.find(x=>x.id===1827634457);assert.equal(entry.itemType,0);assert.equal(entry.isManga,true);assert.equal(entry.sourceCodeLanguage,1);assert.match(entry.sourceCodeUrl,/javascript\/manga\/src\/zh\/manhuaren.js$/);assert.ok(anime.every(x=>x.itemType===1&&!x.isManga));assert.ok(novels.every(x=>x.itemType===2&&!x.isManga));assert.ok(![...anime,...novels].some(x=>x.id===entry.id));
});
test('popular and latest use observed list handler with correct sort, page and total',async()=>{
 const calls=[];const {ext}=load({post:async(url,headers,body)=>{calls.push({url,headers,form:new URLSearchParams(body)});return reply(url,{UpdateComicItems:[item()],Count:42});}});
 const first=await ext.getPopular(1),last=await ext.getLatestUpdates(2);assert.equal(first.list[0].name,'漫畫 & 1');assert.equal(first.hasNextPage,true);assert.equal(last.hasNextPage,false);assert.equal(calls[0].form.get('sort'),'10');assert.equal(calls[1].form.get('sort'),'2');assert.equal(calls[1].form.get('pageindex'),'2');assert.equal(calls[0].form.get('pagesize'),'21');assert.equal(calls[0].form.get('action'),'getclasscomics');assert.equal(calls[0].url,base+'/manhua-list/dm5.ashx');
});
test('search preserves Chinese and form metacharacters, paginates and accepts genuine empty arrays',async()=>{
 const calls=[];const {ext}=load({post:async(url,headers,body)=>{calls.push(new URLSearchParams(body));return reply(url,calls.length===1?Array.from({length:10},(_,i)=>({...item(i+1),Url:'/manhua-test'+(i+1)+'/'})):[]);}});
 assert.equal((await ext.search(' ',1)).list.length,0);assert.equal(calls.length,0);assert.equal((await ext.search('狗與剪刀 & +',1)).hasNextPage,true);assert.equal(calls[0].get('title'),'狗與剪刀 & +');assert.equal(calls[0].get('t'),'7');assert.equal((await ext.search('狗',2)).hasNextPage,false);assert.equal(calls[1].get('pageindex'),'2');
});
test('catalogue rejects malformed responses and foreign links instead of reporting a false empty success',async()=>{
 for(const data of ['not json',{}, {UpdateComicItems:'bad'}, {UpdateComicItems:[{Title:'wrong',Url:'https://evil.test/manhua-test/'}]}]){
  const {ext}=load({post:async url=>reply(url,data)});await assert.rejects(ext.getPopular(1),/MHR-LIST/);
 }
 const {ext}=load();assert.equal(ext._items([{...item(),Url:'/manhua-test1/?from=x'},item()]).length,1);
});
test('all hidden chapter groups stay in reading order, duplicate links are removed and repeated labels retained',async()=>{
 const {ext}=load({get:async url=>reply(url,detail([[[103,'第3.5话'],[102,'第2话'],[101,'第1话']],[[202,'第2卷'],[201,'第1卷'],[101,'重複']]]))});
 const d=await ext.getDetail(comic),chapters=Array.from(d.chapters);assert.equal(d.name,'測試作品');assert.equal(d.author,'作者甲');assert.equal(d.status,1);assert.equal(chapters.length,5);assert.equal(ingestFresh(d.name,chapters).length,5);assert.deepEqual(readingOrder(d.name,chapters).map(c=>c.url),[101,102,103,201,202].map(id=>base+'/m'+id+'/'));assert.equal(chapters.at(-1).name,'0001｜第１话');
});
test('a WebView already showing ascending chapters does not reverse them again',async()=>{
 const {ext}=load({get:async url=>reply(url,detail([[[101,'第1话'],[102,'第2话']]],true))});const d=await ext.getDetail(comic);assert.equal(d.chapters.at(-1).url,chapter);
});
test('wrong series, missing details and missing chapters are explicit failures',async()=>{
 for(const html of ['<html></html>',detail([]),detail().replace("DM5_CURRENTURL='/manhua-test/'","DM5_CURRENTURL='/manhua-other/'")]){
  const {ext}=load({get:async url=>reply(url,html)});await assert.rejects(ext.getDetail(comic),/MHR-(?:DETAIL|CHAPTERS)/);
 }
 const {ext}=load();await assert.rejects(ext.getDetail('https://evil.test/manhua-test/'),/MHR-URL/);await assert.rejects(ext.getPageList(base+'/search/'),/MHR-URL/);
});
test('page list reads escaped URL literals in order and supplies image request headers',async()=>{
 const script=String.raw`var newImgs=['https:\/\/manhua1.cdndm5.com\/a.jpg?x=1\u0026y=2',"//manhua1.cdndm5.com/b.jpg"];`;
 const {ext}=load({get:async url=>reply(url,chapterHtml(101,script))});const pages=Array.from(await ext.getPageList(chapter));assert.deepEqual(pages.map(page=>page.url),['https://manhua1.cdndm5.com/a.jpg?x=1&y=2','https://manhua1.cdndm5.com/b.jpg']);assert.equal(pages[0].headers.Referer,chapter);assert.equal(pages[1].headers.Referer,chapter);assert.equal(ext.getHeaders(base).Referer,base);
});
test('large packed dictionaries decode multi-digit base-62 tokens without evaluating scripts',async()=>{
 const encode=value=>{let result='';do{const digit=value%62;result=(digit<36?digit.toString(36):String.fromCharCode(digit+29))+result;value=Math.floor(value/62);}while(value);return result;};
 const dictionary=Array(400).fill('');dictionary[399]='var';dictionary[163]='newImgs';dictionary[4]='https';dictionary[9]='manhua1';dictionary[5]='cdndm5';dictionary[6]='com';dictionary[7]='jpg';
 const payload=encode(399)+' '+encode(163)+"=['4://9.5.6/a.7'];",script='eval(function(p,a,c,k,e,d){throw new Error("must not execute");return p;}('+JSON.stringify(payload)+',62,400,'+JSON.stringify(dictionary.join('|'))+'.split("|"),0,{}))';
 const {ext}=load({get:async url=>reply(url,chapterHtml(101,script))});const pages=await ext.getPageList(chapter);assert.equal(pages.length,1);assert.equal(pages[0].url,'https://manhua1.cdndm5.com/a.jpg');
});
test('unsupported expressions, spoofed image hosts and incomplete arrays never yield partial page lists',async()=>{
 for(const script of ["var newImgs=['https://manhua1.cdndm5.com/a.jpg',run()];","var newImgs=['https://cdndm5.com.evil.test/a.jpg'];","var newImgs=['javascript:bad()'];","var newImgs=['https://manhua1.cdndm5.com/a.jpg'",String.raw`var newImgs=['https://manhua1.cdndm5.com/\uXXXX.jpg'];`]){
  const {ext}=load({get:async url=>reply(url,chapterHtml(101,script))});await assert.rejects(ext.getPageList(chapter),/MHR-(?:IMAGES|IMAGE-HOST)/);
 }
});
test('wrong chapter IDs fail before reading any image list',async()=>{
 const {ext}=load({get:async url=>reply(url,chapterHtml(102))});await assert.rejects(ext.getPageList(chapter),/MHR-CHAPTER/);
});
test('missing native image lists fall back to normal rendered pages and reject locked or malformed replies',async()=>{
 const {ext}=load({get:async url=>reply(url,chapterHtml(101,'var newImgs=[];')),browser:async(url,headers,scripts)=>{assert.match(scripts[0],/"kind":"images"/);return JSON.stringify({kind:'page',url,body:JSON.stringify(['https://manhua1.cdndm5.com/a.jpg'])});}});assert.equal((await ext.getPageList(chapter)).length,1);
 for(const body of ['[]','bad json','{}','["https://evil.test/a.jpg"]']){const {ext}=load({get:async url=>reply(url,chapterHtml(101,'')),browser:async url=>JSON.stringify({kind:'page',url,body})});await assert.rejects(ext.getPageList(chapter),/MHR-(?:IMAGES|IMAGE-HOST)/);}
});
test('a 403 list response retries through normal same-site WebView POST',async()=>{
 const {ext}=load({post:async url=>reply(url,'blocked',403),browser:async(url,headers,scripts)=>{assert.match(url,/manhua-list/);assert.match(scripts[0],/"kind":"post"/);return JSON.stringify({kind:'page',url,body:JSON.stringify({UpdateComicItems:[item()],Count:1})});}});assert.equal((await ext.getPopular(1)).list.length,1);
});
test('rate limits and failed browser POSTs do not trigger repeated fallback requests',async()=>{
 let calls=0;const {ext}=load({post:async url=>reply(url,'limited',429),browser:async()=>{calls++;}});await assert.rejects(ext.getPopular(1),/MHR-RATE/);assert.equal(calls,0);
 const broken=load({post:async()=>{throw Error('Network');},browser:async url=>{calls++;return JSON.stringify({kind:'page',url,body:'blocked',status:403});}}).ext;await assert.rejects(broken.getPopular(1),/MHR-CHALLENGE/);assert.equal(calls,1);
});
test('rendered image capture validates chapter identity and does not read browser cookies',async()=>{
 const {context}=load(),script=vm.runInContext('mhBrowserScript({kind:"images",chapter:"101"})',context),{document}=parseHTML(chapterHtml());Object.defineProperty(document,'cookie',{get(){throw Error('No cookie access');}});let data;
 const window={DM5_CID:101,newImgs:['https://manhua1.cdndm5.com/a.jpg'],flutter_inappwebview:{callHandler:async(name,raw)=>{data=JSON.parse(raw);}}};
 await vm.runInNewContext(script,{window,document,location:new URL(chapter),URL});assert.equal(data.kind,'page');assert.equal(JSON.parse(data.body).length,1);
 await vm.runInNewContext(script,{window,document,location:new URL(base+'/m102/'),URL});assert.equal(data.kind,'chapter');
});
test('rendered API fetch remains same-origin and sends the observed form without reading cookies',async()=>{
 const {context}=load(),script=vm.runInContext('mhBrowserScript({kind:"post",endpoint:"https://www.manhuaren.com/pagerdata.ashx",body:"t=7&title=test"})',context),{document}=parseHTML('<html><body></body></html>');let request,data;
 await vm.runInNewContext(script,{window:{flutter_inappwebview:{callHandler:async(name,raw)=>{data=JSON.parse(raw);}}},document,location:new URL(base+'/search/'),URL,fetch:async(url,options)=>{request={url,options};return{url,status:200,text:async()=>'[]'};}});assert.equal(data.kind,'page');assert.equal(request.options.credentials,'same-origin');assert.equal(request.options.method,'POST');assert.equal(request.options.body,'t=7&title=test');
});
