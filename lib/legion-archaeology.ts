import data from './data/legion-archaeology.json';
export const legionFinds=data.rewards;
export const archaeologySource=data.source;
export const archaeologyQuestIds=legionFinds.flatMap(f=>f.quests.map(q=>q.id));
export const findForQuest=(id:number)=>legionFinds.find(f=>f.quests.some(q=>q.id===id));
