import {rawApi,getBearer} from '../http.js';import {getLocal,putLocal,listLocal,deleteLocal} from './store.js';
export function ownerId(){try{const s=getBearer().split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return String(JSON.parse(atob(s)).sub||'')}catch{return ''}}
const changed=()=>window.dispatchEvent(new Event('guayaca:outbox'));
export async function pendingOperations(owner=ownerId()){return (await listLocal('op:'+owner+':')).filter(o=>o.state!=='confirmed').sort((a,b)=>a.sequence-b.sequence||a.id.localeCompare(b.id));}
export async function cached(path){const owner=ownerId();return owner?getLocal('cache:'+owner+':'+path):null;}
export async function cacheResponse(path,data){const owner=ownerId();if(owner)await putLocal('cache:'+owner+':'+path,{data,saved_at:new Date().toISOString()});}
const match=path=>path.match(/^\/trips\/(\d+)\/(gps|expenses|outcomes|stops\/(\d+|local-\d+)\/(complete|exit))$/);
export const queueable=(path,options)=>options.method==='POST'&&!!match(path);
async function packedFile(file){if(!file||!file.size)return null;
 if(file.size<=30*1024*1024&&/^image\/(jpeg|png|webp)$/.test(file.type)&&typeof createImageBitmap==='function'){try{const image=await createImageBitmap(file),scale=Math.min(1,2000/image.width,2000/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));if(blob)file=new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});}catch{/* Keep the original if the browser cannot decode; the server validates it. */}}
 if(file.size>12*1024*1024)throw Error('El archivo supera 12 MB; no se guardó como pendiente');const bytes=new Uint8Array(await file.arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));return {name:file.name,type:file.type||'application/octet-stream',base64:btoa(str)};}
