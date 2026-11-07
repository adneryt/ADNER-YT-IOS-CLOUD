// Isolated local D1 database; never uses or removes the existing Wrangler database.
import {getPlatformProxy} from 'wrangler';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHandler} from '../src/index.js';
import {digest} from '../src/license-api.js';
const proxy=await getPlatformProxy({configPath:new URL('../wrangler.json',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),persist:{path:new URL('../.wrangler/isolated-integration',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')}});
try{
 const schema=await readFile(new URL('../migrations/0001_licenses.sql',import.meta.url),'utf8');
 await proxy.env.DB.batch(schema.split(';').map(x=>x.trim()).filter(Boolean).map(x=>proxy.env.DB.prepare(x)));
 const handler=createHandler(async token=>token==='local-test-session');
 async function call(path,data,admin=true){return handler.fetch(new Request('https://test'+path,{method:data?'POST':'GET',headers:{...(admin?{Authorization:'Bearer local-test-session'}:{}),'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),proxy.env)}
 const created=await call('/admin/licenses',{label:'D1 isolated smoke',hours:24,maxDevices:1,startMode:'activation',count:2});assert.equal(created.status,201);
 const {licenses}=await created.json(),{id,key}=licenses[0];
 const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),publicKey=Buffer.from(await crypto.subtle.exportKey('raw',pair.publicKey)).toString('base64');
 const proof=async()=>{const timestamp=Date.now(),signature=Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(await digest(key)+'|'+publicKey+'|'+timestamp))).toString('base64');return {key,publicKey,timestamp,signature};};
 assert.equal((await call('/v1/license/check',await proof(),false)).status,200);
 assert.equal((await call('/v1/license/check',await proof(),false)).status,200);
 assert.equal((await call('/admin/licenses/'+id+'/pause',{})).status,200);
 assert.equal((await call('/v1/license/check',await proof(),false)).status,403);
 assert.equal((await call('/admin/licenses/'+id+'/resume',{})).status,200);
 assert.equal((await call('/admin/licenses/'+id+'/reset-devices',{})).status,200);
 assert.equal((await call('/v1/license/check',await proof(),false)).status,200);
 assert.equal((await call('/admin/licenses/'+id+'/revoke',{})).status,200);
 assert.equal((await call('/v1/license/check',await proof(),false)).status,403);
 const history=await (await call('/admin/licenses/'+id+'/history')).json();assert.ok(history.history.some(x=>x.action==='pause'));
 console.log('PASS real local D1: atomic batch, first activation, renewal, pause/resume, device reset, revocation, history. Existing databases untouched.');
}finally{await proxy.dispose();}
