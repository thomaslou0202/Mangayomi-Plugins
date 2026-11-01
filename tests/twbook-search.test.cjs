const test=require('node:test'),assert=require('node:assert/strict');
const {load,page}=require('./helpers/harness.cjs');
const base='https://www.twbook.cc';
const result='<div class="col search-list"><section><h1>搜尋 “無職” 結果</h1><ul class="list flex one two-700"><li class="row is-sm"><div class="col is-4"><img src="https://i1.twbook.cc/cover.jpg"></div><div class="col"><h3><a href="/240682697/">無職測試作品</a></h3></div></li></ul></section></div>';
test('TWBook searches public HTML directly and retains UTF-8 query',async()=>{
 let requested='';const {ext}=load('twbook',{http:async url=>{requested=url;return{statusCode:200,request:{url},body:result};}});
 const found=await ext.search('無職',1);assert.match(decodeURIComponent(requested),/\/search\/無職$/);assert.equal(found.list[0].name,'無職測試作品');assert.equal(found.list[0].link,base+'/240682697/');
});
test('TWBook challenge or intermediate pages use browser and wait for real results',async()=>{
 let script='';const {ext}=load('twbook',{http:async()=>({statusCode:200,body:'<html><title>搜尋載入中</title></html>'}),browser:async(url,headers,scripts)=>{script=scripts[0];return page(url,result);}});
 assert.equal((await ext.search('無職',1)).list.length,1);assert.match(script,/"waitFor":"\.search-list"/);
});
test('TWBook empty search results are valid while request redirects and rate limits stay explicit',async()=>{
 const empty=load('twbook',{http:async url=>({statusCode:200,request:{url},body:'<div class="search-list"><h1>搜尋結果</h1><ul class="list"></ul></div>'})}).ext;assert.equal((await empty.search('不存在的書',1)).list.length,0);
 const redirect=load('twbook',{http:async()=>({statusCode:200,request:{url:'https://ad.invalid/'},body:result})}).ext;await assert.rejects(redirect.search('無職',1),/TW-URL/);
 const limited=load('twbook',{http:async()=>({statusCode:429})}).ext;await assert.rejects(limited.search('無職',1),/TW-RATE/);
});
