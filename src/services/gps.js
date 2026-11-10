import {gpsCandidate,MAX_ROUTE_ACCURACY} from './gpsRouting.js';
import {API} from './http.js';
import {api} from './api.js';
import {nativeLocation,authorizeLocation,getPosition,watchPosition,clearPositionWatch} from './native/location.js';
import {Device} from './native/device.js';
import {distance,projectedTrip} from './offline/projection.js';
import {importNativeGps,ownerId,syncNow} from './offline/queue.js';
import {alertSettings} from './native/alerts.js';

let watch=null,trip=null,generation=0,busy=false,polling=false,lastRoute=null,lastSaved=0;
let state={active:false,healthy:false,permission:'unknown',message:'GPS detenido'};
const emit=(message,extra={})=>{state={...state,trip_id:trip,message,...extra};window.dispatchEvent(new CustomEvent('guayaca:gps',{detail:state}));};
export const gpsStatus=()=>state;

export function stopGps(){
 generation++;if(watch!==null)clearPositionWatch(watch);watch=null;trip=null;lastRoute=null;lastSaved=0;
 if(nativeLocation)Device.stopTracking().catch(()=>{});
 emit('GPS detenido',{active:false,healthy:false,fix:null,lastCapturedAt:null});
}
export async function readNativeGps(){
 if(!nativeLocation||polling)return;
 polling=true;try{
  const owner=ownerId(),token=generation;
  const s=await Device.trackingStatus({owner});
  if(token!==generation||owner!==ownerId())return;
  if(s.trip&&!trip)trip=String(s.trip);
  const sameTrip=!!s.trip&&String(s.trip)===String(trip),running=s.active&&sameTrip;
  const message=!running?'Seguimiento detenido':s.healthy?'Seguimiento activo':s.locationEnabled===false?'Ubicación del teléfono desactivada':'Esperando ubicación precisa';
  if(trip)emit(message,{active:running,healthy:running&&!!s.healthy,fix:running?s.fix||null:null,lastCapturedAt:sameTrip?s.lastCapturedAt||null:null,batteryOptimized:s.batteryOptimized,notificationsEnabled:s.notificationsEnabled,statusNotificationEnabled:s.statusNotificationEnabled,previousExit:s.previousExit});
  syncNow().catch(()=>{});
 }finally{polling=false;}
}
export async function startGps(id){
 if(String(trip)===String(id)&&state.active)return;
 if(!nativeLocation&&!navigator.geolocation)throw Error('El dispositivo no permite geolocalización');
 const owner=ownerId(),token=++generation;
 if(watch!==null)clearPositionWatch(watch);watch=null;trip=String(id);
 let nativeCheckpoint=null;
 if(nativeLocation){
  const s=await Device.trackingStatus({owner});
  if(token!==generation||owner!==ownerId())return;
  if(s.active&&String(s.trip)===String(id)){await readNativeGps();return;}
  if(!s.active&&String(s.trip)===String(id))nativeCheckpoint=s;
  // Failure to copy old points to the web queue must not block local capture.
  await importNativeGps(owner).catch(()=>{});
 }
 const snapshot=await projectedTrip(id).catch(e=>{if(nativeCheckpoint)return null;throw e;});
 if(token!==generation||owner!==ownerId())return;
 if(snapshot?.route_complete||['finalizado','cancelado'].includes(snapshot?.status)){emit('Recorrido terminado',{active:false,healthy:false,fix:null});return;}
 if(!snapshot?.stops?.length&&!nativeCheckpoint){emit('Abre el viaje con conexión para preparar sus puntos.',{active:false,healthy:false,fix:null});return;}
 lastRoute=snapshot?.samples?.at(-1)||null;
 lastSaved=+new Date(snapshot?.last_observed_at||lastRoute?.device_at||0)||0;
 if(nativeLocation){
  // Android can register locations even when notification preferences are unavailable.
  await alertSettings(owner).then(settings=>Device.configureChannel({owner,...settings})).catch(()=>{});
  if(token!==generation||owner!==ownerId())return;
  try{
   const resumeOnly=!snapshot?.stops?.length;
   await Device.startTracking({owner,apiUrl:API,trip:String(id),resumeOnly,stops:snapshot?.stops,lastSaved,lastRouteAt:+new Date(lastRoute?.device_at||0),...(lastRoute?{route:{...lastRoute,timestamp:+new Date(lastRoute.device_at||0)}}:{})});
   if(token!==generation||owner!==ownerId())return;
   emit('Buscando señal GPS',{active:true,permission:'granted',healthy:false,fix:null,lastCapturedAt:Math.max(lastSaved,nativeCheckpoint?.lastCapturedAt||0)||null});
   await readNativeGps().catch(()=>{});
  }catch(e){
   if(token!==generation||owner!==ownerId())return;
   emit(e.message,{active:false,healthy:false,fix:null});
   throw e;
  }
  return;
 }
 emit('Buscando señal GPS',{active:true,healthy:false});
 watch=watchPosition(async fix=>{
  if(token!==generation||busy||fix.timestamp<=lastSaved||Date.now()-fix.timestamp>120000)return;
  busy=true;
  try{
   const snap=await projectedTrip(id),stops=snap?.stops||[];
   if(token!==generation)return;
   if(!stops.some(s=>!s.departed_at)){stopGps();return;}
   const {latitude,longitude,accuracy}=fix.coords,at=fix.timestamp;
   if(!Number.isFinite(accuracy)||accuracy<0||accuracy>MAX_ROUTE_ACCURACY)return;
   const {stop,kind}=gpsCandidate(stops,fix.coords)||{};
   const route=!lastRoute||(at-+new Date(lastRoute.device_at)>=8000&&distance(lastRoute,fix.coords)>=Math.max(30,accuracy+Number(lastRoute.accuracy||0)));
   const evidence=stops.some(s=>s!==stop&&s.candidate_type)||(kind&&(stop.candidate_type!==kind||at-+new Date(stop.candidate_at)>=20000||at-lastSaved>90000));
   if(!route&&!evidence){emit('GPS activo',{healthy:true,fix:{latitude,longitude,accuracy,timestamp:at},permission:'granted'});return;}
   const timestamp=new Date(at).toISOString();
   await api('/trips/'+id+'/gps',{method:'POST',body:{latitude,longitude,accuracy,timestamp,route_point:route}});
   if(token!==generation)return;
   lastSaved=at;if(route)lastRoute={latitude,longitude,accuracy,device_at:timestamp};
   emit('GPS activo',{healthy:true,lastFixAt:at,fix:{latitude,longitude,accuracy,timestamp:at},permission:'granted'});
  }catch(e){if(token===generation)emit(e.message,{healthy:false});}finally{busy=false;}
 },e=>{if(token===generation){if(e.code===1)stopGps();emit('No se pudo obtener ubicación',{healthy:false,...(e.code===1?{permission:'denied'}:{})});}},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
}
export const requestLocation=authorizeLocation;
