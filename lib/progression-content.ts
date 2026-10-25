import type {ArgentCity} from './progression';
import {archaeologyQuestIds} from './legion-archaeology';
// Retail ATT data, commit 0bb8f4be59bcc0262830400914516ef1698d789e:
// .contrib/.db/standard/06 - Expansion Features/03 - Wrath of the Lich King/Argent Tournament.lua
// Missing profile quest flags are not proof of non-completion. Champion challenges, unlike
// the race-specific A Champion Rises introductions, work for subsequent city branches.
export const ARGENT_INTROS=[13667,13668,13828,13829,13837,13839,13835,13838,13672,13678];
export const ARGENT_ASPIRANT_CHALLENGES=[13679,13680];
export const ARGENT_CRUSADER_ACHIEVEMENTS=[2816,2817];
export const argentCities:ArgentCity[]=[
 {id:'stormwind',name:'Stormwind',faction:'ALLIANCE',raceIds:[1],valiantQuest:13684,laterQuest:13593,chargeQuest:13718,challengeQuest:13699,championQuest:13702},
 {id:'ironforge',name:'Ironforge',faction:'ALLIANCE',raceIds:[3],valiantQuest:13685,laterQuest:13703,chargeQuest:13714,challengeQuest:13713,championQuest:13732},
 {id:'gnomeregan',name:'Gnomeregan',faction:'ALLIANCE',raceIds:[7],valiantQuest:13688,laterQuest:13704,chargeQuest:13715,challengeQuest:13723,championQuest:13733},
 {id:'darnassus',name:'Darnassus',faction:'ALLIANCE',raceIds:[4,22],valiantQuest:13689,laterQuest:13706,chargeQuest:13717,challengeQuest:13725,championQuest:13735},
 {id:'exodar',name:'Exodar',faction:'ALLIANCE',raceIds:[11],valiantQuest:13690,laterQuest:13705,chargeQuest:13716,challengeQuest:13724,championQuest:13734},
 {id:'orgrimmar',name:'Orgrimmar',faction:'HORDE',raceIds:[2,9],valiantQuest:13691,laterQuest:13707,chargeQuest:13697,challengeQuest:13726,championQuest:13736},
 {id:'senjin',name:'Sen’jin',faction:'HORDE',raceIds:[8],valiantQuest:13693,laterQuest:13708,chargeQuest:13719,challengeQuest:13727,championQuest:13737},
 {id:'thunder-bluff',name:'Thunder Bluff',faction:'HORDE',raceIds:[6],valiantQuest:13694,laterQuest:13709,chargeQuest:13720,challengeQuest:13728,championQuest:13738},
 {id:'undercity',name:'Undercity',faction:'HORDE',raceIds:[5],valiantQuest:13695,laterQuest:13710,chargeQuest:13721,challengeQuest:13729,championQuest:13739},
 {id:'silvermoon',name:'Silvermoon',faction:'HORDE',raceIds:[10],valiantQuest:13696,laterQuest:13711,chargeQuest:13722,challengeQuest:13731,championQuest:13740},
];
export const relevantQuestIds=()=>[...new Set([...ARGENT_INTROS,...ARGENT_ASPIRANT_CHALLENGES,...argentCities.flatMap(c=>[c.valiantQuest,c.laterQuest,c.chargeQuest,c.challengeQuest,c.championQuest!]),...archaeologyQuestIds,34586,34378,45423,46291,54185,56491,58457])];
export const relevantAchievementIds=[2816,2817,3676,3677];
export const progressionSources={tournament:'https://github.com/ATTWoWAddon/AllTheThings/blob/0bb8f4be59bcc0262830400914516ef1698d789e/.contrib/.db/standard/06%20-%20Expansion%20Features/03%20-%20Wrath%20of%20the%20Lich%20King/Argent%20Tournament.lua',archaeology:'https://github.com/ATTWoWAddon/AllTheThings/blob/0bb8f4be59bcc0262830400914516ef1698d789e/.contrib/.db/standard/10%20-%20Professions/Archaeology.lua'};
