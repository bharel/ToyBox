import {getChatGPTUser} from '../../chatgpt-auth';
import {json,checkOrigin} from '../../../lib/server-sync';
import {guideProfile,updateGuideProfile} from '../../../lib/guide-profile';
import {savedWalkthrough} from '../../../lib/walkthrough-state';
import {savedSession} from '../../../lib/saved-session';
export const dynamic='force-dynamic';
export async function GET(request?:Request){const user=await getChatGPTUser();if(!user)return json({error:'Sign in to view guide preferences.'},401);try{const url=request&&new URL(request.url),id=url&&url.searchParams.get('walkthrough'),view=url&&url.searchParams.get('view');if(id&&view)throw Error('Choose a walkthrough or a session view.');return json(view==='session'||view==='goals'?await savedSession(user.userId,url?.searchParams.get('guid')||undefined):id?await savedWalkthrough(user.userId,id,url?.searchParams.get('guid')||undefined):await guideProfile(user.userId));}catch(e){return json({error:e instanceof Error?e.message:'The walkthrough could not be read.'},400);}}
export async function POST(request:Request){try{const user=await getChatGPTUser();if(!user)return json({error:'Sign in to save guide preferences.'},401);checkOrigin(request);const text=await request.text();if(text.length>500000)return json({error:'Guide preferences are too large.'},413);const body=JSON.parse(text);return json(await updateGuideProfile(user.userId,body.operations));}catch(e){return json({error:e instanceof Error?e.message:'Guide preferences were not saved.'},400)}}
