import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
/** Every frozen active source keeps its identity, even when its guide is absent. */
export function auditCatalogue(pack,reviews=[]){
 const freeze=read('lib/data/catalogue-active-freeze.json'),byGuide=new Map(pack.guides.map(g=>[g.id,g]));
 const active=pack.toys.flatMap(t=>t.routes.filter(r=>!r.summaryOnly&&!r.duplicateOf&&r.availability==='ongoing').map(r=>({toy:t,route:r}))),byRoute=new Map(active.map(r=>[r.route.id,r]));
 const failures=[];for(const r of freeze.routes){const current=byRoute.get(r.routeId);if(!current||current.toy.itemId!==r.itemId)failures.push('Frozen active route was removed, reclassified or reassigned: '+r.routeId);}
 const covered=g=>g?.validation?.sourceChecked===true&&g.validation.completePath===true&&g.walkthrough?.includesPrerequisites===true;
 const rows=active.map(({toy,route})=>{
  const guides=route.guideIds.map(id=>byGuide.get(id)).filter(Boolean),complete=guides.find(covered),checked=guides.find(g=>g.validation?.sourceChecked);
  const related=reviews.filter(r=>r.sourceRouteIds?.includes(route.id));
  return {routeId:route.id,itemId:toy.itemId,name:toy.name,availability:route.availability,category:route.facts?.category||route.path?.at(-1),status:complete?'complete-path':checked?'usable-checkpoint':'authoring-gap',guideIds:route.guideIds,actions:(complete||checked||guides[0])?.walkthrough?.nodes.length||0,sourceChecked:!!(complete||checked),playtested:guides.some(g=>g.validation?.playtested===true),source:route.source||route.evidence?.source,gaps:complete?[]:[...new Set([...guides.flatMap(g=>g.validation?.gaps||[]),...related.flatMap(r=>r.issues||[])])].filter(Boolean)};
 });
 for(const row of rows)if(row.status==='authoring-gap'&&!row.gaps.length)row.gaps=['The source relationship, required actions or prerequisite walkthrough is not established.'];
 return {version:1,release:pack.release,retailBuild:pack.retailBuild,sourceRevision:freeze.sourceRevision,baselineCommit:freeze.baselineCommit,frozenActiveRoutes:freeze.routes.length,activeRoutes:rows.length,completePaths:rows.filter(r=>r.status==='complete-path').length,usableCheckpoints:rows.filter(r=>r.status==='usable-checkpoint').length,authoringGaps:rows.filter(r=>r.status==='authoring-gap').length,readyForComprehensivePlaytest:!failures.length&&rows.every(r=>r.status==='complete-path'),playtestedRoutes:rows.filter(r=>r.playtested).length,failures,rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const audit=auditCatalogue(read('lib/data/guide-pack.json'));
 console.log(JSON.stringify(Object.fromEntries(Object.entries(audit).filter(([key])=>key!=='rows'))));
 if(audit.failures.length||process.argv.includes('--require-complete')&&!audit.readyForComprehensivePlaytest)process.exitCode=1;
}
export function writeCatalogueAudit(pack,reviews){
 const audit=auditCatalogue(pack,reviews);if(audit.failures.length)throw Error(audit.failures.join('\n'));
 for(const dir of ['outputs','public/downloads']){mkdirSync(dir,{recursive:true});writeFileSync(dir+'/catalogue-route-audit.json',JSON.stringify(audit,null,2));}
 mkdirSync('outputs',{recursive:true});writeFileSync('outputs/catalogue-compiler-reviews.json',JSON.stringify(reviews,null,2));return audit;
}
