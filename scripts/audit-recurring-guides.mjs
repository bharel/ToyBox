import {readFileSync,writeFileSync} from 'node:fs';
const pack=JSON.parse(readFileSync('lib/data/guide-pack.json'));
const source=JSON.parse(readFileSync('lib/data/att-toy-routes.json'));
const priority=JSON.parse(readFileSync('lib/data/priority-guide-facts.json'));
const family=g=>g.system==='argent'?'Tournament':g.system==='archaeology'?'Archaeology':g.variants?'Engineering cooldowns':g.engineering?'Engineering progression':g.id.startsWith('rep-')?'Priority reputation weeklies':g.system==='reputation'?'Faction progression':g.raid?'Raid farming':g.facts?.missionID?'Mission tables':g.costs?.some(c=>c[0]!=='g')||g.requirements?.reputation?'Currency and standing requirements':['daily','weekly','fortnightly','repeatable','rotation','control'].includes(g.cadence)?'Other recurring activities':'Other acquisition routes';
const inherited=priority.argent.questFacts.filter(q=>source.quests[q.id]?.isDaily&&!q.repeatingFields.isDaily).map(q=>({questId:q.id,title:q.title,source:q.source,sourceLines:q.sourceLines}));
const rows=pack.guides.map(g=>({id:g.id,title:g.title,family:family(g),cadence:g.cadence,aliasOf:g.aliasOf||null,hasWalkthrough:!!g.walkthrough,sourceChecked:g.validation?.sourceChecked===true,playtested:g.validation?.playtested===true,gaps:g.validation?.gaps||[],source:g.source||null}));
const families={};for(const r of rows){const f=families[r.family]??={entries:0,canonical:0,sourceChecked:0,withGaps:0};f.entries++;if(!r.aliasOf){f.canonical++;if(r.sourceChecked)f.sourceChecked++;if(r.gaps.length)f.withGaps++;}}
const report={release:pack.release,reviewedAt:'2026-10-25',retailBuild:pack.retailBuild,sourceRevision:source.release,scope:'Structural screening of every compiled guide plus focused runtime fixtures for recurring-system families. This is not a playthrough or proof of complete instructions for every catalogue route.',guideEntries:rows.length,canonicalEntries:rows.filter(r=>!r.aliasOf).length,families,correctedInheritedDailyFlags:inherited,verifiedFamilies:[
 {family:'Tournament',checks:'Both Aspirant branches and all ten Valiant cities separate daily opportunities from accumulated seals; one rotating weapon slot; dated turn-ins and resets.',tests:['tests/argent-dailies-check.mjs','tests/recurring-progress-check.mjs']},
 {family:'Reputation',checks:'Loamm prioritizes actual observed reputation activities; its weekly counter remains separate. Poster observation advances automatically and excludes one-time introductions from weekly completion.',tests:['tests/recurring-progress-check.mjs','tests/guide-engine-check.py']},
 {family:'Archaeology',checks:'All thirteen chain definitions screened; known window persists offline; initial quest and final turn-in remain separate; unknown/expired windows stay unknown.',tests:['tests/recurring-progress-check.mjs']},
 {family:'Engineering',checks:'Daily, elapsed and sequential charges retain separate timing. Recipe and profession evidence, unknown initial state, use/Undo and catch-up uncertainty remain distinct from toy ownership.',tests:['tests/guide-engine-check.py','tests/guide-ui-check.py','tests/addon-check.py']},
 {family:'Farming and missions',checks:'Observed raid lockouts, running mission waits and daily/weekly quest opportunity completion stay separate from receiving or learning a toy. Generic directions and missing prerequisites remain coverage gaps.',tests:['tests/guide-engine-check.py','tests/recurring-progress-check.mjs']}
],limitations:['Zero recorded in-game route playtests.','Source-checked acquisition coverage remains unchanged; this audit does not turn metadata into complete walkthroughs.','A poster set includes only observed offers/accepted quests. Uninspected posters can still contain additional offers.','Unavailable reputation APIs, unknown rotations, mission unlocks, currency acquisition paths and unverified reset rules remain explicit gaps or observation steps.'],guides:rows};
writeFileSync('docs/RECURRING-PROGRESSION-AUDIT.json',JSON.stringify(report,null,2)+'\n');
const summary=[`# Recurring progression review — ${report.reviewedAt}`,`Release ${report.release}; frozen Retail build ${report.retailBuild}.`,
 `Structurally screened **${report.guideEntries} compiled entries** (${report.canonicalEntries} after aliases). Focused runtime fixtures cover the systems below. This does **not** mean every route has a complete walkthrough or has been played in game.`,
 '## Changes from the review',
 '- Aspirant and Valiant stages guide the daily opportunities; accumulated seals stay separate and carry over.',
 '- Retained 18 inherited Tournament daily flags and corrected daily/weekly cadence in quest-derived routes. Archaeology keeps its explicit fortnightly override.',
 '- Loamm Niffen recommends currently observed reputation work, keeping the 1,500-reputation weekly counter in the background. Inactive, expired, stale and unavailable map tasks are not recommended.',
 '- Accepted wanted quests lead the poster guide; observations are collected while other guides are selected. One-time introductions cannot finish a weekly set.',
 '- Known archaeology windows retain the observed chain and final turn-in through that window. Unknown or expired windows remain unknown.',
 '- Soridormi’s weekly instructions keep the one-time friendship/toy reward separate.',
 '- A consumed reward opportunity waits for its reset without learning the toy. Receiving an item and learning it remain separate.',
 '## Verification boundaries',...report.verifiedFamilies.map(f=>`- **${f.family}:** ${f.checks} Checks: ${f.tests.join(', ')}.`),
 '## Remaining coverage',
 ['| Family | Canonical entries | Source-checked walkthroughs | Entries with gaps |','|---|---:|---:|---:|',...Object.entries(families).map(([name,f])=>`| ${name} | ${f.canonical} | ${f.sourceChecked} | ${f.withGaps} |`)].join('\n'),
 ...report.limitations.map(t=>`- ${t}`),
 'The full entry-by-entry inventory is in [RECURRING-PROGRESSION-AUDIT.json](RECURRING-PROGRESSION-AUDIT.json).',
 `Source references: [pinned ATT Tournament records](https://github.com/ATTWoWAddon/AllTheThings/blob/${source.release}/.contrib/.db/standard/06%20-%20Expansion%20Features/03%20-%20Wrath%20of%20the%20Lich%20King/Argent%20Tournament.lua) and [Blizzard client task-map API declarations](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_APIDocumentationGenerated/QuestTaskInfoDocumentation.lua).`,
 ].join('\n\n');
writeFileSync('docs/RECURRING-PROGRESSION-AUDIT.md',summary+'\n');
console.log(JSON.stringify({screened:report.guideEntries,canonical:report.canonicalEntries,families:report.families,correctedInheritedDailyFlags:inherited.length}));
