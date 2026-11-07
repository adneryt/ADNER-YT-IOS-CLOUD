const encoder=new TextEncoder();
export const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value))].map(x=>x.toString(16).padStart(2,'0')).join('');
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
const idOK=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
const randomKey=()=> 'ADNER-'+[...crypto.getRandomValues(new Uint8Array(24))].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
async function body(request){
 if(Number(request.headers.get('Content-Length'))>32768)fail('Solicitud demasiado grande',413);
 const reader=request.body?.getReader();if(!reader)fail('JSON invalido');let total=0;const chunks=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>32768){await reader.cancel();fail('Solicitud demasiado grande',413)}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{const d=JSON.parse(new TextDecoder().decode(bytes));if(!d||typeof d!=='object'||Array.isArray(d))fail('JSON invalido');return d}catch{fail('JSON invalido')}
}
export async function adminRoutes(request,env,path){
 const db=env.DB,now=Date.now();
 if(path==='/admin/session'&&request.method==='GET')return reply({ok:true,administrator:true});
 if(path==='/admin/licenses'&&request.method==='GET'){
  const result=await db.prepare(`SELECT l.id,l.label,l.created_at,l.activated_at,l.expires_at,l.duration_seconds,l.start_mode,l.max_devices,l.status,l.paused_at,(SELECT COUNT(*) FROM license_devices d WHERE d.license_id=l.id) AS devices FROM licenses l ORDER BY created_at DESC,id LIMIT 200`).all();
  return reply({ok:true,licenses:result.results});
 }
 if(path==='/admin/licenses'&&request.method==='POST'){
  const d=await body(request),hours=Number(d.hours),max=Number(d.maxDevices),count=d.count===undefined?1:Number(d.count);
  const mode=d.startMode==='first-use'?'activation':d.startMode;
  if(!Number.isInteger(hours)||hours<1||hours>8760)fail('Duracion invalida (1..8760 horas)');
  if(!Number.isInteger(max)||max<0||max>100000)fail('Limite de dispositivos invalido');
  if(!Number.isInteger(count)||count<1||count>25)fail('Cantidad invalida (1..25)');
  if(!['creation','activation'].includes(mode))fail('Modo de inicio invalido');
  if(typeof d.label!=='string'||d.label.length>80)fail('Nombre invalido');
  const licenses=[],statements=[];
  for(let i=0;i<count;i++){
   const key=randomKey(),id=await digest(key),label=(d.label||'Licencia ADNER')+(count>1?' '+(i+1):'');
   statements.push(db.prepare(`INSERT INTO licenses(id,label,created_at,duration_seconds,start_mode,expires_at,max_devices,status) VALUES(?,?,?,?,?,?,?,'active')`).bind(id,label,now,hours*3600,mode,mode==='creation'?now+hours*3600000:null,max));
   statements.push(db.prepare(`INSERT INTO license_history(license_id,action,created_at,details) VALUES(?,'created',?,'Creada desde administrador')`).bind(id,now));
   licenses.push({id,key,label});
  }
  await db.batch(statements);
  return reply({ok:true,...(count===1?licenses[0]:{}),licenses,message:'Copia las claves ahora; no se recuperan despues.'},201);
 }
 const match=path.match(/^\/admin\/licenses\/([a-f0-9]{64})(?:\/(pause|resume|revoke|reset-devices|history|delete))?$/);
 if(!match)return reply({error:'Operacion no disponible'},404);
 const [,id,action]=match;if(!idOK(id))fail('ID invalido');
 if(action==='delete'&&request.method==='POST'){
  const d=await body(request);
  if(d.confirm!=='ELIMINAR'||d.licenseId!==id)fail('Confirmacion de eliminacion invalida',400);
  const existing=await db.prepare('SELECT id,label,status FROM licenses WHERE id=?').bind(id).first();
  if(!existing)fail('Licencia inexistente',404);
  // D1 batch is atomic; deletion audit lives outside the deleted license's FK tree.
  const result=await db.batch([
   db.prepare('INSERT INTO license_deletion_audit(license_id,label,status,deleted_at,actor) VALUES(?,?,?,?,?)').bind(id,existing.label,existing.status,now,'firebase-admin'),
   db.prepare('DELETE FROM license_devices WHERE license_id=?').bind(id),
   db.prepare('DELETE FROM license_history WHERE license_id=?').bind(id),
   db.prepare('DELETE FROM licenses WHERE id=?').bind(id)
  ]);
  if(result[3].meta.changes!==1)fail('No se completo la eliminacion',409);
  return reply({ok:true,deleted:true});
 }
 if(action==='history'&&request.method==='GET'){
  const rows=await db.prepare('SELECT action,created_at,details FROM license_history WHERE license_id=? ORDER BY id DESC LIMIT 200').bind(id).all();return reply({ok:true,history:rows.results});
 }
 if(request.method!=='POST')return reply({error:'Metodo no permitido'},405);
 const exists=await db.prepare('SELECT status FROM licenses WHERE id=?').bind(id).first();if(!exists)fail('Licencia inexistente',404);
 const log=db.prepare('INSERT INTO license_history(license_id,action,created_at,details) VALUES(?,?,?,?)').bind(id,action,now,'Operacion administrativa');
 if(action==='pause'){
  const r=await db.batch([db.prepare(`UPDATE licenses SET status='paused',paused_at=? WHERE id=? AND status='active' AND (expires_at IS NULL OR expires_at>?)`).bind(now,id,now),db.prepare(`INSERT INTO license_history(license_id,action,created_at,details) SELECT ?,'pause',?,'Tiempo pausado' WHERE changes()>0`).bind(id,now)]);
  if(!r[0].meta.changes)fail('Solo se pausa una licencia activa no vencida',409);
 }else if(action==='resume'){
  const r=await db.batch([db.prepare(`UPDATE licenses SET expires_at=CASE WHEN expires_at IS NULL THEN NULL ELSE expires_at+MAX(0,?-paused_at) END,status='active',paused_at=NULL WHERE id=? AND status='paused'`).bind(now,id),db.prepare(`INSERT INTO license_history(license_id,action,created_at,details) SELECT ?,'resume',?,'Tiempo reanudado' WHERE changes()>0`).bind(id,now)]);
  if(!r[0].meta.changes)fail('Solo se reanuda una licencia pausada',409);
 }else if(action==='revoke'){
  await db.batch([db.prepare(`UPDATE licenses SET status='revoked' WHERE id=?`).bind(id),log]);
 }else if(action==='reset-devices'){
  await db.batch([db.prepare('DELETE FROM license_devices WHERE license_id=?').bind(id),log]);
 }else return reply({error:'Operacion no disponible'},404);
 return reply({ok:true});
}
function decode64(value){if(typeof value!=='string'||value.length>200)fail('Prueba invalida',403);try{return Uint8Array.from(atob(value),c=>c.charCodeAt(0))}catch{fail('Prueba invalida',403)}}
export async function licenseCheck(request,env){
 const d=await body(request),now=Date.now();
 if(typeof d.key!=='string'||!/^[A-Za-z0-9_-]{32,100}$/.test(d.key)||!Number.isSafeInteger(d.timestamp)||Math.abs(now-d.timestamp)>300000)fail('Solicitud invalida o reloj desajustado',403);
 const raw=decode64(d.publicKey),signature=decode64(d.signature);if(raw.length!==32||signature.length!==64)fail('Identidad invalida',403);
 const id=await digest(d.key),device=await digest(raw);
 const key=await crypto.subtle.importKey('raw',raw,{name:'Ed25519'},false,['verify']);
 if(!await crypto.subtle.verify('Ed25519',key,signature,encoder.encode(id+'|'+d.publicKey+'|'+d.timestamp)))fail('Firma de dispositivo invalida',403);
 // D1 batch executes atomically: the device cap and first activation are not separate transactions.
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO license_devices(license_id,device_id,public_key,activated_at,last_seen_at)
   SELECT id,?,?,?,? FROM licenses WHERE id=? AND status='active' AND (expires_at IS NULL OR expires_at>?)
    AND (max_devices=0 OR (SELECT COUNT(*) FROM license_devices WHERE license_id=licenses.id)<max_devices)
   ON CONFLICT(license_id,device_id) DO NOTHING`).bind(device,d.publicKey,now,now,id,now),
  env.DB.prepare(`INSERT INTO license_history(license_id,action,created_at,details) SELECT ?,'device-added',?,'Instalacion registrada' WHERE changes()>0`).bind(id,now),
  env.DB.prepare(`UPDATE licenses SET activated_at=COALESCE(activated_at,?),expires_at=COALESCE(expires_at,?+duration_seconds*1000)
   WHERE id=? AND status='active' AND EXISTS(SELECT 1 FROM license_devices WHERE license_id=? AND device_id=?)`).bind(now,now,id,id,device),
  env.DB.prepare(`UPDATE license_devices SET last_seen_at=? WHERE license_id=? AND device_id=? AND EXISTS(SELECT 1 FROM licenses WHERE id=? AND status='active' AND expires_at>?)`).bind(now,id,device,id,now)
 ]);
 const row=await env.DB.prepare('SELECT status,expires_at FROM licenses WHERE id=?').bind(id).first();
 if(!row||row.status!=='active'||!row.expires_at||row.expires_at<=now)fail('Clave inexistente, suspendida, revocada o vencida',403);
 const installation=await env.DB.prepare('SELECT device_id FROM license_devices WHERE license_id=? AND device_id=?').bind(id,device).first();
 if(!installation)fail('Limite de dispositivos alcanzado',403);
 const seconds=Math.min(60,Math.floor((row.expires_at-now)/1000));if(seconds<1)fail('Clave vencida',403);
 return reply({allowed:true,validForSeconds:seconds,expiresAt:row.expires_at,device});
}
export function errorResponse(error){return reply({allowed:false,error:error.status?error.message:'Error interno del servicio',message:error.status?error.message:'Servicio no disponible'},error.status||503);}
