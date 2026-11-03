import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { lots, closes } from '../../../lib/catalog';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 try { const user=await getChatGPTUser(); const db=env.DB!;
 const result=await db.prepare('SELECT lot, MAX(amount) AS amount, COUNT(*) AS count FROM bids GROUP BY lot').all();
 const mine=user?await db.prepare('SELECT lot, MAX(amount) AS amount FROM bids WHERE user_id=? GROUP BY lot').bind(user.userId).all():{results:[]};
 return json({bids:result.results,mine:mine.results,user:user?{name:user.displayName}:null,now:Date.now()});
 }catch{return json({error:'No pudimos consultar las pujas. Intenta nuevamente.'},503);}
}
export async function POST(req:Request){
 try {if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Solicitud no permitida.'},403);
 const user=await getChatGPTUser();if(!user)return json({error:'Inicia sesión para realizar una puja.'},401);
 const {lot,amount}=await req.json() as {lot:number;amount:number};const item=lots.find(x=>x.id===lot);
 if(!item||!Number.isSafeInteger(amount)||amount>100000000||amount<item.base+500)return json({error:'Ingresa un monto válido. El incremento mínimo es de $500 MXN.'},400);
 if(Date.now()>=closes)return json({error:'Esta subasta ha finalizado.'},409);
 const r=await env.DB!.prepare('INSERT INTO bids (id,lot,amount,user_id,created_at) SELECT ?,?,?,?,? WHERE ? >= COALESCE((SELECT MAX(amount) FROM bids WHERE lot=?),?)+500 AND ? < ?').bind(crypto.randomUUID(),lot,amount,user.userId,Date.now(),amount,lot,item.base,Date.now(),closes).run();
 if(!r.meta.changes)return json({error:'La oferta cambió. Actualizamos el monto; intenta con una puja mayor.'},409);
 return json({ok:true});
 }catch{return json({error:'No se pudo guardar la puja. Intenta nuevamente.'},503);}
}
