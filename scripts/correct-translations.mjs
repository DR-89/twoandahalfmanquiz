import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const file='.source-cache/question-translations-v2.json',memory=JSON.parse(await fs.readFile(file,'utf8'));
const corrections={
 "While working on the house, Fernando beats Charlie out for his ____ Chloe's affections, and also from Berta.":'Während Fernando am Haus arbeitet, gewinnt er sowohl die Zuneigung von Charlies ____ Chloe als auch von Berta.',
 "Chelsea invites her beautiful college ____, Gail, to stay at the house while Gail gets over a bad breakup with her boyfriend, Brian.":'Chelsea lädt ihre frühere ____ vom College, Gail, ins Haus ein, damit sie über die Trennung von ihrem Freund Brian hinwegkommt.',
 'Charlie is not amused when Alan, who finally moved in with Lyndsey McElroy, returns to his beach-house for "goodbye ____" with Melissa, who still thinks he lives there.':'Charlie ist verärgert, als Alan nach dem Einzug bei Lyndsey McElroy zum Abschieds-____ mit Melissa ins Strandhaus zurückkehrt. Melissa glaubt noch immer, dass Alan dort wohnt.',
 watch:'Uhr',date:'Verabredung',cold:'Erkältung',check:'Scheck',ring:'Ring',pipe:'Pfeife',model:'Model',spray:'Spray',singing:'Singen',football:'American Football',soccer:'Fußball',high_school:'Highschool',
 'high school':'Highschool','Sea Breeze':'Sea Breeze',"Pavlov's":"Pavlov’s",'Pavlov’s':'Pavlov’s','Electronic Suitcase':'Electronic Suitcase','Charlie Waffles':'Charlie Waffles',
 Thanksgiving:'Thanksgiving',Army:'Army','Air Force':'Air Force',Navy:'Navy',Marines:'Marines',Winning:'Winning',proposal:'Heiratsantrag',engagement:'Verlobung',commitment:'feste Bindung',commercial:'Werbespot','community service':'gemeinnützige Arbeit','child support':'Kindesunterhalt','school play':'Schultheaterstück',
 'The Taming of the Shrew':'Der Widerspenstigen Zähmung','Oshikuru: Demon Samurai':'Oshikuru: Demon Samurai','marriage proposal':'Heiratsantrag','advertising award':'Werbepreis','award ceremony':'Preisverleihung'
};
for(const [s,de]of Object.entries(corrections))memory[createHash('sha256').update(s).digest('hex')]=de;
await fs.writeFile(file,JSON.stringify(memory,null,2));
