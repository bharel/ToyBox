import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateRecord } from "../../../lib/planner";
export const dynamic = "force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET() {
  const user=await getChatGPTUser();
  if(!user)return json({error:"Sign in to save and load your planner."},401);
  if(!env.DB)return json({error:"Progress storage is unavailable. Please try again."},503);
  const {results}=await env.DB.prepare("SELECT key,value FROM planner_records WHERE user_id = ?").bind(user.userId).all<{key:string;value:string}>();
  return json({records:Object.fromEntries(results.map(row=>[row.key,JSON.parse(row.value)])),serverTime:Date.now()});
}
export async function POST(request:Request) {
  const user=await getChatGPTUser();
  if(!user)return json({error:"Sign in to save progress."},401);
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return json({error:"Invalid request origin."},403);
  if(!env.DB)return json({error:"Progress storage is unavailable. Please try again."},503);
  const raw=await request.text();
  if(raw.length>512000)return json({error:"Import is too large."},413);
  let payload:{updates?:{key:string;value:unknown}[]};
  try {payload=JSON.parse(raw);}catch{return json({error:"Invalid JSON."},400);}
  if(!payload||!Array.isArray(payload.updates)||!payload.updates.length||payload.updates.length>1000||!payload.updates.every(u=>u&&typeof u.key==="string"&&validateRecord(u.key,u.value)))return json({error:"Some planner data is invalid. Nothing was changed."},400);
  const now=new Date().toISOString();
  await env.DB.batch(payload.updates.map(({key,value})=>value===null
    ?env.DB!.prepare("DELETE FROM planner_records WHERE user_id=? AND key=?").bind(user.userId,key)
    :env.DB!.prepare("INSERT INTO planner_records (user_id,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(user.userId,key,JSON.stringify(value),now)));
  return json({ok:true,savedAt:now});
}
