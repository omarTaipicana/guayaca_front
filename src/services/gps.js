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
 emit('GPS detenido',{active:false,healthy:false});
}
export async function readNativeGps(){
 if(!nativeLocation||polling)return;
 polling=true;try{
  await importNativeGps();
  const s=await Device.trackingStatus();
  if(trip)emit(s.active?(s.healthy?'Seguimiento activo':'Buscando señal GPS'):'Seguimiento detenido',{active:s.active,healthy:!!s.healthy});
  syncNow().catch(()=>{});
 }finally{polling=false;}
}
export async function startGps(id){
 if(String(trip)===String(id)&&state.active)return;
 if(!nativeLocation&&!navigator.geolocation)throw Error('El dispositivo no permite geolocalización');
 const owner=ownerId(),token=++generation;
 if(watch!==null)clearPositionWatch(watch);watch=null;trip=String(id);
 if(nativeLocation)await importNativeGps(owner);
 const snapshot=await projectedTrip(id);
 if(token!==generation||owner!==ownerId())return;
 if(!snapshot?.stops?.length||snapshot.route_complete){emit('Abre el viaje con conexión para preparar sus puntos.',{active:false,healthy:false});return;}
 lastRoute=snapshot.samples?.at(-1)||null;lastSaved=+new Date(snapshot.last_observed_at||lastRoute?.device_at||0);
 if(nativeLocation){
  await Device.configureChannel({owner,...await alertSettings(owner)});
  if(token!==generation||owner!==ownerId())return;
  await Device.startTracking({owner,trip:String(id),stops:snapshot.stops,lastSaved,lastRouteAt:+new Date(lastRoute?.device_at||0),...(lastRoute?{route:lastRoute}:{})});
  if(token!==generation||owner!==ownerId())return;
  emit('Seguimiento activo · Android',{active:true,permission:'granted',healthy:true});return;
 }
 emit('Buscando señal GPS',{active:true,healthy:false});
 watch=watchPosition(async fix=>{
  if(token!==generation||busy||fix.timestamp<=lastSaved||Date.now()-fix.timestamp>120000)return;
  busy=true;
  try{
   const snap=await projectedTrip(id),stop=snap?.stops.find(s=>!s.departed_at);
   if(token!==generation)return;
   if(!stop){stopGps();return;}
   const {latitude,longitude,accuracy}=fix.coords,radius=Number(stop.place.radius_m||150),at=fix.timestamp;
   if(!Number.isFinite(accuracy)||accuracy>Math.max(25,Math.min(100,radius/2)))return;
   const d=distance(fix.coords,stop.place),inside=d<=radius,outside=d>=radius+Math.max(50,accuracy);
   const kind=!stop.arrived_at?(inside?'arrival':null):stop.outside_at?(inside?'return':null):(outside?'departure':null);
   if(!lastRoute)lastRoute={latitude,longitude,accuracy,device_at:new Date(at).toISOString()};
   const route=(at-+new Date(lastRoute.device_at)>=8000&&distance(lastRoute,fix.coords)>=Math.max(30,accuracy+Number(lastRoute.accuracy||0)));
   const evidence=kind?stop.candidate_type!==kind||at-+new Date(stop.candidate_at)>=20000||at-lastSaved>90000:!!stop.candidate_type;
   if(!route&&!evidence)return;
   const timestamp=new Date(at).toISOString();
   await api('/trips/'+id+'/gps',{method:'POST',body:{latitude,longitude,accuracy,timestamp,route_point:route}});
   if(token!==generation)return;
   lastSaved=at;if(route)lastRoute={latitude,longitude,accuracy,device_at:timestamp};
   emit('GPS activo',{healthy:true,lastFixAt:at,permission:'granted'});
  }catch(e){if(token===generation)emit(e.message,{healthy:false});}finally{busy=false;}
 },e=>{if(token===generation){if(e.code===1)stopGps();emit('No se pudo obtener ubicación',{healthy:false,...(e.code===1?{permission:'denied'}:{})});}},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
}
export const requestLocation=authorizeLocation;
