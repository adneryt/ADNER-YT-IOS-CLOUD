(()=>{'use strict';
 let configuration;
 async function timeout(promise,milliseconds,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),milliseconds)})])}finally{clearTimeout(timer)}}
 async function base(){
  if(!configuration)configuration=timeout(fetch(new URL('license-service-config.json',document.baseURI),{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('No se pudo leer la configuracion de licencias');return r.json()}),10000,'No responde la configuracion local').catch(e=>{configuration=null;throw e});
  const c=await configuration,local=['localhost','127.0.0.1'].includes(location.hostname),raw=local?c.localBaseUrl:c.enabled?c.baseUrl:'';
  if(!raw)throw Error('Cloudflare preparado; falta desplegar y configurar su URL. La IPA sigue sin bloqueo.');
  const u=new URL(raw);
  if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||(!local&&(u.protocol!=='https:'||u.port||!u.hostname.startsWith('adner-yt-ios-license.')||!u.hostname.endsWith('.workers.dev')))||(local&&!['localhost','127.0.0.1'].includes(u.hostname)))throw Error('URL del servicio no permitida');
  return u.origin;
 }
 async function request(path,method='GET',data){
  const a=window.ADNERAdminAPI;if(!a?.state.user||a.state.demo)throw Error('Inicia sesion como administrador');
  const url=await base(),token=await timeout(a.state.user.getIdToken(),10000,'Firebase no pudo renovar la sesion. Cierra sesion y vuelve a entrar.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  let response;try{response=await fetch(url+path,{method,cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})})}catch{throw Error('No se pudo conectar con Cloudflare. Comprueba el Worker y CORS.');}finally{clearTimeout(timer)}
  let r;try{r=await response.json()}catch{throw Error('Respuesta del servicio no valida');}
  if(!response.ok)throw Error(r.error||r.message||'Operacion rechazada');return r;
 }
 window.ADNERLicenseService={
  async call(d){
   if(d.action==='checkAdmin')return request('/admin/session');
   if(d.action==='listLicenses'){const r=await request('/admin/licenses');return {licenses:r.licenses.map(x=>({...x,expiresAt:x.expires_at,maxDevices:x.max_devices,startMode:x.start_mode,revoked:x.status==='revoked'}))};}
   if(d.action==='createLicense')return request('/admin/licenses','POST',{label:d.label,hours:d.hours,maxDevices:d.maxDevices,startMode:d.startMode,count:d.count||1});
   const actions={revokeLicense:'revoke',pauseLicense:'pause',resumeLicense:'resume',resetDevices:'reset-devices',licenseHistory:'history',deleteLicense:'delete'};
   if(!actions[d.action]||!/^[a-f0-9]{64}$/.test(d.id))throw Error('Operacion de licencia no valida');
   return request('/admin/licenses/'+d.id+'/'+actions[d.action],d.action==='licenseHistory'?'GET':'POST',d.action==='licenseHistory'?undefined:d.action==='deleteLicense'?{confirm:d.confirm,licenseId:d.id}:{});
  }
 };
})();
