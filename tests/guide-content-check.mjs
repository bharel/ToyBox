import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const pack=JSON.parse(readFileSync('lib/data/guide-pack.json'));
const ids=new Set(pack.guides.map(g=>g.id));assert.equal(ids.size,pack.guides.length);
const toys=new Set(pack.toys.map(t=>t.itemId));assert.equal(toys.size,pack.toys.length);
const routes=new Set();let total=0,gaps=0;const byId=new Map(pack.guides.map(g=>[g.id,g]));
for(const t of pack.toys)for(const r of t.routes){if(!r.summaryOnly&&!r.duplicateOf)total++;assert(!routes.has(r.id),r.id);routes.add(r.id);assert(['ongoing','unknown','removed','unreleased','external'].includes(r.availability));for(const id of r.guideIds)assert(ids.has(id));if(!r.summaryOnly&&!r.duplicateOf&&!r.guideIds.some(id=>byId.get(id)?.validation?.sourceChecked&&byId.get(id)?.validation?.completePath===true&&byId.get(id)?.walkthrough?.includesPrerequisites===true))gaps++;}
assert.equal(total,pack.coverage.acquisitionRoutes);assert.equal(gaps,pack.coverage.sourceOnlyRoutes);assert.equal(pack.gaps.length,gaps);assert.equal(pack.coverage.acquisitionRoutes-pack.coverage.sourceOnlyRoutes,pack.coverage.playableRoutes);
assert.equal(pack.coverage.authoredGuides,pack.guides.filter(g=>!g.metadataRoute).length);
for(const g of pack.guides){assert(g.steps.length>0);assert.equal(new Set(g.steps.map(s=>s.id)).size,g.steps.length);assert(g.playStyle);if(g.metadataRoute)assert(['metadata-directions','walkthrough','partial-walkthrough'].includes(g.coverage));if(g.engineering)assert.equal(g.requirements.professionId,202);if(g.destination){assert(g.destination.mapID>0);assert(g.destination.x>=0&&g.destination.x<=1);assert(g.destination.y>=0&&g.destination.y<=1);}for(const d of Object.values(g.dropEstimates||{})){assert(d.source.startsWith('https://www.wowhead.com/'));assert.equal(d.scope,'pooled');assert(d.retrievedAt);assert(d.percent>=0&&d.percent<=100);}}
const tournament=pack.guides.find(g=>g.id==='argent-tournament');assert(tournament.questIds.includes(13667)&&tournament.questIds.includes(13668));assert(tournament.questIds.length>200);
assert(pack.guides.find(g=>g.id==='legion-archaeology').persistent);assert.equal(pack.archaeology.length,13);
assert(pack.guides.some(g=>g.engineering&&g.cadence==='once'));assert(pack.guides.some(g=>g.engineering&&g.cadence==='weekly'));
assert(pack.attSource.files.every(f=>f.sha256.length===64));assert(pack.sources.some(s=>s.license==='MIT'));assert.equal(pack.retailBuild,'12.1.5.70575');
console.log('Passed shared guide content: toy/route/step identity, source classifications, coverage reconciliation, typed costs/destinations, optional Engineering, both Tournament factions, archaeology chains, pooled drop provenance and pinned source hashes.');
