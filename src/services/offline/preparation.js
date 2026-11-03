import {rawApi} from '../http.js';
import {ownerId} from './queue.js';
import {getLocal,putLocal} from './store.js';
const running=new Map(),states=new Map();
const key=(owner,id)=>'prepared:'+owner+':'+id;
const changed=()=>window.dispatchEvent(new Event('guayaca:preparation'));
async function network(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{return await rawApi(path,{signal:controller.signal})}finally{clearTimeout(timer)}}
export async function preparationStatus(id){const owner=ownerId();if(!owner)return null;const saved=await getLocal(key(owner,id));return {...saved,...states.get(key(owner,id))};}
export async function prepareTrip(id,{force=false}={}){
 const owner=ownerId();if(!owner)throw Error('Inicia sesión para preparar el viaje');const k=key(owner,id);if(running.has(k))return running.get(k);
 const task=(async()=>{const previous=await getLocal(k);if(!force&&previous?.saved_at&&Date.now()-new Date(previous.saved_at)<60000)return previous;
 states.set(k,{preparing:true,error:''});changed();
 try{
  if(navigator.onLine===false)throw Error('Sin conexión; se reintentará automáticamente al recuperar internet');
  const paths=['/trips/'+id,'/trips/'+id+'/gps-state','/trips/'+id+'/control'],values=[];
  for(const path of paths)values.push(await network(path));
  if(owner!==ownerId())throw Error('La cuenta cambió durante la preparación');
  if(!values[0]?.trip?.metadata?.origin_place||!values[0].trip.metadata.destination_places?.length)throw Error('Este viaje no contiene una ruta georreferenciada');
  const saved_at=new Date().toISOString();for(let i=0;i<paths.length;i++)await putLocal('cache:'+owner+':'+paths[i],{data:values[i],saved_at});
  const marker={trip_id:String(id),saved_at,ready:true};await putLocal(k,marker);states.set(k,{preparing:false,error:''});changed();return marker;
 }catch(e){states.set(k,{preparing:false,error:e.message||'No se pudo completar la preparación'});changed();throw e;}
 })().finally(()=>running.delete(k));running.set(k,task);return task;
}
export async function prepareAssignedTrips(user){const owner=ownerId();if(!owner||!user.permissions?.includes('viajes')&&user.role!=='admin')return;
 const rows=await network('/trips');if(owner!==ownerId())return;await putLocal('cache:'+owner+':/trips',{data:rows,saved_at:new Date().toISOString()});
 // Refresh lightweight GPS selection as well, so tracking can restart without network.
 try{const session=await network('/gps-session');if(owner!==ownerId())return;await putLocal('cache:'+owner+':/gps-session',{data:session,saved_at:new Date().toISOString()});}catch(e){if(e.status===401||e.status===403)throw e;/* A GPS-session refresh failure must not prevent preparing known trips. */}
 for(const t of rows.filter(t=>String(t.driver_id)===String(user.id)&&['creado','en_curso'].includes(t.status))){if(owner!==ownerId())return;try{await prepareTrip(t.id)}catch{/* Status remains visible and the next cycle retries. */}}
}
