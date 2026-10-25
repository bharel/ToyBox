import {characterScope,validCharacterRef,type CharacterRef,type Actor} from './characters';
import {settingsFrom,validateRecord,type Records,type Settings} from './planner';
export type Attribution=Partial<Record<Actor,CharacterRef|'skip'>>;
export function legacyActors(data:any){if(!['toybox-v1','toybox-v2'].includes(data?.format)||!data.records)return [];return (['priest','druid'] as Actor[]).filter(actor=>Object.keys(data.records).some(key=>/^(attempt|unlock|routine-done):/.test(key)&&key.split(':')[2]===actor));}
export function backupUpdates(data:any,current:Settings,attribution:Attribution={}){
 if(!['toybox-v1','toybox-v2'].includes(data?.format)||!data.records||typeof data.records!=='object'||Array.isArray(data.records))throw Error('Use a Toybox backup.');
 const missing=legacyActors(data).filter(actor=>!attribution[actor]);if(missing.length)throw Error('Attribute the old character history below, or explicitly skip it.');
 const updates:{key:string;value:unknown}[]=[];
 for(let [key,value] of Object.entries(data.records as Records)){
  if(/^(attempt|unlock|routine-done):/.test(key)){
   const parts=key.split(':'),role=parts[2];if(role==='warband')parts[0]='routine-done2';else if(role==='priest'||role==='druid'){const ref=attribution[role];if(ref==='skip')continue;if(!validCharacterRef(ref))throw Error('Choose a bound character for old history.');parts[0]+='2';parts[2]=characterScope(ref);}else throw Error('Unrecognized character in legacy history.');key=parts.join(':');
  }
  // Old slot settings are labels, not identity evidence. Retain current verified assignments.
  if(data.format==='toybox-v1'&&key==='settings'){const old=settingsFrom({settings:value});value={...old,priest:current.priest,druid:current.druid,priestRealm:current.priestRealm,druidRealm:current.druidRealm,bindings:current.bindings};}
  if(!validateRecord(key,value))throw Error(`Invalid backup record: ${key.slice(0,100)}`);updates.push({key,value});
 }
 if(updates.length>20000)throw Error('This backup exceeds 20,000 records.');return updates;
}
