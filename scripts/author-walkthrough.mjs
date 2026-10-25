/** Offline authoring helper. Recordings produce unreviewed data, never executable scripts. */
import {readFileSync,writeFileSync} from 'node:fs';
import {validateGraph} from './walkthrough-content.mjs';
const args=process.argv.slice(2),get=flag=>args[args.indexOf(flag)+1];
if(args.includes('--validate')){const value=JSON.parse(readFileSync(get('--validate'),'utf8'));validateGraph(value.walkthrough||value,value.id||'authoring');console.log('Walkthrough structure and conditions are valid. Source review is still required.');}
else if(args.includes('--recording')&&args.includes('--out')){
 const bytes=readFileSync(get('--recording'));if(bytes.length>5_000_000)throw Error('Recording exceeds 5 MB.');
 const data=JSON.parse(bytes),recorded=Array.isArray(data)?data:data.recorded;
 if(!Array.isArray(recorded)||recorded.length>500)throw Error('Choose a bounded Toybox diagnostics recording.');
 const nodes=recorded.filter(v=>v&&typeof v.event==='string').map((v,i)=>({id:'recorded-'+String(i+1).padStart(3,'0'),kind:'observe',text:`Review the observed ${v.event.replace(/[^A-Z_]/g,'')} action and write the original player instruction.`,manual:true,sources:['local-recording:unreviewed'],...(Number.isSafeInteger(v.mapID)&&typeof v.x==='number'&&typeof v.y==='number'?{destination:{mapID:v.mapID,x:v.x,y:v.y}}:{}),observation:{event:v.event,at:Number(v.at)||undefined,questOrArgumentId:Number.isSafeInteger(v.argument)?v.argument:undefined}}));
 const result={id:'unreviewed-recording',validation:{sourceChecked:false,playtested:false,gaps:['Recorded observations need source corroboration and authored instructions.']},walkthrough:{version:2,contentVersion:'draft',routeIds:[],nodes}};
 validateGraph(result.walkthrough,result.id);writeFileSync(get('--out'),JSON.stringify(result,null,2)+'\n');console.log('Created a data-only draft. It is not included in releases automatically.');
}else throw Error('Use --validate path.json or --recording diagnostics.json --out draft.json.');
