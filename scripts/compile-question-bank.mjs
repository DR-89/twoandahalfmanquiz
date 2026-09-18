import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const authored=JSON.parse(await fs.readFile('data/authored.json','utf8'));
const expanded=JSON.parse(await fs.readFile('data/expanded-questions.json','utf8'));
const episodes=JSON.parse(await fs.readFile('data/episode-source-data.json','utf8'));
const bank=[...authored,...expanded];
const normalize=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ß/g,'ss').replace(/[^\p{L}\p{N}]/gu,'');
assert.equal(bank.length,3442);assert.equal(episodes.length,262);assert.equal(new Set(bank.map(q=>q.id)).size,bank.length);
for(const q of bank){
 assert(q.prompt&&q.answer&&q.explanation&&q.en?.prompt&&q.en?.answer&&q.en?.explanation,q.id);
 assert.equal(q.choices.length,q.en.choices.length,q.id);
 for(const v of [q,q.en])if(v.choices.length){assert.equal(v.choices.length,4,q.id);assert.equal(new Set(v.choices.map(normalize)).size,4,q.id);assert(v.choices.includes(v.answer),q.id);}
 if(q.answerKind==='character')assert.equal(q.choices.length,4,q.id+' character options');
 assert(!/Bananarama|ZXITEM|ZXNAME|undefined|BAD_NAME/.test(JSON.stringify(q)),q.id);
 assert(q.source.startsWith('https://'),q.id);
}
const catalogue=episodes.map(e=>{
 const qs=bank.filter(q=>q.episodeId===e.id);
 const counts=Object.fromEntries(['easy','medium','hard'].map(d=>[d,qs.filter(q=>q.difficulty===d).length]));
 assert.deepEqual(counts,{easy:4,medium:4,hard:5},e.id);
 assert.equal(new Set(qs.map(q=>q.prompt)).size,13,e.id+' duplicate German prompt');
 assert.equal(new Set(qs.map(q=>q.en.prompt)).size,13,e.id+' duplicate English prompt');
 return {id:e.id,season:e.season,number:e.number,title:e.title,originalTitle:e.originalTitle,kind:'episode',source:e.source,counts,ready:true};
});
const characterCounts=Object.fromEntries(['easy','medium','hard'].map(d=>[d,bank.filter(q=>q.category==='characters'&&q.difficulty===d).length]));
await fs.writeFile('data/questions.json',JSON.stringify(bank,null,2)+'\n');
await fs.writeFile('data/catalog-public.json',JSON.stringify(catalogue,null,2)+'\n');
await fs.writeFile('data/coverage.json',JSON.stringify({ready:262,total:262,questions:3442,episodeQuestions:3406,authored:authored.length,generated:expanded.length,characterCounts},null,2)+'\n');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const urls=[...new Set([...bank.map(q=>q.source),'https://de.wikipedia.org/wiki/Two_and_a_Half_Men/Episodenliste'])].sort();
const rows=urls.map(url=>{const u=new URL(url);const wiki=/wikipedia\.org|fandom\.com/.test(u.hostname);u.hash='';const base=u.toString();const history=base+(base.includes('?')?'&':'?')+'action=history';return `<li><a href="${esc(url)}">${esc(decodeURIComponent(url))}</a>${wiki?` · <a href="${esc(history)}">Autorinnen und Autoren / Versionsgeschichte</a>`:''}</li>`;}).join('\n');
await fs.writeFile('public/quellen.html',`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Quellen & Lizenzen · Malibu Quiz</title><style>body{max-width:960px;margin:40px auto;padding:0 24px;font:16px/1.7 system-ui;color:#18374a;background:#f5f8f9}a{color:#006f85;overflow-wrap:anywhere}li{margin:14px 0}h1{line-height:1.2}</style><a href="/">← Zurück zum Quiz</a><h1>Quellen, Autoren & Lizenzen</h1><p>262 Folgen mit jeweils 4 leichten, 4 mittleren und 5 schweren Fragen, zusätzlich 36 Charakterfragen. Die Doppelfolge „Natürlich ist er tot“ wird als Folge 15 und 16 der zwölften Staffel geführt.</p><p>Der erweiterte Bestand wurde aus Quellen automatisch zusammengestellt und ins Deutsche übersetzt. Handlungen wurden gekürzt, in Lückentexte umgearbeitet, mit Antwortmöglichkeiten versehen und teilweise paraphrasiert. Einzelne Begriffe und Formulierungen wurden korrigiert. Schwierigkeitseinstufung und Fakten sind noch nicht vollständig redaktionell geprüft.</p><p>Die übernommenen und bearbeiteten Wiki-Texte stammen von den jeweiligen Wikipedia- und Two and a Half Men Wiki-Mitwirkenden. Die verlinkten Versionsgeschichten nennen die Autorinnen und Autoren. Wikipedia-Texte: <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Fandom-Texte: <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>, siehe <a href="https://www.fandom.com/licensing">Fandom-Lizenzhinweise</a>. Unsere Bearbeitungen dieser Texte einschließlich der Übersetzungen stehen unter <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Andere verlinkte Seiten dienen nur als Faktenbelege; Dialogtranskripte werden nicht übernommen.</p><p>Das Strandhaus-Bild ist eine eigens erstellte KI-Illustration. Dieses Fanprojekt ist inoffiziell und nicht mit den Rechteinhabern der Serie verbunden.</p><h2>Verwendete Quellen</h2><ul>${rows}</ul></html>`);
console.log(`PASS: ${catalogue.length} episodes × (4 easy + 4 medium + 5 hard) = 3406; + 36 character questions = ${bank.length}.`);
