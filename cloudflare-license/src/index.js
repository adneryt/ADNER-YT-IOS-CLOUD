const json=(data,status=200)=>new Response(JSON.stringify(data),{
 status,
 headers:{
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store",
  "X-Content-Type-Options":"nosniff"
 }
});

const digest=async value=>{
 const bytes=new TextEncoder().encode(value);
 const hash=await crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(hash)]
  .map(x=>x.toString(16).padStart(2,"0")).join("");
};

const randomKey=()=>{
 const bytes=crypto.getRandomValues(new Uint8Array(24));
 return "ADNER-"+[...bytes]
  .map(x=>x.toString(16).padStart(2,"0"))
  .join("").toUpperCase();
};

async function authorized(request,env){
 const token=request.headers.get("Authorization")||"";
 if(!env.ADMIN_SECRET||!token.startsWith("Bearer "))return false;
 const value=token.slice(7);
 if(value.length!==env.ADMIN_SECRET.length)return false;
 const a=await digest(value),b=await digest(env.ADMIN_SECRET);
 return a===b;
}

export default {
 async fetch(request,env){
  const url=new URL(request.url);

  if(url.pathname==="/health"&&request.method==="GET"){
   try{
    const result=await env.DB.prepare(
     "SELECT COUNT(*) AS total FROM licenses"
    ).first();
    return json({
     ok:true,
     service:"ADNER YT IOS LICENSE",
     database:"connected",
     licenseCount:result.total
    });
   }catch{
    return json({ok:false,database:"unavailable"},503);
   }
  }

  if(!url.pathname.startsWith("/admin/"))
   return json({error:"Ruta no disponible"},404);

  if(!await authorized(request,env))
   return json({error:"No autorizado"},401);

  if(url.pathname==="/admin/licenses"&&request.method==="GET"){
   const result=await env.DB.prepare(
    `SELECT id,label,created_at,activated_at,
      expires_at,duration_seconds,max_devices,status
     FROM licenses ORDER BY created_at DESC LIMIT 200`
   ).all();
   return json({ok:true,licenses:result.results});
  }

  if(url.pathname==="/admin/licenses"&&request.method==="POST"){
   let data;
   try{data=await request.json()}catch{
    return json({error:"JSON invalido"},400);
   }

   const hours=Number(data.hours);
   const maxDevices=Number(data.maxDevices);
   const mode=data.startMode;

   if(!Number.isInteger(hours)||hours<1||hours>8760)
    return json({error:"Duracion invalida"},400);

   if(!Number.isInteger(maxDevices)||maxDevices<0||maxDevices>100)
    return json({error:"Limite de dispositivos invalido"},400);

   if(!["creation","activation"].includes(mode))
    return json({error:"Modo de inicio invalido"},400);

   if(typeof data.label!=="string"||data.label.length>80)
    return json({error:"Nombre invalido"},400);

   const key=randomKey();
   const id=await digest(key);
   const now=Date.now();
   const seconds=hours*3600;
   const expires=mode==="creation"?now+seconds*1000:null;

   await env.DB.prepare(
    `INSERT INTO licenses
     (id,label,created_at,duration_seconds,
      start_mode,expires_at,max_devices,status)
     VALUES (?,?,?,?,?,?,?,'active')`
   ).bind(
    id,data.label||"Licencia ADNER",now,seconds,
    mode,expires,maxDevices
   ).run();

   await env.DB.prepare(
    `INSERT INTO license_history
     (license_id,action,created_at,details)
     VALUES (?,'created',?,?)`
   ).bind(id,now,"Creada desde administrador").run();

   return json({
    ok:true,
    key,
    id,
    message:"Guarda la key: solo se muestra al crearla."
   },201);
  }

  return json({error:"Operacion no disponible"},404);
 }
};