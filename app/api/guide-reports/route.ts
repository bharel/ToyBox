import {getChatGPTUser} from '../../chatgpt-auth';
import {json,checkOrigin} from '../../../lib/server-sync';
import {guideReports,changeGuideReport} from '../../../lib/guide-reports';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();return user?json({reports:await guideReports(user.userId)}):json({error:'Sign in to view private reports.'},401);}
export async function POST(request:Request){try{const user=await getChatGPTUser();if(!user)return json({error:'Sign in to change private reports.'},401);checkOrigin(request);const text=await request.text();if(text.length>5000)return json({error:'Report change is too large.'},413);const data=JSON.parse(text);return json(await changeGuideReport(user.userId,data.id,{...(data.status?{status:data.status}:{}),...(data.note!==undefined?{note:data.note}:{}),...(data.deleted===true?{deleted:true}:{})}));}catch(e){return json({error:e instanceof Error?e.message:'Report change failed.'},400);}}
