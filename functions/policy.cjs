const crypto=require('node:crypto');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function claim(current,device,now){
 if(!current||current.revoked)throw Error('Clave inexistente o revocada');
 const next=structuredClone(current);next.devices=next.devices||{};
 if(next.startMode==='first-use'&&!next.activatedAt){next.activatedAt=now;next.expiresAt=now+next.durationSeconds*1000;}
 if(!Number.isFinite(next.expiresAt)||now>=next.expiresAt)throw Error('Clave vencida');
 if(!next.devices[device]&&next.maxDevices>0&&Object.keys(next.devices).length>=next.maxDevices)throw Error('Limite de dispositivos alcanzado');
 next.devices[device]={firstSeen:next.devices[device]?.firstSeen||now,lastSeen:now};return next;
}
function verifyProof(d,now){
 if(typeof d.key!=='string'||!/^[A-Za-z0-9_-]{32,100}$/.test(d.key)||typeof d.publicKey!=='string'||typeof d.signature!=='string'||!Number.isSafeInteger(d.timestamp)||Math.abs(now-d.timestamp)>300000)throw Error('Solicitud invalida o reloj desajustado');
 const raw=Buffer.from(d.publicKey,'base64');if(raw.length!==32)throw Error('Identidad invalida');
 const key=crypto.createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),raw]),format:'der',type:'spki'});
 const msg=hash(d.key)+'|'+d.publicKey+'|'+d.timestamp;
 if(!crypto.verify(null,Buffer.from(msg),key,Buffer.from(d.signature,'base64')))throw Error('Firma de dispositivo invalida');
 return {license:hash(d.key),device:hash(raw)};
}
module.exports={hash,claim,verifyProof};
