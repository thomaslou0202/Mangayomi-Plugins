const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
class Element {
    constructor(node){this.node=node;}
    select(selector){if(!this.node)return [];const nodes=selector.split(',').flatMap(group=>Array.from(this.node.querySelectorAll(group.trim())));return [...new Set(nodes)].map(node=>new Element(node));}
    attr(name){return this.node?this.node.getAttribute(name)||'':'';}
    get text(){return this.node?this.node.textContent||'':'';}
    get innerHtml(){return this.node?this.node.innerHTML||'':'';}
}
class Document extends Element {constructor(html){super(parseHTML(html).document);}}
function load(name,{preferences={},browser=async()=>{throw new Error('Unexpected network request');}}={}) {
    class SharedPreferences {get(key){return preferences[key];}}
    const context=vm.createContext({Document,SharedPreferences,MProvider:class{},evaluateJavascriptViaWebview:browser});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../../javascript/novel/src/zh',name+'.js'),'utf8')+'\nglobalThis.ext=new DefaultExtension();',context);
    return {ext:context.ext,context};
}
const page=(url,html,extra={})=>JSON.stringify({kind:'page',url,html,...extra});
module.exports={load,page,parseHTML};
