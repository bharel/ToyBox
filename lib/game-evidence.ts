import type {CharacterRef} from './characters';
export type GameRecipe={spellId:number;blizzardRecipeId?:number;clientSkillLineAbilityId?:number;at:number;cooldownSeconds?:number;charges?:number;maxCharges?:number};
export type GameQuest={id:number;title:string;frequency?:number;complete?:boolean;objectives?:{text:string;fulfilled:number;required:number;finished:boolean}[]};
export type QuestTurnIn={id:number;title:string;frequency?:number;at:number;resetAt?:number};
export type RaidClear={instance:string;difficultyId:number;encounter:string;at:number};
export type RouteObservation={route:'arachnis'|'kovork'|'gong'|'memento'|'darkmoon';kind:'npc'|'calendar';npcId?:number;at:number;expiresAt:number};
export type GameEvidence={version:1;questsAvailable:boolean;permanentQuestIds?:number[];offeredQuests?:{id:number;at:number}[];questTurnIns?:QuestTurnIn[];questChecks?:{id:number;completed:boolean;at:number}[];archaeologyEndAt?:number;professions?:{at:number;data:{id:number;name:string;skill:number;max:number}[]};raidClears?:RaidClear[];routes?:RouteObservation[];instances:{instanceId:number;difficultyId:number;at:number}[];recipes:GameRecipe[]};
export type BoundGameEvidence={ref:CharacterRef;at:number;completedQuestIds:number[];questLogIds:number[];questLog?:GameQuest[];data:GameEvidence};
