import english from '../data/ui-en.json';
export type Language='de'|'en';
export function translate(text:string,language:Language){
 if(language==='de')return text;
 const table=english as Record<string,string>;
 if(table[text])return table[text];
 const trimmed=text.trim();
 return table[trimmed]?text.replace(trimmed,table[trimmed]):text;
}
