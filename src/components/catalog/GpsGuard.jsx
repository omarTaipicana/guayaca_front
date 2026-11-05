import {useEffect,useRef,useState} from 'react';
import {api} from '../../services/api.js';
import {projectedTrip} from '../../services/offline/projection.js';
import {nativeLocation,locationPermission} from '../../services/native/location.js';
import {gpsStatus,requestLocation,startGps,stopGps,readNativeGps} from '../../services/gps.js';
import './styles/Gps.css';

export default function GpsGuard({user}){
 const driver=user.role!=='admin'&&user.permissions.includes('viajes');
 const [trip,T]=useState(null),[permission,P]=useState('unknown'),[busy,B]=useState(false),[error,E]=useState('');
 const selected=useRef(null);
 useEffect(()=>{
  if(!driver)return;
  let disposed=false,checking=false;
  async function check(){
   if(checking||document.visibilityState==='hidden')return;
   checking=true;
   try{
    const p=await locationPermission();if(disposed)return;P(p);
    await readNativeGps();
    const active=await api('/gps-session');
    active.sort((a,b)=>Number(String(b.id)===String(gpsStatus().trip_id))-Number(String(a.id)===String(gpsStatus().trip_id))||Number(b.status==='en_curso')-Number(a.status==='en_curso'));
    let candidate=null;
    for(const t of active){const local=await projectedTrip(t.id);if(local?.stops?.length&&!local.route_complete){candidate=t;break;}}
    if(disposed)return;
    selected.current=candidate;T(candidate);
    if(!candidate||p==='denied'){if(gpsStatus().active)stopGps();return;}
    if(p==='granted'||!nativeLocation&&gpsStatus().permission==='granted')await startGps(candidate.id);
   }catch(e){if(!disposed&&[401,403].includes(e.status))stopGps();}finally{checking=false;}
  }
  const poll=()=>{if(document.visibilityState!=='hidden')readNativeGps().catch(()=>{});};
  check();
  const timer=setInterval(check,15000),nativeTimer=nativeLocation?setInterval(poll,4000):null;
  window.addEventListener('guayaca:trips-changed',check);window.addEventListener('online',check);document.addEventListener('visibilitychange',check);
  return()=>{disposed=true;clearInterval(timer);clearInterval(nativeTimer);window.removeEventListener('guayaca:trips-changed',check);window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check);stopGps();};
 },[user.id,driver]);
 if(!driver||!trip||permission==='unknown'||permission==='granted'&&!error)return null;
 async function activate(){B(true);E('');try{await requestLocation();P('granted');if(selected.current)await startGps(selected.current.id);}catch(e){E(e.message);}finally{B(false);}}
 return <div className="gps-required-banner" role="status"><span>{error||(nativeLocation?'Permite la ubicación precisa de Android para registrar este viaje.':'Permite la ubicación para registrar este viaje.')}</span><button type="button" onClick={activate} disabled={busy}>{busy?'Verificando…':'Habilitar ubicación'}</button></div>;
}
