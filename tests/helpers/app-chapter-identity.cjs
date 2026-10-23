// Model of Mangayomi v0.9.9 ChapterRecognition.chapterIdentityKey and
// updateMangaDetail's fresh-catalogue duplicate checks. See
// docs/three-sources-references.md for the pinned app source references.
// This is deliberately separate from the extension implementation.
function recognize(mangaTitle, chapterName) {
  const name=chapterName.toLowerCase().split(mangaTitle.toLowerCase()).join('').trim()
    .replaceAll(',','.').replaceAll('-','.').replace(/\s(?=extra|special|omake)/g,'');
  const season=Number(/\b(?:staffel|season|saison|temporada|s|t)\s*([0-9]+)/.exec(name)?.[1]||0);
  const episode=/\b(?:folge|episode|episodio|ep\.?)\s*([0-9]+(?:\.[0-9]+)?)/.exec(name);
  let number;
  if(episode) number=Number(episode[1]);
  else {
    const stripped=name.replace(/\b(?:v|ver|vol|version|volume|season|staffel|saison|temporada|s|t)[^a-z]?[0-9]+/g,'');
    const match=/(?<=ch\.) *([0-9]+)(\.[0-9]+)?(\.?[a-z]+)?/.exec(stripped)
      || /([0-9]+)(\.[0-9]+)?(\.?[a-z]+)?/.exec(stripped);
    if(!match)return {season,number:null};
    let addition=0;
    if(match[2])addition=Number(match[2]);
    else if(match[3]) {
      const alpha=match[3];
      if(alpha.includes('extra'))addition=0.99;
      else if(alpha.includes('omake'))addition=0.98;
      else if(alpha.includes('special'))addition=0.97;
      else {
        const trimmed=alpha.replace('.','');
        if(trimmed.length===1){const n=trimmed.charCodeAt(0)-96;if(n>0&&n<10)addition=n/10;}
      }
    }
    number=Number(match[1])+addition;
  }
  return {season,number};
}
function identity(mangaTitle, chapterName, scanlator='') {
  const {season,number}=recognize(mangaTitle,chapterName);
  return number>0 ? `${season}::${number}::${scanlator}` : null;
}
function ingestFresh(title,chapters) {
  const seen=new Set();
  return chapters.filter(chapter=>{
    const url=chapter.url?.trim();if(!url)return false;
    const key=url.replace(/^https?:\/\/[^/]+/i,'');
    if(seen.has(key))return false;seen.add(key);
    const composite=identity(title,chapter.name,chapter.scanlator||'');
    if(composite!==null){if(seen.has('c:'+composite))return false;seen.add('c:'+composite);}
    return true;
  });
}
// Model of manga_extensions.dart _chapterSortKeys/getChapterListForReading.
// The reader ignores the chapter list UI's selected sort and uses these keys.
function readingOrder(title,chapters) {
  const raw=Array.from(chapters,(chapter,index)=>({chapter,index,...recognize(title,chapter.name||'')}));
  const seasonsByNumber=new Map();
  for(const row of raw){
    if(row.number===null)continue;
    if(!seasonsByNumber.has(row.number))seasonsByNumber.set(row.number,new Set());
    seasonsByNumber.get(row.number).add(row.season);
  }
  const numbered=raw.filter(row=>row.number!==null).length;
  const seasonLabelled=raw.filter(row=>row.number!==null&&row.season>0).length;
  const collisions=Array.from(seasonsByNumber.values()).filter(seasons=>seasons.size>1).length;
  const resets=collisions>=3||(collisions>=1&&numbered>0&&seasonLabelled/numbered>=0.5);
  for(const row of raw)row.key=row.number===null?null:(resets&&row.season>0?row.season*100000+row.number:row.number);
  raw.sort((a,b)=>((a.key??0)-(b.key??0))||a.index-b.index);
  const seen=new Set();
  return raw.filter(row=>row.key===null||(!seen.has(row.key)&&seen.add(row.key))).map(row=>row.chapter);
}
module.exports={recognize,identity,ingestFresh,readingOrder};
