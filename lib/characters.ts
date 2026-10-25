export type Actor='priest'|'druid';
export type CharacterRef={region:'EU';id:number;realmSlug:string;name:string;realm:string;classId?:number};
export type CharacterSettings={priest:string;druid:string;priestRealm?:string;druidRealm?:string;bindings?:Partial<Record<Actor,CharacterRef>>};
export const normalized=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function validCharacterRef(v:unknown):v is CharacterRef{
 const c=v as CharacterRef;return !!c&&c.region==='EU'&&Number.isSafeInteger(c.id)&&c.id>0&&typeof c.realmSlug==='string'&&/^[a-z0-9-]{1,80}$/.test(c.realmSlug)&&typeof c.name==='string'&&c.name.length>0&&c.name.length<=60&&typeof c.realm==='string'&&c.realm.length>0&&c.realm.length<=80&&(c.classId===undefined||(Number.isInteger(c.classId)&&c.classId>0&&c.classId<100));
}
export function characterScope(c:CharacterRef){return `${c.region.toLowerCase()}_${c.realmSlug}_${c.id}`;}
export function boundCharacter(settings:CharacterSettings,actor:string):CharacterRef|null{
 if(actor!=='priest'&&actor!=='druid')return null;
 const c=settings.bindings?.[actor];if(!validCharacterRef(c)||normalized(c.name)!==normalized(settings[actor]))return null;
 const realm=settings[actor==='priest'?'priestRealm':'druidRealm'];
 if(!realm||![normalized(c.realm),normalized(c.realmSlug)].includes(normalized(realm)))return null;
 if(c.classId&&c.classId!==(actor==='priest'?5:11))return null;
 return c;
}
export function actorScope(settings:CharacterSettings,actor:string){if(actor==='warband')return 'warband';const c=boundCharacter(settings,actor);return c?characterScope(c):null;}
export function sameCharacter(a:CharacterRef,b:CharacterRef){return a.region===b.region&&a.id===b.id&&a.realmSlug===b.realmSlug;}
