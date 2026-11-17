const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {load,parseHTML}=require('./helpers/harness.cjs');
const api='https://api.kadokado.cn',site='https://www.kadokado.cn';
const ok=(url,data)=>({statusCode:200,request:{url},body:JSON.stringify(data)});
const title={titleId:86395,displayName:'奧爾良的餘燼',ownerDisplayName:'打鐵矮人',authors:[{displayName:'打鐵矮人'}],genres:[{id:14,name:'古代歷史'}],tags:['權謀','權謀'],coverUrls:['https://img.kadokado.com.tw/insecure/cover'],logline:'簡介',isSerialized:true};
const collections=[
 {collectionDisplayName:'第一章',chapters:[{chapterId:11,chapterDisplayName:'第一節',isFree:true,listingFrom:'2026-07-31T18:01:21+08:00'},{chapterId:12,chapterDisplayName:'第二節',isFree:false}]},
 {collectionDisplayName:'第二章',chapters:[{chapterId:21,chapterDisplayName:'第一節',isFree:true}]}
];
test('KadoKado is a native novel source listing rankings, latest and relevance search',async()=>{
 const urls=[];
 const {ext}=load('kadokado',{http:async url=>{urls.push(url);
  if(url.includes('/v3/search'))return ok(url,{more:true,data:[{id:5,displayName:'甲'},{id:5,displayName:'甲'},{id:0,displayName:'壞'}]});
  return ok(url,[{titleId:1,displayName:'作品一',coverUrls:['https://img.kadokado.com.tw/a']},{titleId:2,titleDisplayName:'作品二',coverUrls:['https://evil.invalid/x']}]);}});
 const popular=await ext.getPopular(1);
 assert.deepEqual(Array.from(popular.list,x=>x.link),[site+'/book/1',site+'/book/2']);
 assert.equal(popular.list[1].imageUrl,'','covers only from the site image hosts');
 assert.match(urls[0],/\/v2\/rankings\?type=MostViewed&interval=Week$/);
 assert.deepEqual(JSON.parse(JSON.stringify(await ext.getPopular(2))),{list:[],hasNextPage:false});
 await ext.getLatestUpdates(1);assert.match(urls[1],/latestUpdatedTitles\?limit=50$/);
 const found=await ext.search('勇者',2,[]);
 assert.equal(found.list.length,1,'duplicates and broken rows dropped');assert.equal(found.hasNextPage,true);
 assert.match(urls[2],/keyword=%E5%8B%87%E8%80%85&current=2&limit=20&order=Relevance$/);
});
test('KadoKado details list only free chapters, numbered for the app reader, newest first',async()=>{
 const {ext}=load('kadokado',{http:async url=>ok(url,url.endsWith('/collection')?collections:title)});
 const work=await ext.getDetail(site+'/book/86395');
 assert.equal(work.name,'奧爾良的餘燼');assert.equal(work.author,'打鐵矮人');assert.deepEqual(Array.from(work.genre),['古代歷史','權謀']);
 assert.deepEqual(Array.from(work.chapters,c=>c.name),['0002 | 第二章 第一節','0001 | 第一章 第一節']);
 assert.deepEqual(Array.from(work.chapters,c=>c.url),[site+'/chapter/21',site+'/chapter/11']);
 await assert.rejects(ext.getDetail('https://evil.invalid/book/1'),/KK-URL/);
});
function browserFor(response){
 return async(url,headers,scripts)=>new Promise((resolve,reject)=>{
  const context={location:{href:url,hostname:new URL(url).hostname},setTimeout,clearTimeout,AbortController,
   fetch:async(target,options)=>{assert.equal(target,api+'/v3/chapter/11/content');assert.equal(options.credentials,'include');return response;},
   window:{flutter_inappwebview:{callHandler:(name,body)=>resolve(body)}}};
  context.window.location=context.location;
  try{for(const s of scripts)vm.runInNewContext(s.replace(/window\[/g,'globalThis.__w[').replace(/window\.flutter_inappwebview/g,'globalThis.__bridge'),{...context,globalThis:{__w:{},__bridge:context.window.flutter_inappwebview}});}catch(e){reject(e);}
 });
}
const json=(status,data)=>({status,ok:status===200,json:async()=>data});
test('KadoKado reads a chapter with the reader session and strips active content',async()=>{
 const {ext}=load('kadokado',{browser:browserFor(json(200,{type:'NOVEL',content:'<p onclick="x()">正文<script>bad()</script></p><img src="https://img.kadokado.com.tw/i.jpg" onerror="x"><img src="https://evil.invalid/p.gif"><iframe src="x"></iframe>',imageUrls:[]}))});
 const html=await ext.getHtmlContent('第一節',site+'/chapter/11');
 assert.match(html,/<h3>第一節<\/h3><p>正文<\/p><img src="https:\/\/img.kadokado.com.tw\/i.jpg">/);
 assert.doesNotMatch(html,/onclick|script|onerror|evil|iframe/);
});
test('KadoKado asks the reader to sign in when the site hides the text',async()=>{
 for(const response of [json(200,{type:'NOVEL',content:'<p></p>',imageUrls:[]}),json(401,{})]){
  const {ext}=load('kadokado',{browser:browserFor(response)});
  await assert.rejects(ext.getHtmlContent('第一節',site+'/chapter/11'),/KK-LOGIN/);
 }
});
