(()=>{'use strict';
 const advanced=document.getElementById('package-admin');if(advanced){const box=document.createElement('details'),caption=document.createElement('summary');caption.textContent='Opciones avanzadas de GitHub (opcional)';advanced.before(box);box.append(caption,advanced)}
 const css=document.createElement('style');css.textContent='.adner-services-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.adner-services-form>h3,.adner-services-form>p,.adner-services-form>button,.adner-services-form>pre,.adner-services-form>div{grid-column:1/-1;margin:0}.adner-services-form label{display:grid;gap:7px;font-size:13px}.adner-services-form input,.adner-services-form select{box-sizing:border-box;width:100%;min-height:44px;padding:10px;border-radius:10px;background:#080f1d;border:1px solid #394158;color:#eef4ff}.adner-services-form [hidden]{display:none!important}@media(max-width:650px){.adner-services-form{grid-template-columns:1fr}}';document.head.append(css);
 const api=()=>window.ADNERAdminAPI,endpoint='https://us-central1-adner-yt-ios-cloud.cloudfunctions.net/adnerAdmin';
 async function call(body){if(body.action!=='uploadFile'){if(!window.ADNERLicenseService)throw Error('Cliente Cloudflare no disponible');const user=api()?.state.user,revision=sessionRevision;const result=await window.ADNERLicenseService.call(body);if(revision!==sessionRevision||api()?.state.user!==user||!user||api().state.demo)throw Error('La sesion cambio. Vuelve a iniciar sesion.');return result}const a=api();if(!a?.state.user||a.state.demo)throw Error('Inicia sesion como administrador');const token=await a.state.user.getIdToken();let response;try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});}catch{throw Error('La subida de ZIP conserva su servicio separado. Cloudflare licencias no implementa uploadFile; utiliza GitHub avanzado mientras se habilita la subida.')}let result;try{result=await response.json()}catch{throw Error('El servicio no esta desplegado o no esta disponible')};if(!response.ok)throw Error(result.error||'Operacion rechazada');return result}
 const licenses=document.createElement('article');licenses.className='panel adner-services-form';licenses.innerHTML='<h3>Claves de acceso y vencimiento</h3><label>Nombre<input id="key-label" maxlength="80" placeholder="Cliente o grupo"></label><label>Duracion (horas)<input id="key-hours" type="number" min="1" max="8760" value="24"></label><label>Dispositivos (0 = ilimitados)<input id="key-devices" type="number" min="0" max="100000" value="1"></label><label>Inicio<select id="key-start"><option value="first-use">Primera activacion</option><option value="creation">Desde la creacion</option></select></label><label>Cantidad de claves (1 a 25)<input id="key-count" type="number" min="1" max="25" value="1"></label><button id="key-create">Crear claves</button><button id="key-check-admin">Comprobar sesion Cloudflare</button><button id="key-refresh">Ver claves</button><p id="key-state" role="status">Licencias Cloudflare D1. Comprueba la sesion para verificar la conexion. La subida de ZIP es independiente.</p><section id="key-created" hidden class="adner-key-created"><h3>Keys recien creadas</h3><p>Copia o descarga las keys recien creadas antes de salir. La recuperacion posterior requiere almacenamiento cifrado V3.</p><pre id="key-once" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><div class="adner-key-actions"><button type="button" id="key-copy">Copiar todas</button><button type="button" id="key-download">Descargar TXT</button><button type="button" id="key-discard">Descartar de pantalla</button></div></section><div id="key-list"></div>';
 document.getElementById('view-setup').append(licenses);
 const $=id=>document.getElementById(id);
 let freshKeys=[];
 let sessionRevision=0;
 window.addEventListener('adner-auth-cleared',()=>{sessionRevision++;clearFreshKeys();$('key-list').replaceChildren();$('key-state').textContent='Sesion cerrada. Keys retiradas de pantalla.'});
 const keyText=()=>freshKeys.map(x=>x.label+': '+x.key).join('\n');
 function showFreshKeys(records){freshKeys=records.map(({label,key})=>({label,key}));$('key-once').textContent=keyText();$('key-created').hidden=!freshKeys.length;}
 function clearFreshKeys(){freshKeys=[];$('key-once').textContent='';$('key-created').hidden=true;}
 function downloadKeys(){if(!freshKeys.length)return;const blob=new Blob([keyText()+'\n'],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ADNER_KEYS_'+new Date().toISOString().slice(0,10)+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('key-state').textContent='TXT generado. Guarda el archivo en un lugar seguro.';}
 $('key-copy').onclick=async()=>{if(!freshKeys.length)return;try{await navigator.clipboard.writeText(keyText());$('key-state').textContent='Keys copiadas al portapapeles.'}catch{$('key-state').textContent='No se pudo copiar automaticamente. Selecciona el texto y copialo manualmente.'}};
 $('key-download').onclick=downloadKeys;
 $('key-discard').onclick=()=>{if(freshKeys.length&&!confirm('¿Descartar las claves de la pantalla? Podras recuperarlas desde la lista si fueron creadas en V3.'))return;clearFreshKeys();$('key-state').textContent='Claves retiradas de pantalla.'};
 window.addEventListener('beforeunload',event=>{if(freshKeys.length){event.preventDefault();event.returnValue='';}});
 const newStyle=document.createElement('style');newStyle.textContent='.adner-key-created{grid-column:1/-1;border:1px solid #49627d;border-radius:14px;padding:16px;background:#101b2d}.adner-key-created[hidden]{display:none!important}.adner-key-created pre{overflow:auto;max-height:260px;user-select:text}.adner-key-actions{display:flex;flex-wrap:wrap;gap:8px}.adner-license-row{padding:12px 0;border-bottom:1px solid #343c51}.adner-license-row button{margin:3px}.adner-danger{color:#ffb4b4!important;border-color:#c94e63!important}.adner-license-row p{overflow-wrap:anywhere}';document.head.append(newStyle);

 async function list(){const {licenses}=await call({action:'listLicenses'});$('key-list').replaceChildren();for(const x of licenses){
 const row=document.createElement('article'),info=document.createElement('p');row.className='adner-license-row';info.textContent=x.label+' - '+x.devices+'/'+(x.maxDevices||'ilimitados')+' instalaciones - '+x.status+' - '+(x.expiresAt?new Date(x.expiresAt).toLocaleString():'Inicia en primera activacion');row.append(info);
 for(const [label,action]of [['Pausar','pauseLicense'],['Reanudar','resumeLicense'],['Revocar','revokeLicense'],['Reset dispositivos','resetDevices'],['Historial','licenseHistory']]){
 const button=document.createElement('button');button.textContent=label;button.disabled=(action==='pauseLicense'&&x.status!=='active')||(action==='resumeLicense'&&x.status!=='paused')||(action==='revokeLicense'&&x.revoked);button.onclick=async()=>{if(action!=='licenseHistory'&&!confirm(label+': '+x.label+'?'))return;button.disabled=true;try{const r=await call({action,id:x.id});if(action==='licenseHistory'){$('key-state').textContent=r.history.map(h=>new Date(h.created_at).toLocaleString()+' '+h.action).join(' | ')||'Sin historial';button.disabled=false}else{await list();$('key-state').textContent='Operacion completada'}}catch(e){$('key-state').textContent=e.message;button.disabled=false}};row.append(button);
 }
 const vault=document.createElement('div');
 vault.className='adner-key-actions';

 const preview=document.createElement('pre');
 preview.hidden=true;
 preview.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;padding:12px;border:1px solid #394158;border-radius:10px;background:#080f1d;color:#eef4ff';

 const mostrar=document.createElement('button');
 mostrar.type='button';
 mostrar.textContent='Mostrar key';

 const copiar=document.createElement('button');
 copiar.type='button';
 copiar.textContent='Copiar key';

 const descargar=document.createElement('button');
 descargar.type='button';
 descargar.textContent='Descargar TXT';

 const recuperar=async()=>{
  const revision=sessionRevision;
  const result=await call({action:'getLicenseKey',id:x.id});
  if(revision!==sessionRevision||!api()?.state.user||api().state.demo)throw Error('La sesion cambio. Vuelve a iniciar sesion.');
  if(typeof result.key!=='string'||!/^ADNER-[A-F0-9]{48}$/.test(result.key)){
   throw Error('Respuesta de key invalida');
  }
  return result.key;
 };

 const ejecutar=async(button,operation)=>{
  button.disabled=true;
  try{
   await operation();
  }catch(e){
   $('key-state').textContent='No se pudo recuperar la key de '+x.label+': '+e.message+'. Si es una key antigua sin copia cifrada, usa el TXT que guardaste al crearla.';
  }finally{
   button.disabled=false;
  }
 };

 mostrar.onclick=()=>ejecutar(mostrar,async()=>{
  if(!preview.hidden){
   preview.textContent='';
   preview.hidden=true;
   mostrar.textContent='Mostrar key';
   return;
  }
  const key=await recuperar();
  preview.textContent=key;
  preview.hidden=false;
  mostrar.textContent='Ocultar key';
  $('key-state').textContent='Key recuperada. Ocultala cuando termines.';
 });

 copiar.onclick=()=>ejecutar(copiar,async()=>{
  const key=await recuperar();
  await navigator.clipboard.writeText(key);
  $('key-state').textContent='Key de '+x.label+' copiada.';
 });

 descargar.onclick=()=>ejecutar(descargar,async()=>{
  const key=await recuperar();
  const nombre=x.label.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,50);
  const blob=new Blob([x.label+': '+key+'\n'],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  try{
   const a=document.createElement('a');
   a.href=url;
   a.download='ADNER_KEY_'+nombre+'.txt';
   document.body.append(a);
   a.click();
   a.remove();
  }finally{
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('key-state').textContent='TXT de '+x.label+' preparado.';
 });

 vault.append(mostrar,copiar,descargar);
 row.append(vault,preview);

 const del=document.createElement('button');del.type='button';del.className='adner-danger';del.textContent='Eliminar definitivamente';del.title='Elimina la licencia y sus instalaciones e historial; conserva auditoria de borrado';
 del.onclick=async()=>{
  if(!confirm('Eliminar DEFINITIVAMENTE la licencia '+x.label+'? No se podra recuperar la key ni su historial.'))return;
  const typed=prompt('Para confirmar la eliminacion de '+x.label+', escribe ELIMINAR:');
  if(typed!=='ELIMINAR'){$('key-state').textContent='Eliminacion cancelada.';return;}
  del.disabled=true;
  try{await call({action:'deleteLicense',id:x.id,confirm:'ELIMINAR'});await list();$('key-state').textContent='Licencia eliminada definitivamente de D1. Auditoria independiente conservada.'}
  catch(e){$('key-state').textContent='No se elimino: '+e.message;del.disabled=false;}
 };row.append(del);$('key-list').append(row);
 }}
 $('key-check-admin').onclick=async()=>{$('key-state').textContent='Verificando sesion Firebase con Cloudflare...';$('key-check-admin').disabled=true;try{await call({action:'checkAdmin'});$('key-state').textContent='Sesion Firebase verificada por Cloudflare. UID administrador autorizado.'}catch(e){$('key-state').textContent=e.message}finally{$('key-check-admin').disabled=false}};
 $('key-refresh').onclick=()=>list().catch(e=>$('key-state').textContent=e.message);
 $('key-create').onclick=async()=>{try{$('key-create').disabled=true;const x=await call({action:'createLicense',label:$('key-label').value,hours:Number($('key-hours').value),maxDevices:Number($('key-devices').value),startMode:$('key-start').value,count:Number($('key-count').value)});if(freshKeys.length&&!confirm('Hay keys anteriores sin descartar. ¿Reemplazar la lista visible con las nuevas?')){const merged=[...freshKeys,...(x.licenses||[x])];showFreshKeys(merged)}else showFreshKeys(x.licenses||[x]);$('key-state').textContent='Keys creadas. Copialas o descarga el TXT antes de cerrar esta sesion.';await list()}catch(e){$('key-state').textContent=e.message}finally{$('key-create').disabled=false}};
 const upload=document.createElement('article');upload.className='panel adner-services-form';upload.innerHTML='<h3>Subida simple · ZIP + destino</h3><p>Sin token de GitHub ni codigo de manifiesto. El original real se respalda en el iPhone.</p><label>ZIP<input id="simple-zip" type="file" accept=".zip"></label><label>Destino<select id="simple-kind"><option value="avatar">Avatar · Compulsory/ios/gameassetbundles/avatar</option><option value="hologram">HOLO + fileinfo · Optional/ios</option></select></label><label>Juego<select id="simple-game"><option value="com.dts.freefiremax">Free Fire MAX</option><option value="com.dts.freefireth">Free Fire</option></select></label><label>Zona avatar<select id="simple-zone"><option value="head">HEAD</option><option value="neck">NECK</option><option value="chest">CHEST</option></select></label><label>Shader original protegida (solo HOLO)<input id="simple-protected" placeholder="Se completa con el HOLO publicado"></label><button id="simple-upload">Subir y publicar</button><p id="simple-state" role="status">Avatar: un assetindexer. HOLO: un fileinfo y una shader adicional con otro nombre. Maximo 8 MB por archivo en este servicio.</p>';
 document.getElementById('view-catalog').prepend(upload);
 $('simple-kind').onchange=()=>{$('simple-protected').closest('label').hidden=$('simple-kind').value!=='hologram';$('simple-zone').closest('label').hidden=$('simple-kind').value!=='avatar';const holo=api()?.state.items.find(x=>x.package?.kind==='hologram'&&x.package.protectedShader);if(holo&&!$('simple-protected').value)$('simple-protected').value=holo.package.protectedShader;};
 $('simple-kind').onchange();
 async function publish(plan){const a=api(),sdk=a.state.sdk;const item={id:plan.id,name:plan.name,type:plan.kind,enabled:true,package:plan,...(plan.targetZone?{targetZone:plan.targetZone}:{})};const record={...item,routeId:'route-packages',url:'',filename:plan.id+'.json',size:plan.files.reduce((n,x)=>n+x.size,0),mime:'application/vnd.adner.package+json',sha256:'',updatedAt:new Date().toISOString()};delete record.id;await sdk.set(sdk.ref(a.state.db,'ADNER_IOS_CLOUD/catalog/'+plan.id),record);const result=await sdk.runTransaction(sdk.ref(a.state.db,'ADNER_IOS_CLOUD/public/production'),current=>{if(!current?.payload)throw Error('Publica primero el canal desde Pipeline');const m=JSON.parse(current.payload);if(m.status!=='active')throw Error('El canal esta en mantenimiento');m.items=m.items.filter(x=>x.id!==plan.id);m.items.push(item);if(m.items.length>50)throw Error('Limite de 50 paquetes');m.publishedAt=new Date().toISOString();const payload=JSON.stringify(m);if(payload.length>900000)throw Error('Catalogo demasiado grande');return {...current,payload,itemCount:m.items.length,updatedAt:m.publishedAt}});if(!result.committed)throw Error('No se publico el catalogo');const old=a.state.items.find(x=>x.id===plan.id);if(old)Object.assign(old,record);else a.state.items.push({id:plan.id,...record});a.render()}
 $('simple-upload').onclick=async()=>{
 const button=$('simple-upload'),status=$('simple-state'),P=window.ADNERPackages;
 try{button.disabled=true;if(!api()?.state.user||api().state.demo)throw Error('Inicia sesion como administrador');const zip=$('simple-zip').files[0];if(!zip)throw Error('Selecciona el ZIP');const kind=$('simple-kind').value,zone=$('simple-zone').value;status.textContent='Revisando ZIP…';const entries=await P.listZip(zip),files=entries.filter(x=>!x.directory&&!/^(original|__MACOSX)\//i.test(x.path));const basename=x=>x.path.split('/').pop();let plan,contents=new Map();
 if(entries.some(x=>x.path==='adner-package.json')){const prepared=await P.prepareZip(zip);plan=prepared.plan;contents=prepared.contents;}
 else{
  const chosen=kind==='avatar'?files.filter(x=>basename(x).startsWith('assetindexer.')):[...files.filter(x=>basename(x)==='fileinfo'),...files.filter(x=>basename(x).startsWith('shaders.'))];
  if(kind==='avatar'&&chosen.length!==1)throw Error('Avatar necesita un unico assetindexer modificado');if(kind==='hologram'&&(chosen.length!==2||chosen.filter(x=>basename(x)==='fileinfo').length!==1))throw Error('HOLO necesita exactamente fileinfo y una shader modificada');
  plan={schemaVersion:1,id:kind+'-'+crypto.randomUUID().replaceAll('-',''),name:zip.name.replace(/\.zip$/i,'').slice(0,80),kind,game:$('simple-game').value,base:kind==='avatar'?'Documents/contentcache/Compulsory/ios/gameassetbundles/avatar':'Documents/contentcache/Optional/ios',...(kind==='avatar'?{targetZone:zone}:{protectedShader:$('simple-protected').value.trim()}),files:[]};
  for(const x of chosen){const name=basename(x),role=kind==='avatar'?'avatar':name==='fileinfo'?'fileinfo':'shader';const target=role==='shader'?'gameassetbundles/'+name:name;contents.set(x.path,await P.unzip(zip,x));plan.files.push({source:x.path,target,mode:role==='shader'?'add':'replace',role})}
  P.validate(plan);
 }
 if(plan.kind!==kind||plan.game!==$('simple-game').value)throw Error('El ZIP no corresponde al tipo o juego seleccionado');if(kind==='avatar')plan.targetZone=zone;
 const uploadOne=async source=>{const bytes=contents.get(source);if(!bytes||bytes.length>8*1024*1024)throw Error('Falta archivo o supera 8 MB: '+source);let raw='';for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.subarray(i,i+32768));return call({action:'uploadFile',base64:btoa(raw)})};
 const remote=[];for(const [i,f]of plan.files.entries()){status.textContent='Subiendo '+(i+1)+'/'+plan.files.length+'…';remote.push({...f,...await uploadOne(f.source),...(f.originalSource?{baseline:await uploadOne(f.originalSource)}:{})})}
 plan={...plan,files:remote};P.validate(plan,true);status.textContent='Guardando catalogo…';await publish(plan);status.textContent='Publicado. Sincroniza la nueva IPA. Archivos del juego no modificados desde la web.';
 }catch(e){status.textContent='No se completo: '+e.message}finally{button.disabled=false}
 };
})();
