import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateKeyPair,SignJWT,createLocalJWKSet,exportJWK} from 'jose';
import {createFirebaseVerifier} from '../src/firebase-auth.js';
import {createHandler} from '../src/index.js';
import {digest} from '../src/license-api.js';
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0001_licenses.sql',import.meta.url),'utf8'));sql.exec(readFileSync(new URL('../migrations/0002_license_deletion_audit.sql',import.meta.url),'utf8'));sql.exec(readFileSync(new URL('../migrations/0003_license_key_vault.sql',import.meta.url),'utf8'));
 const statement=(query,args=[])=>({bind(...values){return statement(query,values)},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const x=sql.prepare(query).run(...args);return {meta:{changes:Number(x.changes)}}},query,args});
 return {prepare:statement,async batch(list){sql.exec('BEGIN');try{const out=[];for(const x of list)out.push(await x.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}},sql};
}
const uid='OxWCNpO2vRQT0ejIRPFmjU5Ygit2',project='adner-yt-ios-cloud';
test('Firebase signature, project, UID and required expiry are enforced',async()=>{
 const pair=await generateKeyPair('RS256'),jwk=await exportJWK(pair.publicKey);jwk.kid='test-key';
 const verify=createFirebaseVerifier(createLocalJWKSet({keys:[jwk]}));
 const now=Math.floor(Date.now()/1000),claims={sub:uid,aud:project,iss:'https://securetoken.google.com/'+project,iat:now,exp:now+300,auth_time:now};
 const token=c=>new SignJWT(c).setProtectedHeader({alg:'RS256',kid:'test-key'}).sign(pair.privateKey);
 assert.equal(await verify(await token(claims)),true);
 for(const patch of [{sub:'another-user'},{aud:'another-project'},{iss:'https://evil.test'},{exp:now-1},{auth_time:now+60}])assert.equal(await verify(await token({...claims,...patch})),false);
 for(const field of ['exp','iat','auth_time']){const missing={...claims};delete missing[field];assert.equal(await verify(await token(missing)),false);}
 assert.equal(await verify('invalid'),false);
});
test('CORS and admin authentication reject before database mutation',async()=>{
 const DB=database(),handler=createHandler(async()=>false),env={DB,LICENSE_VAULT_KEY:Buffer.alloc(32,7).toString('base64')};
 for(const [headers,status]of [[{Origin:'https://evil.test'},403],[{},401]]){const r=await handler.fetch(new Request('https://test/admin/licenses',{method:'POST',headers,body:'{}'}),env);assert.equal(r.status,status)}
 assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM licenses').get().n,0);
 const r=await handler.fetch(new Request('https://test/admin/licenses',{method:'OPTIONS',headers:{Origin:'https://adneryt.github.io','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}}),env);
 assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://adneryt.github.io');DB.sql.close();
});
test('production ignores local secret, forbids local origins and enforces request limiter',async()=>{
 const DB=database(),handler=createHandler(async()=>false),secret='test-only-secret',limiter={limit:async()=>({success:true})};
 const r=()=>new Request('https://test/admin/session',{headers:{Authorization:'Bearer '+secret}});
 assert.equal((await handler.fetch(r(),{DB,ADMIN_SECRET:secret,DEPLOYMENT_ENV:'production',REQUEST_LIMITER:limiter})).status,401);
 assert.equal((await handler.fetch(r(),{DB,ADMIN_SECRET:secret,ALLOW_LOCAL_ORIGINS:'true'})).status,200);
 assert.equal((await handler.fetch(r(),{DB,DEPLOYMENT_ENV:'production'})).status,503);
 assert.equal((await handler.fetch(r(),{DB,DEPLOYMENT_ENV:'production',REQUEST_LIMITER:{limit:async()=>({success:false})}})).status,429);
 const origin=new Request('https://test/admin/session',{headers:{Origin:'http://localhost:8766'}});
 assert.equal((await handler.fetch(origin,{DB,DEPLOYMENT_ENV:'production',REQUEST_LIMITER:limiter})).status,403);
 DB.sql.close();
});
test('D1 schema lifecycle: bulk, signed activation, caps, pause/resume, reset and revoke',async()=>{
 const DB=database(),handler=createHandler(async token=>token==='test-admin'),env={DB,LICENSE_VAULT_KEY:Buffer.alloc(32,7).toString('base64')};
 async function request(path,method='GET',data,admin=true){return handler.fetch(new Request('https://test'+path,{method,headers:{...(admin?{Authorization:'Bearer test-admin'}:{}),'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env)}
 const created=await request('/admin/licenses','POST',{label:'TEST',hours:24,maxDevices:1,startMode:'first-use',count:2});assert.equal(created.status,201);
 const records=(await created.json()).licenses;assert.equal(records.length,2);const {id,key}=records[0];
 assert.equal(DB.sql.prepare('SELECT expires_at FROM licenses WHERE id=?').get(id).expires_at,null);
 const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 async function proof(pair){const publicKey=Buffer.from(await crypto.subtle.exportKey('raw',pair.publicKey)).toString('base64'),timestamp=Date.now();const signature=Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(await digest(key)+'|'+publicKey+'|'+timestamp))).toString('base64');return {key,publicKey,timestamp,signature};}
 const check=async p=>request('/v1/license/check','POST',await proof(p),false);
 let r=await check(pair);assert.equal(r.status,200);const lease=await r.json();assert.equal(lease.allowed,true);assert.ok(lease.validForSeconds<=60);
 assert.equal((await check(pair)).status,200);
 const other=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);assert.equal((await check(other)).status,403);
 assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM license_devices WHERE license_id=?').get(id).n,1);
 assert.equal((await request('/admin/licenses/'+id+'/pause','POST',{})).status,200);assert.equal((await check(pair)).status,403);
 DB.sql.prepare('UPDATE licenses SET paused_at=paused_at-60000 WHERE id=?').run(id);
 assert.equal((await request('/admin/licenses/'+id+'/resume','POST',{})).status,200);assert.equal((await check(pair)).status,200);
 assert.ok(DB.sql.prepare('SELECT expires_at FROM licenses WHERE id=?').get(id).expires_at>=lease.expiresAt+60000);
 assert.equal((await request('/admin/licenses/'+id+'/reset-devices','POST',{})).status,200);assert.equal((await check(other)).status,200);
 assert.equal((await request('/admin/licenses/'+id+'/revoke','POST',{})).status,200);assert.equal((await check(other)).status,403);
 const history=await (await request('/admin/licenses/'+id+'/history')).json();assert.ok(history.history.some(x=>x.action==='pause'));
 const list=await (await request('/admin/licenses')).json();assert.equal(list.licenses.length,2);assert.equal(JSON.stringify(list).includes(key),false);
 DB.sql.close();
});
test('invalid input and forged proofs cannot create or activate licenses; unlimited and expiry work',async()=>{
 const DB=database(),handler=createHandler(async t=>t==='test-admin'),env={DB,LICENSE_VAULT_KEY:Buffer.alloc(32,7).toString('base64')};
 const call=(path,data,admin=true)=>handler.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json',...(admin?{Authorization:'Bearer test-admin'}:{})},body:JSON.stringify(data)}),env);
 for(const data of [null,[],{label:'x',hours:0,maxDevices:1,startMode:'activation'},{label:'x',hours:24,maxDevices:1,startMode:'activation',count:26}])assert.equal((await call('/admin/licenses',data)).status,400);
 const result=await (await call('/admin/licenses',{label:'Unlimited',hours:24,maxDevices:0,startMode:'creation'})).json();
 for(let i=0;i<2;i++){
  const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),publicKey=Buffer.from(await crypto.subtle.exportKey('raw',pair.publicKey)).toString('base64'),timestamp=Date.now();
  const signature=Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(await digest(result.key)+'|'+publicKey+'|'+timestamp))).toString('base64');
  const proof={key:result.key,publicKey,timestamp,signature};
  assert.equal((await call('/v1/license/check',{...proof,timestamp:timestamp+1},false)).status,403);
  assert.equal((await call('/v1/license/check',proof,false)).status,200);
  if(i===1){DB.sql.prepare('UPDATE licenses SET expires_at=? WHERE id=?').run(Date.now()-1,result.id);assert.equal((await call('/v1/license/check',proof,false)).status,403);}
 }
 assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM license_devices').get().n,2);DB.sql.close();
});

test('permanent deletion requires admin and explicit confirmation, is atomic, and preserves separate audit',async()=>{
 const DB=database(),handler=createHandler(async t=>t==='test-admin'),env={DB,LICENSE_VAULT_KEY:Buffer.alloc(32,7).toString('base64')};
 const request=(path,method='GET',data,auth=true)=>handler.fetch(new Request('https://test'+path,{method,headers:{...(auth?{Authorization:'Bearer test-admin'}:{}),'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);
 const a=await (await request('/admin/licenses','POST',{label:'DELETE ME',hours:24,maxDevices:1,startMode:'activation'})).json();
 const b=await (await request('/admin/licenses','POST',{label:'KEEP ME',hours:24,maxDevices:1,startMode:'activation'})).json();
 const path='/admin/licenses/'+a.id+'/delete';
 assert.equal((await request(path,'POST',{confirm:'ELIMINAR',licenseId:a.id},false)).status,401);
 assert.equal((await request(path,'POST',{confirm:'NO',licenseId:a.id})).status,400);
 assert.equal((await request(path,'POST',{confirm:'ELIMINAR',licenseId:b.id})).status,400);
 assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM licenses').get().n,2);
 assert.equal((await request(path,'POST',{confirm:'ELIMINAR',licenseId:a.id})).status,200);
 assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM licenses').get().n,1);
 assert.equal(DB.sql.prepare('SELECT label FROM licenses').get().label,'KEEP ME');
 assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM license_history WHERE license_id=?').get(a.id).n,0);
 assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM license_deletion_audit WHERE license_id=?').get(a.id).n,1);
 assert.equal((await request(path,'POST',{confirm:'ELIMINAR',licenseId:a.id})).status,404);
 DB.sql.close();
});


test('ADNER_V3_VAULT_INTEGRATION_TEST: crear, recuperar y eliminar key cifrada',async()=>{
 const DB=database();
 const handler=createHandler(async token=>token==='test-admin');
 const env={
  DB,
  LICENSE_VAULT_KEY:Buffer.alloc(32,7).toString('base64')
 };

 const request=(path,method='GET',data,auth=true,environment=env)=>
  handler.fetch(new Request('https://test'+path,{
   method,
   headers:{
    ...(auth?{Authorization:'Bearer test-admin'}:{}),
    'Content-Type':'application/json'
   },
   ...(data?{body:JSON.stringify(data)}:{})
  }),environment);

 const input={
  label:'V3 ENCRYPTED TEST',
  hours:24,
  maxDevices:1,
  startMode:'activation',
  count:1
 };

 // No crear licencias si el secreto falta.
 const noSecret=await request(
  '/admin/licenses','POST',input,true,{DB}
 );
 assert.equal(noSecret.status,503);
 assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM licenses').get().n,0);

 const created=await request('/admin/licenses','POST',input);
 assert.equal(created.status,201);
 const {id,key}=(await created.json()).licenses[0];

 // D1 guarda contenido cifrado, no la key original.
 const row=DB.sql.prepare(
  'SELECT ciphertext,nonce,key_version FROM license_key_vault WHERE license_id=?'
 ).get(id);

 assert.ok(row);
 assert.equal(row.key_version,1);
 assert.equal(row.nonce.length,12);
 assert.equal(
  Buffer.from(row.ciphertext).includes(Buffer.from(key)),
  false
 );

 const path='/admin/licenses/'+id+'/key';

 // No debe revelarse sin autorizacion.
 assert.equal((await request(path,'GET',undefined,false)).status,401);

 // Administrador recupera exactamente la misma key.
 const recovered=await request(path);
 assert.equal(recovered.status,200);
 assert.equal((await recovered.json()).key,key);

 // Una key anterior sin vault no puede recuperarse.
 DB.sql.prepare('DELETE FROM license_key_vault WHERE license_id=?').run(id);
 assert.equal((await request(path)).status,404);

 // Volver a crear otra licencia para probar el borrado completo.
 const second=await request('/admin/licenses','POST',{
  ...input,label:'V3 DELETE TEST'
 });
 assert.equal(second.status,201);
 const other=(await second.json()).licenses[0];

 const deletion=await request(
  '/admin/licenses/'+other.id+'/delete',
  'POST',
  {confirm:'ELIMINAR',licenseId:other.id}
 );
 assert.equal(deletion.status,200);

 assert.equal(
  DB.sql.prepare('SELECT COUNT(*) AS n FROM license_key_vault WHERE license_id=?').get(other.id).n,
  0
 );
 assert.equal(
  DB.sql.prepare('SELECT COUNT(*) AS n FROM license_deletion_audit WHERE license_id=?').get(other.id).n,
  1
 );
 assert.equal(
  (await request('/admin/licenses/'+other.id+'/key')).status,
  404
 );

 DB.sql.close();
});