import {firebaseConfig,adminUid} from './firebase-config.js';
'use strict';
const $=id=>document.getElementById(id);
const presetRoutes=[
{"id": "map-reviews", "name": "Revisiones de partidas", "kind": "reference", "path": "Documents/BRMatchReview", "system": true},{"id": "map-replays", "name": "Repeticiones y avatar histórico", "kind": "reference", "path": "Documents/MReplays", "system": true},{"id": "map-heatmap", "name": "Actividad y mapas de calor", "kind": "reference", "path": "Documents/HeatMap", "system": true},{"id": "map-reports", "name": "Cola de reportes", "kind": "reference", "path": "Documents/reportnew.db", "system": true},{"id": "map-avatars", "name": "Recursos opcionales de avatar", "kind": "reference", "path": "Documents/contentcache/Optional/ios/optionalavatarres", "system": true},{"id": "map-resources", "name": "Recursos obligatorios", "kind": "reference", "path": "Documents/contentcache/Compulsory/ios/gameassetbundles", "system": true},{"id": "map-optional", "name": "Recursos opcionales", "kind": "reference", "path": "Documents/contentcache/Optional/ios", "system": true},{"id": "map-icons", "name": "Iconos e imágenes en caché", "kind": "reference", "path": "Documents/ImageCache/CDNICON", "system": true},{"id": "map-album", "name": "Álbum local", "kind": "reference", "path": "Documents/album", "system": true},{"id": "map-records", "name": "Grabaciones locales", "kind": "reference", "path": "Documents/record", "system": true},{"id": "map-prefs", "name": "Preferencias del juego", "kind": "reference", "path": "Library/Preferences/com.dts.freefiremax.plist", "system": true},{"id": "map-shared", "name": "Grupo compartido del juego", "kind": "reference", "path": "AppGroups/group.freefire", "system": true},{"id": "map-voice", "name": "Registro de voz", "kind": "reference", "path": "Documents/ffrtc_log.txt", "system": true},{"id": "map-session", "name": "Sesión del juego", "kind": "reference", "path": "Documents/beetalk_session.db", "system": true},{"id": "map-events", "name": "Eventos de Garena", "kind": "reference", "path": "Documents/garena", "system": true},{"id": "map-bundle", "name": "Paquete de la aplicación", "kind": "reference", "path": "Payload/FreeFireMAX.app", "system": true},{"id": "map-3105-apps", "name": "3105 · Contenedores de apps", "kind": "reference", "path": "/var/mobile/Containers/Data/Application", "system": true},{"id": "map-3105-system", "name": "3105 · Datos de sistema", "kind": "reference", "path": "/var/mobile/Containers/Data/System", "system": true},{"id": "map-3105-cache", "name": "3105 · Caché móvil", "kind": "reference", "path": "/var/mobile/Library/Caches", "system": true},
 {id:'route-packages',name:'Paquetes transaccionales ADNER',kind:'app',path:'Documents/ADNER/Resources/packages',system:true},
 {id:'route-avatar',name:'Avatar ADNER · local',kind:'app',path:'Documents/ADNER/Resources/avatar',system:true},
 {id:'route-hologram',name:'Holograma ADNER · local',kind:'app',path:'Documents/ADNER/Resources/hologram',system:true},
 {id:'route-shared',name:'Archivos ADNER · local',kind:'app',path:'Documents/ADNER/Resources/shared',system:true},
 ...['FF NORMAL','FF MAX'].flatMap((game,i)=>{const id=i===0?'normal':'max';return [
  {id:'ref-'+id+'-avatar',name:game+' · Avatar',kind:'reference',path:'Documents/contentcache/Optional/ios/optionalavatarres',system:true},
  {id:'ref-'+id+'-holo',name:game+' · Holograma',kind:'reference',path:'Documents/contentcache/Compulsory/ios/gameassetbundles',system:true}
 ];}),
 {id:'ref-optional',name:'Avatar · Optional',kind:'reference',path:'Documents/contentcache/Optional/ios',system:true},
 {id:'ref-compulsory',name:'Holograma · Compulsory',kind:'reference',path:'Documents/contentcache/Compulsory/ios',system:true}
];
const baseTemplates=['normal','max'].flatMap((id,i)=>{
 const game=i===0?'FF NORMAL':'FF MAX';
 return [
  ...['Avatar base','Avatar ropa','Avatar armas','Avatar personaje'].map((name,j)=>({id:'base-'+id+'-avatar-'+j,name:game+' · '+name,type:'avatar',routeId:'ref-'+id+'-avatar'})),
  ...['Holograma base','Holograma rojo','Holograma celeste','Holograma morado','Holograma bordes'].map((name,j)=>({id:'base-'+id+'-holo-'+j,name:game+' · '+name,type:'hologram',routeId:'ref-'+id+'-holo'}))
 ];
});
const maxFileBytes=30*1024*1024;
const allowedExt=new Set(['png','jpg','jpeg','webp','json','zip','bin','dat','bundle']);
const state={sdk:null,app:null,auth:null,db:null,storage:null,user:null,demo:false,items:[],routes:[],history:[],published:null,editId:null,view:'overview',busy:false};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(2)} MB`;
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const configured=()=>firebaseConfig.projectId&&firebaseConfig.databaseURL&&firebaseConfig.apiKey&&!firebaseConfig.apiKey.startsWith('REEMPLAZAR')&&firebaseConfig.appId&&!firebaseConfig.appId.startsWith('REEMPLAZAR');
const base='ADNER_IOS_CLOUD';
const dbPath=(part='')=>base+(part?'/'+part:'');
// Solo se aceptan enlaces directos a assets de un Release etiquetado y público.
const releaseOK=x=>typeof x==='string'&&/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases\/download\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(x)&&!x.includes('..');
const toast=(message)=>{const el=$('toast');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,4300)};
const pathOK=p=>typeof p==='string'&&p.length<185&&/^(Documents\/ADNER\/Resources|Library\/Caches\/ADNER\/Resources)\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(p)&&!p.split('/').includes('..');
const allRoutes=()=>[...presetRoutes,...state.routes.filter(x=>!presetRoutes.some(y=>x.id===y.id))];
const appRoutes=()=>allRoutes().filter(x=>(x.kind==='app'&&pathOK(x.path))||x.kind==='reference');
const routeById=id=>allRoutes().find(x=>x.id===id);
function setBusy(v){state.busy=v;$('save-resource').disabled=v;$('publish-btn').disabled=v;$('login-btn').disabled=v;}
function noticeMode(){const badge=$('mode-badge');badge.classList.toggle('live',!!state.user&&!state.demo);badge.textContent=state.demo?'DEMO LOCAL':state.user?'FIREBASE ACTIVO':'SIN CONEXIÓN';$('auth-dot').classList.toggle('ok',!!state.user||state.demo);$('auth-status').textContent=state.demo?'Vista previa sin publicar':state.user?`Admin: ${state.user.email}`:'Firebase sin configurar';$('logout-btn').hidden=!state.user&&!state.demo;$('auth-gate').hidden=!!state.user||state.demo;$('workspace').hidden=!state.user&&!state.demo;$('setup-project').textContent=esc(firebaseConfig.projectId);$('setup-user').textContent=state.demo?'Demo local':state.user?.email??'—';}
function showView(name){state.view=name;document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==`view-${name}`);document.querySelectorAll('#nav button').forEach(el=>el.classList.toggle('active',el.dataset.view===name));const titles={overview:'Centro de control',catalog:'Biblioteca de recursos',routes:'Rutas de instalación',pipeline:'Publicación online',history:'Actividad',setup:'Configuración'};$('page-title').textContent=titles[name]??'Panel';render();}
function uiEvents(){document.querySelectorAll('#nav button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.go)));$('overview-add').onclick=$('add-resource').onclick=()=>openResource();$('seed-resources').onclick=seedBases;$('add-route').onclick=()=>{if(state.busy)return;$('route-form').reset();$('route-dialog').showModal()};document.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>(x.closest('dialog')?.close()));$('demo-btn').onclick=()=>{state.demo=true;state.items=[{id:'demo-avatar',name:'Avatar de muestra',type:'avatar',description:'Demostración local, sin archivos publicados',routeId:'route-avatar',size:0,sha256:'',url:'',filename:'ejemplo.png',enabled:true}];state.history=[{action:'Demo local abierta',createdAt:new Date().toISOString()}];noticeMode();showView('overview');toast('Vista previa: no se está escribiendo en Firebase')};$('logout-btn').onclick=async()=>{if(state.demo){state.demo=false;state.items=[];state.history=[];state.published=null;noticeMode();return}await state.sdk.signOut(state.auth)};$('refresh-btn').onclick=async()=>{if(state.demo){toast('Demo local: no hay servidor conectado');return}await refreshData()};$('reload-history').onclick=refreshData;$('resource-form').addEventListener('submit',saveResource);$('route-form').addEventListener('submit',saveRoute);$('resource-file').onchange=async()=>{const f=$('resource-file').files?.[0];if(!f)return;if(f.size>maxFileBytes){toast('Este archivo supera 30 MB');return}if(!crypto.subtle){toast('Necesitas HTTPS para calcular SHA-256');return}const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');$('resource-sha').value=hash;$('resource-size').value=f.size;$('resource-file-details').textContent=`Hash calculado localmente: ${f.name} · ${fmt(f.size)}. No se ha subido a ningún servidor.`};$('catalog-search').oninput=renderCatalog;$('catalog-filter').onchange=renderCatalog;$('resource-type').onchange=()=>{const suggested=$('resource-type').value==='avatar'?'route-avatar':$('resource-type').value==='hologram'?'route-hologram':'route-shared';$('resource-route').value=suggested};$('catalog-list').addEventListener('click',catalogAction);$('routes-list').addEventListener('click',routeAction);$('publish-btn').onclick=publish;$('export-manifest').onclick=exportManifest;$('login-btn').onclick=login;$('login-password').onkeydown=e=>{if(e.key==='Enter')login()};}
async function initFirebase(){
 if(!configured()){$('login-note').textContent='Añade apiKey y appId en firebase-config.js (Firebase → Tus apps → Web). El UID administrador y RTDB ya vienen indicados.';return}
 try{
  const v='11.10.0';
  const [a,b,c]=await Promise.all([import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`),import(`https://www.gstatic.com/firebasejs/${v}/firebase-database.js`)]);
  state.sdk={...a,...b,...c};state.app=a.initializeApp(firebaseConfig);state.auth=b.getAuth(state.app);state.db=c.getDatabase(state.app,firebaseConfig.databaseURL);
  await b.setPersistence(state.auth,b.browserLocalPersistence);
  b.onAuthStateChanged(state.auth,async user=>{
   if(!user){state.user=null;state.items=[];state.routes=[];state.history=[];state.published=null;noticeMode();return}
   // Comprobación visual; las REGLAS del servidor tienen autoridad final.
   if(user.uid!==adminUid){await b.signOut(state.auth);toast('Este correo no coincide con el UID administrador autorizado.');return}
   state.user=user;state.demo=false;noticeMode();await refreshData();
  });
  $('login-note').textContent='Conectado a Authentication + Realtime Database. Solo el UID administrador puede publicar.';
 }catch(e){$('login-note').textContent='No se pudo iniciar Firebase: '+e.message;toast('Error de configuración')}
}
async function login(){if(!state.auth){toast('Primero configura Firebase y recarga la página');return}const email=$('login-email').value.trim(),password=$('login-password').value;if(!email||!password){toast('Escribe el correo y la contraseña');return}setBusy(true);try{await state.sdk.signInWithEmailAndPassword(state.auth,email,password);$('login-password').value=''}catch(e){toast('No se pudo iniciar sesión: '+e.code)}finally{setBusy(false)}}
async function refreshData(){
 if(!state.user)return;
 try{
  const s=state.sdk,db=state.db;
  const [cat,rou,his,pub]=await Promise.all(['catalog','routes','history','public/production'].map(p=>s.get(s.ref(db,dbPath(p)))));
  const records=snap=>Object.entries(snap.val()||{}).map(([id,record])=>({id,...record}));
  state.items=records(cat);state.routes=records(rou);
  state.history=records(his).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,70);
  state.published=pub.val()||null;
  render();toast('Catálogo de Realtime Database actualizado');
 }catch(e){toast('Error de lectura RTDB: '+e.message)}
}
function render(){if(!state.demo&&!state.user)return;const n=buildManifest().items.length;$('metric-total').textContent=state.items.length;$('metric-active').textContent=n;$('metric-routes').textContent=allRoutes().length;$('metric-version').textContent=state.published?.version??'—';$('metric-release').textContent=state.published?.updatedAt?new Date(state.published.updatedAt).toLocaleString('es'):'Sin publicar';$('channel-state').textContent=state.published?.status==='maintenance'?'MANTENIMIENTO':state.published?'PUBLICADO':'SIN PUBLICAR';$('channel-heading').textContent=state.demo?'Demostración':state.published?'Manifiesto de producción':'Pendiente de publicar';$('channel-description').textContent=state.published?'La IPA puede consultar la última versión pública.':'Todavía no hay una versión online publicada.';$('publish-count').textContent=`${n} recursos activos`;if(state.published?.version)$('release-version').value=state.published.version;renderCatalog();renderRoutes();renderHistory();renderManifest();}
function renderCatalog(){const q=$('catalog-search').value.toLowerCase(),type=$('catalog-filter').value;const items=state.items.filter(x=>(type==='all'||x.type===type)&&[x.name,x.description,routeById(x.routeId)?.path].join(' ').toLowerCase().includes(q));$('catalog-list').innerHTML=items.length?items.map(x=>{const img=x.url&&['image/png','image/jpeg','image/webp'].includes(x.mime)?`<img src="${esc(x.url)}" loading="lazy" alt="" referrerpolicy="no-referrer"/>`:x.type==='avatar'?'◉':x.type==='hologram'?'◇':'▣';return `<article class="res-card"><div class="res-top"><div class="res-thumb">${img}</div><div><div class="res-title">${esc(x.name)}</div><span class="tag ${x.enabled?'on':'off'}">${!x.url?'BASE SIN ARCHIVO':routeById(x.routeId)?.kind==='reference'?'SOLO REFERENCIA':x.enabled?'ACTIVO':'PAUSADO'}</span></div></div><p class="muted">${esc(x.description||'Sin descripción')}</p><div class="res-details"><span>Tipo: ${esc(x.type)} · ${fmt(x.size||0)}</span><span>Ruta: <code>${esc(routeById(x.routeId)?.path||'Ruta no disponible')}</code></span><span>SHA-256: <code>${esc(x.sha256?x.sha256.slice(0,18)+'…':'Sin archivo')}</code></span></div><div class="res-actions"><button data-action="edit" data-id="${esc(x.id)}">Editar</button><button data-action="toggle" data-id="${esc(x.id)}">${x.enabled?'Pausar':'Activar'}</button><button data-action="remove" data-id="${esc(x.id)}">Eliminar</button></div></article>`}).join(''):'<div class="empty">No hay recursos. Pulsa «Nuevo recurso» para cargar un avatar, holograma o archivo.</div>'}
function renderRoutes(){
 $('routes-list').innerHTML=allRoutes().map(x=>`<article class="route-card"><div class="panel-title"><h3>${esc(x.name)}</h3><span class="tag ${x.kind==='app'?'on':'off'}">${x.kind==='app'?'IPA':'REFERENCIA'}</span></div><code>${esc(x.path)}</code><p class="muted">${x.kind==='app'?'Destino dentro de ADNER.':'Ruta documental. No permite escribir en archivos privados de juegos.'}</p>${x.kind==='reference'?`<button data-route-action="use" data-id="${esc(x.id)}">Crear opción desde esta ruta</button>`:x.system?'<span class="tag">RUTA DEL SISTEMA</span>':`<button data-route-action="remove" data-id="${esc(x.id)}">Eliminar ruta</button>`}</article>`).join('');
 $('resource-route').innerHTML=appRoutes().map(x=>`<option value="${esc(x.id)}">${x.kind==='reference'?'[REFERENCIA]':'[ADNER]'} ${esc(x.name)} — ${esc(x.path)}</option>`).join('');
}
function renderHistory(){const html=state.history.slice(0,70).map(x=>`<div><span>${esc(x.action??'Acción')} <small>${esc(x.detail??'')}</small></span><small>${esc(String(x.createdAt??'').replace('T',' ').slice(0,19))}</small></div>`).join('')||'<div>Sin acciones registradas.</div>';$('history-list').innerHTML=html;$('activity-short').innerHTML=state.history.length?state.history.slice(0,4).map(x=>`<div>${esc(x.action)} <small>${esc(String(x.createdAt??'').slice(0,10))}</small></div>`).join(''):'<div>Sin cambios todavía.</div>'}
function buildManifest(){const items=state.items.filter(x=>x.enabled&&releaseOK(x.url)&&Number.isSafeInteger(x.size)&&x.size>0&&x.size<=maxFileBytes&&/^[a-f0-9]{64}$/i.test(x.sha256)&&routeById(x.routeId)?.kind==='app'&&pathOK(routeById(x.routeId).path)).slice(0,50).map(x=>({id:x.id,name:x.name,type:x.type,description:x.description||'',filename:x.filename,mime:x.mime||'application/octet-stream',size:x.size,sha256:x.sha256,url:x.url,destination:routeById(x.routeId).path,enabled:true}));const packages=state.items.filter(x=>x.enabled&&x.package).filter(x=>{try{window.ADNERPackages.validate(x.package,true);return x.id===x.package.id}catch{return false}}).map(x=>({id:x.id,name:x.name,type:x.type,description:x.description||'',enabled:true,package:x.package}));if(items.length+packages.length>50)throw Error('Máximo 50 recursos y paquetes combinados');items.push(...packages);return {schemaVersion:1,channel:'production',version:$('release-version').value.trim()||'1.0.0',status:$('release-state').value,notes:$('release-notes').value.trim(),publishedAt:new Date().toISOString(),items}}
function renderManifest(){const manifest=buildManifest();$('manifest-preview').textContent=JSON.stringify({...manifest,items:manifest.items.map(x=>({...x,url:x.url.length>100?x.url.slice(0,97)+'...':x.url}))},null,2)}
async function seedBases(){
 if(state.busy)return;
 const missing=baseTemplates.filter(t=>!state.items.some(x=>x.id===t.id));
 if(!missing.length){toast('Todas las bases ya existen. Puedes editarlas o crear otras.');return}
 if(!confirm(`¿Agregar ${missing.length} bases de avatar y holograma? Se guardarán desactivadas y no se enviarán a la IPA.`))return;
 const now=new Date().toISOString();const records=missing.map(t=>({...t,description:'Base editable · solo referencia · pendiente de archivo',enabled:false,url:'',filename:'',size:0,mime:'application/octet-stream',sha256:'',updatedAt:now}));
 setBusy(true);
 try{
  if(!state.demo){const updates={};records.forEach(({id,...data})=>updates[dbPath('catalog/'+id)]=data);await state.sdk.update(state.sdk.ref(state.db),updates)}
  state.items.push(...records);await history('Bases agregadas',records.length+' opciones');render();toast(records.length+' bases guardadas para editar.');
 }catch(e){toast('Error al guardar bases: '+e.message)}finally{setBusy(false)}
}
function openResource(id=null){
 if(state.items.some(x=>x.id===id&&x.package)){toast('Para actualizar un paquete, sube su ZIP con el mismo ID desde Paquetes HEAD · Holo · Baypas.');return}
 state.editId=id;const item=state.items.find(x=>x.id===id);
 $('resource-form').reset();renderRoutes();$('resource-title').textContent=item?'Editar recurso GitHub':'Agregar recurso de GitHub Releases';
 $('resource-name').value=item?.name??'';$('resource-type').value=item?.type??'avatar';
 $('resource-route').value=item?.routeId??'route-avatar';$('resource-desc').value=item?.description??'';
 $('resource-enabled').checked=item?.enabled===true;
 $('resource-url').value=item?.url??'';$('resource-sha').value=item?.sha256??'';$('resource-size').value=item?.size??'';
 $('resource-file-details').textContent=item?.filename?`Publicado: ${item.filename} · ${fmt(item.size||0)}. Puedes verificar la nueva versión con un archivo local.`:'Opcional: selecciona el mismo archivo del Release para calcular el SHA-256, sin subirlo al servidor.';
 $('resource-dialog').showModal();
}
async function history(action,detail=''){
 const entry={action,detail,createdAt:new Date().toISOString()};
 state.history.unshift(entry);
 if(state.demo)return;
 try{const s=state.sdk;const point=s.push(s.ref(state.db,dbPath('history')));await s.set(point,entry)}
 catch(e){console.warn('Historial no guardado:',e.message)}
}
async function saveResource(e){
 e.preventDefault();if(state.busy)return;
 const old=state.items.find(x=>x.id===state.editId);
 const f=$('resource-file').files?.[0],name=$('resource-name').value.trim(),type=$('resource-type').value,routeId=$('resource-route').value,route=routeById(routeId),url=$('resource-url').value.trim(),rawSha=$('resource-sha').value.trim().toLowerCase(),rawSize=$('resource-size').value.trim();
 if(!name||name.length>70||!route||!(route.kind==='reference'||(route.kind==='app'&&pathOK(route.path)))){toast('Nombre o ruta inválidos');return}
 const draft=!url&&!rawSha&&!rawSize&&!f;let fileName='',size=0;
 if(!draft){
  if(!releaseOK(url)){toast('Para adjuntar un archivo, usa un enlace público de GitHub Releases');return}
  fileName=url.split('/').pop();const ext=fileName.split('.').pop().toLowerCase();
  if(!allowedExt.has(ext)||fileName.length>100){toast('Extensión o archivo no permitido');return}
  size=Number(rawSize);if(!Number.isSafeInteger(size)||size<=0||size>maxFileBytes){toast('Tamaño inválido (máximo 30 MB)');return}
  if(!/^[a-f0-9]{64}$/.test(rawSha)){toast('SHA-256 inválido');return}
  if(f){if(f.size!==size||f.name!==fileName){toast('El archivo local no coincide');return}
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');if(sha!==rawSha){toast('SHA-256 no coincide');return}}
 }
 const update={name,type,routeId,description:$('resource-desc').value.trim(),enabled:$('resource-enabled').checked,url:draft?'':url,filename:fileName,size,mime:draft?'application/octet-stream':extToMime(f,fileName),sha256:draft?'':rawSha,updatedAt:new Date().toISOString()};
 setBusy(true);
 try{const id=old?.id??uid();if(!state.demo)await state.sdk.set(state.sdk.ref(state.db,dbPath('catalog/'+id)),update);
  if(old)Object.assign(old,update);else state.items.unshift({id,...update});await history(old?'Base/recurso actualizado':'Nueva base/recurso',name);$('resource-dialog').close();render();toast(draft?'Base guardada sin archivo; no se publicará en la IPA.':route.kind==='reference'?'Referencia guardada; no se ejecuta en la IPA.':'Archivo guardado; publica una versión para sincronizar.');
 }catch(error){toast('Error al guardar: '+error.message)}finally{setBusy(false)}
}
function extToMime(f,filename){const x=filename.split('.').pop().toLowerCase();return {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',json:'application/json',zip:'application/zip',bin:'application/octet-stream',dat:'application/octet-stream',bundle:'application/octet-stream'}[x]||'application/octet-stream'}
async function catalogAction(e){const el=e.target.closest('[data-action]');if(!el)return;const id=el.dataset.id,item=state.items.find(x=>x.id===id);if(!item)return;if(el.dataset.action==='edit'){openResource(id);return}if(el.dataset.action==='remove'&&!confirm(`¿Eliminar «${item.name}» del catálogo? Debes publicar después para retirarlo de la IPA. Los archivos ya descargados no se borran de otros teléfonos.`))return;try{if(el.dataset.action==='toggle'){if(!state.demo)await state.sdk.update(state.sdk.ref(state.db,dbPath('catalog/'+id)),{enabled:!item.enabled});item.enabled=!item.enabled;await history(item.enabled?'Recurso activado':'Recurso pausado',item.name)}else{if(!state.demo)await state.sdk.remove(state.sdk.ref(state.db,dbPath('catalog/'+id)));state.items=state.items.filter(x=>x.id!==id);await history('Recurso retirado',item.name)}render();toast('Cambio guardado. Pulsa Publicar para aplicarlo online.')}catch(err){toast(err.message)}}
async function saveRoute(e){e.preventDefault();const name=$('route-name').value.trim(),kind=$('route-kind').value,path=$('route-path').value.trim();if(!name||name.length>55||!path||path.length>220){toast('Completa los datos de la ruta');return}if(kind==='app'&&!pathOK(path)){toast('Destino IPA fuera del sandbox ADNER o ruta no válida');return}if(kind==='reference'&&(/\p{C}/u.test(path)||path.includes('..'))){toast('Referencia no válida');return}if(allRoutes().some(x=>x.path===path)){toast('La ruta ya existe');return}try{const id=uid(),route={id,name,kind,path};if(!state.demo)await state.sdk.set(state.sdk.ref(state.db,dbPath('routes/'+id)),{name,kind,path});state.routes.push(route);await history('Ruta agregada',name);$('route-dialog').close();render();toast('Ruta agregada al gestor')}catch(e){toast(e.message)}}
async function routeAction(e){
 const b=e.target.closest('[data-route-action]');if(!b)return;
 const id=b.dataset.id,r=routeById(id);if(!r)return;
 if(b.dataset.routeAction==='use'){
  openResource();$('resource-route').value=id;$('resource-type').value=/avatar/i.test(r.name)?'avatar':'hologram';$('resource-name').value=r.name+' · Nueva opción';$('resource-desc').value='Base documental pendiente de archivo';return;
 }
 if(r.system)return;
 if(state.items.some(x=>x.routeId===id)){toast('Esta ruta tiene recursos asignados.');return}
 if(!confirm('¿Eliminar la ruta «'+r.name+'»?'))return;
 try{if(!state.demo)await state.sdk.remove(state.sdk.ref(state.db,dbPath('routes/'+id)));state.routes=state.routes.filter(x=>x.id!==id);await history('Ruta eliminada',r.name);render()}catch(e){toast(e.message)}
}
async function publish(){if(state.busy)return;const m=buildManifest();if(!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(m.version)){toast('Usa una versión válida, por ejemplo 1.0.1');return}if(state.items.filter(x=>x.enabled&&x.url&&x.sha256).length>50){toast('Máximo 50 recursos activos');return}if(state.items.some(x=>x.enabled&&x.url&&x.sha256&&routeById(x.routeId)?.kind==='app'&&!m.items.some(y=>y.id===x.id))){toast('Hay recursos activos con rutas o datos inválidos. Revísalos antes de publicar.');return}if(state.demo){toast('Demo local: descarga el manifiesto, pero no puedes publicarlo sin Firebase');return}if(!confirm(`¿Publicar versión ${m.version} con ${m.items.length} recursos en producción?`))return;setBusy(true);try{const payload=JSON.stringify(m);if(payload.length>900000)throw new Error('El manifiesto supera el tamaño permitido');await state.sdk.set(state.sdk.ref(state.db,dbPath('public/production')),{payload,version:m.version,status:m.status,updatedAt:new Date().toISOString(),itemCount:m.items.length});state.published={version:m.version,status:m.status,updatedAt:new Date()};await history('Versión publicada',m.version+' · '+m.items.length+' archivos');render();toast('Versión '+m.version+' publicada correctamente. La IPA podrá consultarla.')}catch(e){toast('No se pudo publicar: '+e.message)}finally{setBusy(false)}}
function exportManifest(){const data=JSON.stringify(buildManifest(),null,2),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ADNER-YT-IOS-manifest-'+($('release-version').value||'draft')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
window.ADNERAdminAPI={state,render,history,buildManifest};
uiEvents();noticeMode();showView('overview');initFirebase();
