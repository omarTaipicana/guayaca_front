import {Capacitor} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
export const nativeLocation=Capacitor.getPlatform()==='android';
const precise=p=>p.location==='granted'?'granted':(p.location==='denied'||p.coarseLocation==='granted')?'denied':'prompt';
export async function locationPermission(){
 if(nativeLocation)return precise(await Geolocation.checkPermissions());
 try{return (await navigator.permissions?.query({name:'geolocation'}))?.state||'prompt';}catch{return 'prompt';}
}
export async function authorizeLocation(){
 if(!nativeLocation&&await locationPermission()==='granted')return;
 if(!nativeLocation)return getPosition({enableHighAccuracy:true,timeout:20000,maximumAge:0});
 const state=await locationPermission();
 if(state==='granted')return;
 if(state==='denied'||precise(await Geolocation.requestPermissions({permissions:['location']}))!=='granted')throw Error('Activa Ubicación precisa en Ajustes de Android → Aplicaciones → GUAYACA → Permisos.');
}
export async function getPosition(options){
 if(nativeLocation){
  if(await locationPermission()!=='granted')throw Error('Falta el permiso de ubicación precisa');
  return Geolocation.getCurrentPosition(options);
 }
 return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,options));
}
export function watchPosition(ok,error,options){return navigator.geolocation.watchPosition(ok,error,options);}
export function clearPositionWatch(id){navigator.geolocation?.clearWatch(id);}
