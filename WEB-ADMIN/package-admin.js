const P=window.ADNERPackages,$=id=>document.getElementById(id),api=()=>window.ADNERAdminAPI;
const panel=document.createElement('article');panel.className='panel';panel.id='package-admin';
panel.innerHTML=`<h3>Paquetes HEAD · Holo · Baypas</h3><p class="muted">Archivos gestionados desde este administrador → GitHub Releases → catálogo Firebase → copia de trabajo de ADNER.</p><label class="block-label">ZIP del paquete<input id="package-zip" type="file" accept=".zip,application/zip"></label><p class="hint">Cada holograma necesita su fileinfo propio y una shader adicional con nombre distinto de la original. Ahora puedes subir ZIP normales de Avatar: el administrador crea el manifiesto y hashes automáticamente. Para HOLO deben identificarse fileinfo y shader.</p><div class="fields"><label>Repositorio público de recursos<input id="package-repo" placeholder="usuario/adner-recursos" autocomplete="off"></label><label>Token GitHub de esta operación<input id="package-token" type="password" autocomplete="off" placeholder="Permiso Contents: read and write"></label></div><p class="hint">Usa un repositorio público de recursos: la IPA descarga sin iniciar sesión en GitHub. El token solo se usa durante esta operación; no se guarda en Firebase, el manifiesto ni localStorage. Cada subida crea un Release público nuevo.</p><pre id="package-check" class="codeview">Selecciona un ZIP para validar parejas, rutas y hashes.</pre><div class="actions"><button id="package-validate" type="button">Validar ZIP</button><button id="package-upload" type="button" class="primary" disabled>Subir a GitHub y guardar catálogo</button></div><p id="package-message" class="hint" role="status"></p>`;
$('view-catalog').prepend(panel);let prepared=null;
const guide=document.createElement('section');guide.className='panel';guide.innerHTML=`<h3>Carga automática V4.5 · ZIP directo</h3><p class="hint">Selecciona el tipo y el juego, elige un ZIP y pulsa Validar ZIP. Si el ZIP no incluye adner-package.json, el administrador prepara automáticamente los metadatos. Se respetan las bases de ruta preconfiguradas; no se inventan permisos de iOS.</p><div class="fields"><label>Tipo de paquete<select id="pkg-template-kind"><option value="avatar">Avatar</option><option value="hologram">HOLO</option><option value="bypass">Bypass</option></select></label><label>Zona de avatar<select id="pkg-template-zone"><option value="head">HEAD</option><option value="neck">NECK</option><option value="chest">CHEST</option><option value="body">BODY</option></select></label><label>Juego<select id="pkg-template-game"><option value="com.dts.freefiremax">FF MAX</option><option value="com.dts.freefireth">FF Normal</option></select></label></div><label class="block-label">Shader original protegida (solo HOLO / Bypass)<input id="pkg-protected-shader" placeholder="Nombre real del archivo original"></label><button id="pkg-template-download" type="button">Descargar ejemplo adner-package.json</button><p class="hint">Avatar usa la ruta base ya declarada en HEAD. El campo target es el nombre del archivo dentro de esa base. Si el juego espera otro nombre, se necesita un mapeo verificado. No se crean ni inventan originales de respaldo.</p><p id="pkg-selected" role="status">Ningún ZIP validado todavía.</p>`;
panel.prepend(guide);
$('pkg-template-download').onclick=()=>{
 const kind=$('pkg-template-kind').value,zone=$('pkg-template-zone').value;
 const manifest={schemaVersion:1,id:'adner-'+kind+'-'+(kind==='avatar'?zone:'recurso')+'-v1',name:'ADNER '+kind.toUpperCase(),kind,game:'com.dts.freefiremax',base:'Documents/contentcache/Compulsory/ios/gameassetbundles',...(kind==='avatar'?{targetZone:zone}:{protectedShader:'shader-original.bundle'}),files:kind==='avatar'?[{source:'archivos/recurso.bin',target:'avatar/recurso.bin',mode:'replace',role:'avatar',originalSource:'originales/recurso.bin'}]:[{source:'archivos/fileinfo',target:'fileinfo',mode:'replace',role:'fileinfo',originalSource:'originales/fileinfo'},...(kind==='hologram'?[{source:'archivos/shader-adicional.bundle',target:'shader-adicional.bundle',mode:'add',role:'shader'}]:[])]};
 const blob=new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='adner-package.EJEMPLO.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
const importBox=document.createElement('div');importBox.className='panel';importBox.innerHTML=`<h3>Importar archivos ya publicados</h3><p class="hint">Si la subida directa muestra Failed to fetch, publica los archivos en GitHub Releases y vincúlalos aquí. Selecciona y valida arriba el mismo ZIP. Esta opción lee el Release y guarda el catálogo con tu sesión Firebase; no necesita token para un repositorio público.</p><label>Etiqueta del Release<input id="package-release-tag" placeholder="adner-holo-prueba-02"></label><button id="package-import-release" type="button">Importar Release al catálogo</button><p id="package-import-status" role="status"></p>`;panel.append(importBox);
$('package-import-release').onclick=async()=>{
 const status=$('package-import-status'),a=api(),snapshot=prepared,repo=$('package-repo').value.trim(),tag=$('package-release-tag').value.trim();
 if(!snapshot){status.textContent='Selecciona el ZIP y pulsa Validar ZIP primero.';return}
 if(!a||!a.state.user||a.state.demo){status.textContent='Inicia sesión Firebase con la cuenta administradora.';return}
 if(!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(repo)||repo.includes('..')||!/^[A-Za-z0-9_.~-]+$/.test(tag)||tag.includes('..')){status.textContent='Indica repositorio usuario/nombre y etiqueta válida.';return}
 $('package-import-release').disabled=true;
 try{
  status.textContent='Consultando Release público…';
  const response=await fetch('https://api.github.com/repos/'+repo+'/releases/tags/'+encodeURIComponent(tag),{headers:{Accept:'application/vnd.github+json'}});
  if(!response.ok)throw Error('GitHub respondió '+response.status+' al consultar el Release.');
  const release=await response.json();if(release.draft||release.tag_name!==tag)throw Error('El Release todavía no es público.');
  const resolve=async(source,index)=>{
   const bytes=snapshot.contents.get(source);if(!bytes)throw Error('Falta archivo local: '+source);
   const name=index+'-payload.bin',asset=release.assets.find(x=>x.name===name&&x.state==='uploaded');
   if(!asset||asset.size!==bytes.byteLength)throw Error('Falta el archivo publicado o no coincide su tamaño: '+name);
   const hash=await sha(bytes);if(asset.digest&&asset.digest!=='sha256:'+hash)throw Error('El hash publicado no coincide: '+name);
   const url=new URL(asset.browser_download_url);if(url.origin!=='https://github.com'||!url.pathname.startsWith('/'+repo+'/releases/download/'+tag+'/'))throw Error('URL de archivo rechazada.');
   return{url:url.href,size:bytes.byteLength,sha256:hash};
  };
  const files=[];for(const [i,f] of snapshot.plan.files.entries()){const asset=await resolve(f.source,i*2),baseline=f.originalSource?await resolve(f.originalSource,i*2+1):undefined;files.push({...f,...asset,...(baseline?{baseline}:{})})}
  const plan=P.validate({...snapshot.plan,files},true),record={name:plan.name||plan.id,type:plan.kind,description:'Paquete '+plan.kind+' · '+plan.game+' · archivos vinculados',routeId:'route-packages',enabled:false,url:'',filename:plan.id+'.json',size:files.reduce((n,f)=>n+f.size,0),mime:'application/vnd.adner.package+json',sha256:'',package:plan,updatedAt:new Date().toISOString()};
  await a.state.sdk.set(a.state.sdk.ref(a.state.db,'ADNER_IOS_CLOUD/catalog/'+plan.id),record);
  const old=a.state.items.find(x=>x.id===plan.id);if(old)Object.assign(old,record);else a.state.items.push({id:plan.id,...record});a.render();
  status.textContent='Paquete importado DESACTIVADO. Actívalo y pulsa Publicar versión para enviarlo a la IPA.';
 }catch(e){status.textContent='No se pudo importar: '+e.message}finally{$('package-import-release').disabled=false}
};
for(const field of ['pkg-template-kind','pkg-template-zone','pkg-template-game','pkg-protected-shader'])$(field).addEventListener('change',()=>{prepared=null;$('package-upload').disabled=true;$('package-check').textContent='Configuración cambiada. Pulsa Validar ZIP nuevamente.'});
$('package-zip').onchange=()=>{
 prepared=null;
 $('package-upload').disabled=true;
 $('package-check').textContent='ZIP seleccionado. Validando automáticamente...';
 $('pkg-selected').textContent=$('package-zip').files[0]
  ?'Seleccionado: '+$('package-zip').files[0].name+' (sin subir).'
  :'Ningún ZIP seleccionado.';
 if($('package-zip').files[0])$('package-validate').click();
};
$('package-validate').onclick=async()=>{const f=$('package-zip').files[0];if(!f){$('package-message').textContent='Selecciona un ZIP';return}try{$('package-message').textContent='Validando estructura y descomprimiendo los archivos declarados…';const entries=await P.listZip(f);const hasManifest=entries.some(x=>x.path==='adner-package.json');
 if(hasManifest){prepared=await P.prepareZip(f)}
 else {
  const kind=$('pkg-template-kind').value,zone=$('pkg-template-zone').value,game=$('pkg-template-game').value;
  const base=kind==='avatar'?'Documents/contentcache/Compulsory/ios/gameassetbundles/avatar':'Documents/contentcache/Compulsory/ios/gameassetbundles';
  prepared=await P.autoPrepareZip(f,{kind,zone,game,base,protectedShader:$('pkg-protected-shader').value.trim()});
 }
 $('package-check').textContent=JSON.stringify(prepared.plan,null,2)+(prepared.warning?'\n\nAVISO: '+prepared.warning:'');$('pkg-selected').textContent='Válido: '+prepared.plan.id+' · '+prepared.plan.kind+(prepared.plan.targetZone?' · zona '+prepared.plan.targetZone:'')+' · '+prepared.plan.files.length+' archivo(s). Aún NO publicado.';$('package-upload').disabled=false;$('package-message').textContent=(prepared.automatic?'ZIP preparado automáticamente. Revisa los nombres de destino; aún NO publicado.':'ZIP válido. Aún no se ha subido ni publicado.')}catch(e){prepared=null;$('package-upload').disabled=true;$('pkg-selected').textContent='ZIP rechazado: '+e.message;$('package-message').textContent=e.message}};
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
$('package-upload').onclick=async()=>{
 const a=api();if(!prepared||!a)return;if(!a.state.user||a.state.demo){$('package-message').textContent='Inicia sesión con el administrador autorizado. La demo no sube archivos.';return}
 const snapshot=prepared,repo=$('package-repo').value.trim(),token=$('package-token').value.trim();
 if(!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(repo)||repo.includes('..')||!token){$('package-message').textContent='Indica repositorio usuario/nombre y un token autorizado para ese repositorio.';return}
 if(!confirm('Se creará un Release PÚBLICO en '+repo+' con los archivos de este paquete. Los paquetes sin originalSource dependen del respaldo local del motor 3105; verifica acceso y compatibilidad antes de activar. ¿Continuar?'))return;
 let releaseId=null,recordSaved=false,stage='consultar el repositorio';
 const headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 async function request(path,options={}){const response=await fetch('https://api.github.com/repos/'+repo+path,{...options,headers:{...headers,...options.headers}});if(!response.ok)throw Error('GitHub respondió '+response.status+'. Comprueba el repositorio, permisos del token y límites de la cuenta.');return response.status===204?null:response.json()}
 $('package-upload').disabled=true;$('package-validate').disabled=true;$('package-zip').disabled=true;
 try{
  const metadata=await request('');if(metadata.private)throw Error('El repositorio de recursos debe ser público; no cambies la privacidad del proyecto IPA para esto.');
  stage='crear el Release';const tag='adner-'+snapshot.plan.id+'-'+Date.now();
  const release=await request('/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag_name:tag,name:'ADNER · '+(snapshot.plan.name||snapshot.plan.id),body:'Recursos administrados para '+snapshot.plan.game+'. Archivos no ejecutables.',draft:false,prerelease:true})});releaseId=release.id;
  const upload=async(source,index)=>{const bytes=snapshot.contents.get(source);if(!bytes)throw Error('Archivo del paquete no encontrado');const hash=await sha(bytes),name=String(index)+'-payload.bin';$('package-message').textContent='Subiendo '+source;
   stage='subir '+source+' a uploads.github.com';const url='https://uploads.github.com/repos/'+repo+'/releases/'+release.id+'/assets?name='+encodeURIComponent(name);
   const response=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:bytes});if(!response.ok)throw Error('No se pudo subir a GitHub ('+response.status+').');const asset=await response.json();return{url:asset.browser_download_url,size:bytes.byteLength,sha256:hash};};
  const files=[];for(const [i,f] of snapshot.plan.files.entries()){const asset=await upload(f.source,i*2),baseline=f.originalSource?await upload(f.originalSource,i*2+1):undefined;files.push({...f,...asset,...(baseline?{baseline}:{})})}
  const plan=P.validate({...snapshot.plan,files},true);
  const record={name:plan.name||plan.id,type:plan.kind,description:'Paquete '+plan.kind+' · '+plan.game+' · archivos vinculados',routeId:'route-packages',enabled:false,url:'',filename:plan.id+'.json',size:files.reduce((n,f)=>n+f.size,0),mime:'application/vnd.adner.package+json',sha256:'',package:plan,updatedAt:new Date().toISOString()};
  await a.state.sdk.set(a.state.sdk.ref(a.state.db,'ADNER_IOS_CLOUD/catalog/'+plan.id),record);recordSaved=true;
  const old=a.state.items.find(x=>x.id===plan.id);if(old)Object.assign(old,record);else a.state.items.push({id:plan.id,...record});
  await a.history('Paquete subido a GitHub',plan.id+' · '+plan.files.length+' archivos');a.render();$('package-message').textContent='Release subido y paquete guardado DESACTIVADO. Actívalo y pulsa Publicar versión para enviarlo a la IPA.';
 }catch(e){let cleanup='';if(releaseId&&!recordSaved){try{await request('/releases/'+releaseId,{method:'DELETE'})}catch{cleanup=' El Release parcial no se pudo retirar; revísalo en GitHub.'}}$('package-message').textContent='No se completó la operación al '+stage+': '+e.message+cleanup+(e instanceof TypeError?' Puede ser un bloqueo de red o CORS. Usa Importar archivos ya publicados.':'');
 }finally{$('package-token').value='';$('package-upload').disabled=!prepared;$('package-validate').disabled=false;$('package-zip').disabled=false}
};

