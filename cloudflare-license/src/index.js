import {verifyFirebaseAdmin} from './firebase-auth.js';
import {digest,adminRoutes,licenseCheck,errorResponse} from './license-api.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createHandler(verifyAdmin=verifyFirebaseAdmin){
 return {async fetch(request,env){
  const origin=request.headers.get('Origin');
  const allowed=new Set(['https://adneryt.github.io']);
  if(env.ALLOW_LOCAL_ORIGINS==='true')for(const port of [8765,8766,8789])for(const host of ['localhost','127.0.0.1'])allowed.add('http://'+host+':'+port);
  const cors=response=>{if(!origin)return response;const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');return new Response(response.body,{status:response.status,headers});};
  if(origin&&!allowed.has(origin))return json({error:'Origen no autorizado'},403);
  if(request.method==='OPTIONS'){
   const method=request.headers.get('Access-Control-Request-Method');
   const headers=(request.headers.get('Access-Control-Request-Headers')||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
   if(!origin||!['GET','POST'].includes(method)||headers.some(x=>!['authorization','content-type'].includes(x)))return cors(json({error:'Preflight no permitido'},403));
   return cors(new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}}));
  }
  try{
   const path=new URL(request.url).pathname;
   // Coarse abuse protection, not an exact global quota. Cloudflare supplies this IP.
   if(env.REQUEST_LIMITER){
    const ip=request.headers.get('CF-Connecting-IP')||'local';
    const {success}=await env.REQUEST_LIMITER.limit({key:ip});
    if(!success)return cors(new Response(JSON.stringify({error:'Demasiadas solicitudes. Reintenta en un minuto.'}),{status:429,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Retry-After':'60'}}));
   }else if(env.DEPLOYMENT_ENV==='production')return cors(json({error:'Proteccion de solicitudes no configurada'},503));
   if(path==='/health'&&request.method==='GET'){
    await env.DB.prepare('SELECT COUNT(*) AS total FROM licenses').first();
    return cors(json({ok:true,service:'ADNER YT IOS LICENSE',database:'connected',firebaseAuth:true}));
   }
   if(path==='/v1/license/check'&&request.method==='POST')return cors(await licenseCheck(request,env));
   if(!path.startsWith('/admin/'))return cors(json({error:'Ruta no disponible'},404));
   const header=request.headers.get('Authorization')||'',token=header.startsWith('Bearer ')?header.slice(7):'';
   let authorized=false;
   // ADMIN_SECRET is server-only, retained for existing local tooling. Never send it to the web app.
   if(env.DEPLOYMENT_ENV!=='production'&&env.ALLOW_LOCAL_ORIGINS==='true'&&token&&token.length<=10000&&env.ADMIN_SECRET&&token.length===env.ADMIN_SECRET.length)authorized=await digest(token)===await digest(env.ADMIN_SECRET);
   if(!authorized)authorized=await verifyAdmin(token);
   if(!authorized)return cors(json({error:'Sesion Firebase no autorizada. Inicia sesion con el administrador configurado.'},401));
   return cors(await adminRoutes(request,env,path));
  }catch(error){return cors(errorResponse(error));}
 }};
}
export default createHandler();
