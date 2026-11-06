const {onRequest}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');const {getAuth}=require('firebase-admin/auth');const {getDatabase}=require('firebase-admin/database');const {getStorage,getDownloadURL}=require('firebase-admin/storage');const crypto=require('node:crypto');const {hash,claim,verifyProof}=require('./policy.cjs');
initializeApp({databaseURL:'https://adner-yt-ios-cloud-default-rtdb.firebaseio.com',storageBucket:process.env.ADNER_STORAGE_BUCKET||'adner-yt-ios-cloud.firebasestorage.app'});
const base='ADNER_LICENSES_PRIVATE',adminUid='OxWCNpO2vRQT0ejIRPFmjU5Ygit2';
const options={region:'us-central1',cors:['http://localhost:8765','http://127.0.0.1:8765','http://localhost:8766','http://127.0.0.1:8766','https://adneryt.github.io'],maxInstances:3,timeoutSeconds:60};
async function admin(req){const text=req.headers.authorization||'';if(!text.startsWith('Bearer '))throw Error('Inicia sesion como administrador');const user=await getAuth().verifyIdToken(text.slice(7),true);if(user.uid!==adminUid)throw Error('Administrador no autorizado');}
exports.adnerAdmin=onRequest(options,async(req,res)=>{
 try{if(req.method!=='POST')return res.status(405).end();await admin(req);const d=req.body||{},db=getDatabase();
 if(d.action==='createLicense'){
  const hours=Number(d.hours),max=Number(d.maxDevices);if(!Number.isFinite(hours)||hours<=0||hours>87600||!Number.isSafeInteger(max)||max<0||max>100000)throw Error('Tiempo o dispositivos no validos');
  const key=crypto.randomBytes(24).toString('base64url'),id=hash(key),now=Date.now(),mode=d.startMode==='first-use'?'first-use':'creation';
  await db.ref(base+'/'+id).set({label:String(d.label||'Licencia').slice(0,80),createdAt:now,durationSeconds:Math.round(hours*3600),startMode:mode,maxDevices:max,revoked:false,...(mode==='creation'?{expiresAt:now+hours*3600000}:{})});return res.json({key,id,message:'Guarda esta clave: no se vuelve a mostrar.'});
 }
 if(d.action==='listLicenses'){const rows=(await db.ref(base).get()).val()||{};return res.json({licenses:Object.entries(rows).map(([id,x])=>({id,label:x.label,expiresAt:x.expiresAt||null,startMode:x.startMode,maxDevices:x.maxDevices,revoked:x.revoked,devices:Object.keys(x.devices||{}).length}))});}
 if(d.action==='revokeLicense'){if(!/^[a-f0-9]{64}$/.test(d.id))throw Error('ID invalido');await db.ref(base+'/'+d.id).update({revoked:true});return res.json({ok:true});}
 if(d.action==='uploadFile'){
  if(typeof d.base64!=='string'||d.base64.length>12*1024*1024)throw Error('Archivo demasiado grande para esta subida (maximo 8 MB por archivo)');
  const bytes=Buffer.from(d.base64,'base64');if(!bytes.length||bytes.length>8*1024*1024)throw Error('Archivo vacio o mayor de 8 MB');
  const name='adner-packages/'+crypto.randomUUID()+'/payload.bin',file=getStorage().bucket().file(name);
  await file.save(bytes,{resumable:false,metadata:{contentType:'application/octet-stream',metadata:{firebaseStorageDownloadTokens:crypto.randomUUID()}}});
  return res.json({url:await getDownloadURL(file),sha256:hash(bytes),size:bytes.length});
 }
 throw Error('Operacion no admitida');
 }catch(e){res.status(400).json({error:e.message});}
});
exports.adnerLicense=onRequest({...options,cors:true},async(req,res)=>{
 try{res.set('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).end();const now=Date.now(),proof=verifyProof(req.body||{},now);let issue='';const result=await getDatabase().ref(base+'/'+proof.license).transaction(current=>{try{return claim(current,proof.device,now)}catch(e){issue=e.message;return;}});
 if(!result.committed)return res.status(403).json({allowed:false,message:issue||'Clave rechazada'});
 const value=result.snapshot.val();res.json({allowed:true,validForSeconds:Math.max(0,Math.min(60,Math.floor((value.expiresAt-now)/1000))),expiresAt:value.expiresAt,device:proof.device});
 }catch(e){res.status(403).json({allowed:false,message:e.message});}
});