// HEAD test preset: uses the authenticated administrator session, never embedded credentials.
const headBox=document.createElement('div');headBox.className='panel';
headBox.innerHTML='<h3>HEAD · Prueba 01</h3><p class="hint">Seleccion de cabeza en verde; activar y restablecer con el boton rojo. HOLO tiene su propio control. Destino: Documents/contentcache/Compulsory/ios/gameassetbundles/avatar.</p><button type="button" id="head-test-publish">Añadir HEAD de prueba y publicar en IPA</button><p id="head-test-status" role="status"></p>';
panel.prepend(headBox);
$('head-test-publish').onclick=async()=>{
 const a=api(),status=$('head-test-status'),button=$('head-test-publish');
 if(!a?.state.user||a.state.demo){status.textContent='Inicia sesion con Firebase como administrador para guardar y publicar HEAD.';return}
 button.disabled=true;
 try{
  status.textContent='Verificando recursos HEAD publicados…';
  const response=await fetch('./head-prueba-01.json',{cache:'no-store'});if(!response.ok)throw Error('No se encontro el paquete HEAD preparado.');
  const plan=P.validate(await response.json(),true);
  if(plan.id!=='head-adneryt-prueba-01'||plan.targetZone!=='head'||plan.kind!=='avatar')throw Error('Identidad del paquete no valida.');
  const rel=await fetch('https://api.github.com/repos/adneryt/ADNER-YT-IOS-CLOUD/releases/tags/adner-head-prueba-01');
  if(!rel.ok)throw Error('Los archivos HEAD todavia se estan publicando. Intenta de nuevo cuando termine GitHub Actions.');
  const release=await rel.json();if(release.draft)throw Error('Release HEAD pendiente.');
  for(const [i,file] of plan.files.entries()){
   for(const [name,asset] of [[i*2+'-payload.bin',file],[i*2+1+'-payload.bin',file.baseline]]){
    if(!asset)continue;
    const published=release.assets.find(x=>x.name===name&&x.state==='uploaded');
    if(!published||published.size!==asset.size||published.digest!=='sha256:'+asset.sha256||published.browser_download_url!==asset.url)throw Error('No coincide el recurso publicado: '+name);
   }
  }
  const item={id:plan.id,name:plan.name,type:'avatar',targetZone:'head',description:'HEAD de prueba: seleccion y boton rojo; original respaldado por 3105.',enabled:true,package:plan};
  const record={...item,routeId:'route-packages',url:'',filename:plan.id+'.json',size:plan.files.reduce((n,f)=>n+f.size,0),mime:'application/vnd.adner.package+json',sha256:'',updatedAt:new Date().toISOString()};delete record.id;
  const sdk=a.state.sdk,db=a.state.db;
  await sdk.set(sdk.ref(db,'ADNER_IOS_CLOUD/catalog/'+plan.id),record);
  const result=await sdk.runTransaction(sdk.ref(db,'ADNER_IOS_CLOUD/public/production'),current=>{
   const m=current?.payload?JSON.parse(current.payload):{schemaVersion:1,channel:'production',version:'0.0.0',status:'active',items:[]};
   if(m.schemaVersion!==1||m.channel!=='production'||!Array.isArray(m.items)||m.status!=='active')throw Error('El canal esta en mantenimiento o es incompatible. HEAD se guardo en catalogo.');
   m.items=m.items.filter(x=>x.id!==plan.id);m.items.push(item);if(m.items.length>50)throw Error('Catalogo lleno.');
   const v=/^(\d+)\.(\d+)\.(\d+)$/.exec(m.version||'');if(v)m.version=v[1]+'.'+v[2]+'.'+(Number(v[3])+1);
   m.publishedAt=new Date().toISOString();const payload=JSON.stringify(m);if(payload.length>900000)throw Error('Catalogo demasiado grande.');
   return {...current,payload,version:m.version,status:m.status,itemCount:m.items.length,updatedAt:m.publishedAt};
  });
  if(!result.committed)throw Error('No se pudo publicar HEAD.');
  const old=a.state.items.find(x=>x.id===plan.id);if(old)Object.assign(old,record);else a.state.items.push({id:plan.id,...record});a.render();
  status.textContent='HEAD guardado y publicado. En la IPA pulsa Sincronizar, selecciona HEAD y usa el boton rojo. HOLO permanece independiente.';
 }catch(e){status.textContent='No se completo: '+e.message}finally{button.disabled=false}
};
