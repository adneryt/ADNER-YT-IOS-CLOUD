(function(root){'use strict';
const maxFile=30*1024*1024,maxTotal=60*1024*1024;
function assert(ok,text){if(!ok)throw Error(text)}
function safePath(p){return typeof p==='string'&&p.length<=220&&/^[A-Za-z0-9_.~-]+(?:\/[A-Za-z0-9_.~-]+)*$/.test(p)&&p.split('/').every(x=>x!=='.'&&x!=='..'&&!x.startsWith('.'))}
function safeZipPath(p){return typeof p==='string'&&p.length<=240&&!/[\\\x00-\x1f]/.test(p)&&!p.startsWith('/')&&!p.startsWith(' ')&&!p.endsWith(' ')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'&&!x.startsWith('.'))}
function validate(p,remote=false){
 assert(p&&p.schemaVersion===1,'Versión de paquete no admitida');assert(/^[A-Za-z0-9_-]{1,70}$/.test(p.id),'ID de paquete inválido');assert(p.name===undefined||(typeof p.name==='string'&&p.name.length<=80),'Nombre de paquete demasiado largo');
 assert(['avatar','hologram','bypass'].includes(p.kind),'Tipo de paquete inválido');assert(['com.dts.freefiremax','com.dts.freefireth'].includes(p.game),'Juego no admitido en esta versión');
 assert(safePath(p.base)&&p.base.startsWith('Documents/contentcache/'),'La base debe estar en Documents/contentcache');
 assert(Array.isArray(p.files)&&p.files.length>0&&p.files.length<=32,'Paquete vacío o con más de 32 archivos');
 let total=0;const targets=new Set();for(const f of p.files){assert(f&&['replace','add'].includes(f.mode),'Modo de archivo inválido');assert(safePath(f.source)&&safePath(f.target),'Ruta de archivo no válida');assert(!targets.has(f.target.toLowerCase()),'Destino duplicado');targets.add(f.target.toLowerCase());assert(['avatar','fileinfo','shader','resource'].includes(f.role),'Rol inválido');if(p.protectedShader)assert(f.target.toLowerCase()!==p.protectedShader.toLowerCase(),'La shader original está protegida');if(f.role==='shader')assert(f.mode==='add','La shader adicional solo se puede añadir');
  if(f.originalSource)assert(safePath(f.originalSource)&&f.mode==='replace','Origen del original inválido');
  if(remote){assert(Number.isSafeInteger(f.size)&&f.size>0&&f.size<=maxFile,'Tamaño inválido');assert(/^[a-f0-9]{64}$/i.test(f.sha256),'Hash requerido');assert(typeof f.url==='string'&&/^https:\/\//.test(f.url),'URL HTTPS requerida');total+=f.size;if(f.baseline){assert(f.mode==='replace'&&Number.isSafeInteger(f.baseline.size)&&f.baseline.size>0&&f.baseline.size<=maxFile&&/^[a-f0-9]{64}$/i.test(f.baseline.sha256)&&/^https:\/\//.test(f.baseline.url),'Original de respaldo inválido');total+=f.baseline.size;}}
 }
 assert(total<=maxTotal,'El paquete supera 60 MB');
 const infos=p.files.filter(x=>x.role==='fileinfo');if(p.kind==='hologram'||p.kind==='bypass'){assert(infos.length===1&&infos[0].target==='fileinfo'&&infos[0].mode==='replace','Cada holograma/Baypas necesita un fileinfo propio');assert(typeof p.protectedShader==='string'&&safePath(p.protectedShader),'Indica el nombre exacto de la shader original');if(p.kind==='hologram')assert(p.files.some(f=>f.role==='shader'&&f.mode==='add'),'Falta la shader adicional del holograma');}
 return p;
}
async function listZip(file){const start=Math.max(0,file.size-65557),tail=new DataView(await file.slice(start).arrayBuffer());let end=-1;for(let i=tail.byteLength-22;i>=0;i--)if(tail.getUint32(i,true)===0x06054b50&&i+22+tail.getUint16(i+20,true)===tail.byteLength){end=i;break}assert(end>=0,'ZIP inválido');const n=tail.getUint16(end+10,true),len=tail.getUint32(end+12,true),off=tail.getUint32(end+16,true);assert(!tail.getUint16(end+4,true)&&!tail.getUint16(end+6,true)&&n<65535&&len<20*1024*1024&&off+len<=file.size,'ZIP64/multipartes no admitido');assert(n<=1000,'Máximo 1000 entradas');const d=new DataView(await file.slice(off,off+len).arrayBuffer()),b=new Uint8Array(d.buffer),dec=new TextDecoder(),entries=[];let p=0;for(let i=0;i<n;i++){assert(p+46<=d.byteLength&&d.getUint32(p,true)===0x02014b50,'Índice ZIP incompleto');const nl=d.getUint16(p+28,true),el=d.getUint16(p+30,true),cl=d.getUint16(p+32,true);assert(p+46+nl+el+cl<=d.byteLength,'Entrada ZIP incompleta');const path=dec.decode(b.subarray(p+46,p+46+nl));const directory=path.endsWith('/');assert(safeZipPath(directory?path.slice(0,-1):path),'Ruta ZIP rechazada');const unix=d.getUint32(p+38,true)>>>16;assert((unix&0xf000)!==0xa000,'No se admiten enlaces simbólicos');entries.push({path,size:d.getUint32(p+24,true),compressed:d.getUint32(p+20,true),method:d.getUint16(p+10,true),flags:d.getUint16(p+8,true),crc:d.getUint32(p+16,true),offset:d.getUint32(p+42,true),directory});p+=46+nl+el+cl}assert(new Set(entries.map(e=>e.path)).size===entries.length,'Entradas ZIP duplicadas');return entries;}
function crc32(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
async function unzip(file,e){assert(!(e.flags&1)&&e.size<=maxFile&&e.compressed<=maxFile,'Entrada cifrada o demasiado grande');const h=new DataView(await file.slice(e.offset,e.offset+30).arrayBuffer());assert(h.byteLength===30&&h.getUint32(0,true)===0x04034b50,'Cabecera ZIP inválida');const start=e.offset+30+h.getUint16(26,true)+h.getUint16(28,true);assert(start+e.compressed<=file.size,'Entrada truncada');let data=new Uint8Array(await file.slice(start,start+e.compressed).arrayBuffer());if(e.method===8){let ds;try{ds=new DecompressionStream('deflate-raw')}catch{throw Error('Usa Chrome o Edge actualizado para procesar este ZIP')};const reader=new Blob([data]).stream().pipeThrough(ds).getReader(),chunks=[];let total=0;try{while(true){const x=await reader.read();if(x.done)break;total+=x.value.length;if(total>maxFile||total>e.size){await reader.cancel();throw Error('ZIP excede el tamaño declarado')}chunks.push(x.value)}}finally{reader.releaseLock()}data=new Uint8Array(total);let pos=0;for(const c of chunks){data.set(c,pos);pos+=c.length}}else assert(e.method===0,'Compresión no admitida');assert(data.length===e.size&&crc32(data)===e.crc,'Archivo corrupto: CRC o tamaño incorrecto');return data;}
async function prepareZip(file){const entries=await listZip(file),manifest=entries.find(e=>e.path==='adner-package.json');assert(manifest&&manifest.size<=50000,'El ZIP debe contener adner-package.json en su raíz');const p=validate(JSON.parse(new TextDecoder().decode(await unzip(file,manifest))));const contents=new Map();let total=0;for(const f of p.files){for(const source of [f.source,f.originalSource].filter(Boolean)){if(contents.has(source))continue;const e=entries.find(x=>x.path===source&&!x.directory);assert(e,'Falta '+source);total+=e.size;assert(total<=maxTotal,'Paquete demasiado grande');contents.set(source,await unzip(file,e));}}return{plan:p,contents};}
// V4.5: imports a plain ZIP (no manifest) without editing original binary payloads.
// File paths are mapped only to the selected and preconfigured package base.
async function autoPrepareZip(file,settings={}){
 const kind=settings.kind, zone=settings.zone, game=settings.game;
 assert(['avatar','hologram','bypass'].includes(kind),'Selecciona Avatar, HOLO o Bypass');
 assert(['com.dts.freefiremax','com.dts.freefireth'].includes(game),'Selecciona FF MAX o FF Normal');
 if(kind==='avatar')assert(['head','neck','chest','body'].includes(zone),'Selecciona la zona de Avatar');
 const entries=(await listZip(file)).filter(e=>!e.directory);
 assert(entries.length>0&&entries.length<=32,'El ZIP debe contener de 1 a 32 archivos');
 assert(!entries.some(e=>e.path==='adner-package.json'),'Este ZIP ya tiene manifiesto: usa validación normal');
 const total=entries.reduce((n,e)=>n+e.size,0);
 assert(total<=maxTotal,'El ZIP supera 60 MB');
 const names=new Set(),contents=new Map(),files=[];
 const isFileinfo=s=>/(^|[-_.])fileinfo([-_.]|$)/i.test(s);
 const isShader=s=>/shader/i.test(s)&&(/\.bundle$/i.test(s)||/shader/i.test(s));
 if(kind==='hologram'){
  assert(entries.filter(e=>isFileinfo(e.path.split('/').pop())).length===1,'HOLO requiere un archivo fileinfo identificable');
  assert(entries.some(e=>isShader(e.path.split('/').pop())),'HOLO requiere una shader adicional identificable');
  assert(safePath(settings.protectedShader||''),'Indica el nombre real de la shader original protegida');
 }
 if(kind==='bypass')assert(entries.filter(e=>isFileinfo(e.path.split('/').pop())).length===1,'Bypass requiere un fileinfo identificable');
 for(const [i,e] of entries.entries()){
  const basename=e.path.split('/').pop();
  // These are real basenames from the ZIP, not guessed destination names.
  assert(safePath(basename),'Nombre de archivo no compatible: '+basename);
  assert(!names.has(basename.toLowerCase()),'Dos archivos con el mismo nombre: '+basename);
  names.add(basename.toLowerCase());
  const source='payload/'+i+'-'+basename;
  const data=await unzip(file,e);contents.set(source,data);
  let role='avatar',mode='replace',target=basename;
  if(kind!=='avatar'){
   role=isFileinfo(basename)?'fileinfo':(isShader(basename)?'shader':'resource');
   mode=role==='shader'?'add':'replace';
   if(role==='fileinfo')target='fileinfo';
  }
  files.push({source,target,mode,role});
 }
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const base=settings.base || 'Documents/contentcache/Compulsory/ios/gameassetbundles/avatar';
 const plan={schemaVersion:1,id:'adner-'+kind+'-'+(kind==='avatar'?zone:'resource')+'-'+digest.slice(0,12),name:'ADNER '+kind.toUpperCase()+' '+(kind==='avatar'?zone.toUpperCase():file.name.replace(/\.zip$/i,'').slice(0,30)),kind,game,base,...(kind==='avatar'?{targetZone:zone}:{protectedShader:settings.protectedShader}),files};
 validate(plan);
 return {plan,contents,automatic:true,sourceFile:file.name,warning:'Rutas de destino tomadas de los nombres reales del ZIP. Verifica que coincidan con el recurso esperado en la IPA. No se aportaron originales de respaldo.'};
}
function restorePlan(j,current){assert(j&&j.status==='active','No hay paquete activo');for(const r of j.records){const now=current.get(r.target);assert(now&&now.hash===r.installedHash,'Archivo cambiado después de activar: '+r.target);if(r.hadOriginal)assert(r.backupHash,'Falta el hash del respaldo');}return j.records.map(r=>({target:r.target,action:r.hadOriginal?'restore':'remove'}));}
const api={validate,safePath,listZip,unzip,prepareZip,autoPrepareZip,restorePlan,maxFile,maxTotal};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ADNERPackages=api;
})(typeof window!=='undefined'?window:globalThis);