function unpack(file){const s=atob(file.base64),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return new File([b],file.name,{type:file.type});}
let activeSync=null,lastSequence=0;
async function synchronizeOwner(owner){
 if(!owner||owner!==ownerId()||navigator.onLine===false)return;
 const operations=await pendingOperations(owner),waitingGps=new Set(),blocked=new Set();let processed=0;
 while(processed++<150){
  if(owner!==ownerId()||navigator.onLine===false)return;
  const firstByTrip=new Map();for(const o of operations)if(o.state!=='confirmed'&&!firstByTrip.has(o.trip_id))firstByTrip.set(o.trip_id,o);
  let selected=null;
  for(const first of firstByTrip.values()){
   if(blocked.has(first.trip_id)||['conflict','auth'].includes(first.state))continue;
   if(waitingGps.has(first.id)){const gps=operations.find(o=>o.trip_id===first.trip_id&&o.kind==='gps'&&o.state==='pending'&&o.sequence>first.sequence);if(gps){selected=gps;break;}continue;}
   if(first.retry_at&&Date.now()<first.retry_at)continue;selected=first;break;
  }
  if(!selected)return;const o=selected,body=new FormData();body.set('operation',JSON.stringify({id:o.id,trip_id:o.trip_id,kind:o.kind,position:o.position,captured_at:o.captured_at,body:o.body}));for(const f of (o.files||[o.file].filter(Boolean)))body.append('file',unpack(f));
  try{
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);let ack;try{ack=await rawApi('/offline/operations',{method:'POST',body,signal:controller.signal})}finally{clearTimeout(timeout)}if(ack?.confirmed!==true||ack.id!==o.id)throw Error('Falta confirmación del servidor');
   const receipt={id:o.id,trip_id:o.trip_id,kind:o.kind,sequence:o.sequence,captured_at:o.captured_at,state:'confirmed',confirmed_at:ack.confirmed_at,result:ack.result,owner};
   await putLocal('op:'+owner+':'+o.id,receipt);o.state='confirmed';delete o.file;delete o.files;for(const blockedOp of operations)if(blockedOp.trip_id===o.trip_id&&waitingGps.has(blockedOp.id)){waitingGps.delete(blockedOp.id);blockedOp.retry_at=0;}
   changed();window.dispatchEvent(new CustomEvent('guayaca:gps-updated',{detail:{trip_id:o.trip_id,transition:ack.result?.transition||(o.kind!=='gps'?{phase:'sync',name:'Datos sincronizados'}:null),status:ack.result?.status}}));window.dispatchEvent(new Event('guayaca:trips-changed'));
  }catch(e){
   const dependency=e.status===409&&/Todavía.*(GPS|coordenadas)|Sincroniza primero/.test(e.message);
   o.attempts=(o.attempts||0)+1;o.error=e.message;o.state=dependency?'pending':[401,403].includes(e.status)?'auth':e.status&&e.status<500&&e.status!==429?'conflict':'pending';o.retry_at=dependency?0:Date.now()+Math.min(60000,2000*2**Math.min(o.attempts,5));
   await putLocal('op:'+owner+':'+o.id,o);if(dependency)waitingGps.add(o.id);else blocked.add(o.trip_id);changed();if(!e.status||e.status>=500||e.status===429)return;
  }
 }
}
export async function syncNow(){if(activeSync)return activeSync;const owner=ownerId();const task=()=>synchronizeOwner(owner);activeSync=(navigator.locks?navigator.locks.request('guayaca-sync-'+owner,task):task()).finally(async()=>{try{const receipts=(await listLocal('op:'+owner+':')).filter(o=>o.state==='confirmed').sort((a,b)=>b.sequence-a.sequence);for(const r of receipts.slice(100))await deleteLocal('op:'+owner+':'+r.id)}catch{}finally{activeSync=null}});return activeSync;}
export async function retryOperation(id){const owner=ownerId(),o=await getLocal('op:'+owner+':'+id);if(!o||o.state==='confirmed')return;o.state='pending';o.retry_at=0;await putLocal('op:'+owner+':'+id,o);changed();return syncNow();}
export async function queueRequest(path,options){const owner=ownerId();if(!owner)throw Error('Inicia sesión antes de registrar operaciones offline');const m=match(path),trip_id=m[1],kind=m[2]==='gps'?'gps':m[2]==='expenses'?'expense':m[2]==='outcomes'?'outcome':m[4]==='exit'?'exit':'point';let body,file=null,files=[];
 if(options.body instanceof FormData){body={};for(const [k,v] of options.body.entries()){if(v instanceof File){if(v.size)files.push(await packedFile(v))}else body[k]=v;}}else body={...(options.body||{})};
 if(files.length>10||kind!=='point'&&files.length>1)throw Error('La guía admite hasta 10 archivos; los demás registros admiten uno');if(files.reduce((n,f)=>n+Math.floor(f.base64.length*3/4),0)>24*1024*1024)throw Error('Los adjuntos superan 24 MB en total');if(files.length===1){file=files[0];files=[];}
 if(kind==='gps'){const copy=await cached('/trips/'+trip_id+'/gps-state'),point=copy?.data.stops.find(s=>!s.departed_at);const limit=Math.max(25,Math.min(100,Number(point?.place.radius_m||150)/2));if(!Number.isFinite(+body.accuracy)||+body.accuracy>limit)throw Error('Precisión GPS insuficiente; espera señal precisa antes de guardar coordenadas.');}
 let position=null;if(['point','exit'].includes(kind)){const state=await cached('/trips/'+trip_id+'/gps-state');position=state?.data.stops.find(s=>String(s.id)===m[3])?.position;if(position==null&&options.position!=null)position=options.position;if(position==null)throw Error('Abre el viaje con conexión primero para guardar sus puntos.');}
 const pending=await pendingOperations(owner);if(pending.length>=20000)throw Error('Hay 20.000 operaciones pendientes; sincroniza antes de registrar más.');
 if(kind==='point'&&pending.some(o=>o.kind==='point'&&o.trip_id===trip_id&&o.position===position))throw Error('Este punto ya tiene un documento pendiente de sincronización. Revisa la cola antes de enviarlo otra vez.');
 const captured_at=kind==='gps'?new Date(body.timestamp).toISOString():new Date().toISOString(),id=body.request_id||crypto.randomUUID();
 const op={id,owner,trip_id,kind,position,body,file,...(files.length?{files}:{}),captured_at,sequence:(lastSequence=Math.max(Date.now()*1000,lastSequence+1)),state:'pending',attempts:0};
 await putLocal('op:'+owner+':'+id,op);changed();if(kind==='gps')syncNow().catch(()=>{});else await syncNow();const projection=await (await import('./projection.js')).projectedTrip(trip_id);if(owner===ownerId()&&kind==='gps'&&projection?.local_transitions?.length){const event=projection.local_transitions.at(-1),key='local-notice:'+owner+':'+trip_id,signature=JSON.stringify(event);if(await getLocal(key)!==signature){await putLocal(key,signature);const {notifyAlert}=await import('../native/alerts.js');notifyAlert(owner,{title:'GUAYACA · '+({arrival:'Llegada',departure:'Salida',return:'Regreso'}[event.phase])+' estimada sin conexión',message:event.name+'. Pendiente de confirmación al sincronizar. Revisa los datos del punto.'}).catch(()=>{});}}const stored=await getLocal('op:'+owner+':'+id);return stored.state==='confirmed'?stored.result:{queued:true,local_route_complete:projection?.route_complete,operation_id:id,pending_state:stored.state,message:stored.error||'Guardado en el dispositivo; pendiente de sincronización'};
}
export function startSync(){const online=()=>syncNow().catch(()=>{});window.addEventListener('online',online);const timer=setInterval(online,15000);online();return()=>{clearInterval(timer);window.removeEventListener('online',online)}}
