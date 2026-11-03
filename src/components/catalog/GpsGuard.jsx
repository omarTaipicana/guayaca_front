import {projectedTrip} from '../../services/offline/projection.js';
import {nativeLocation,locationPermission} from '../../services/native/location.js';
import {useEffect,useRef,useState} from 'react';
import {api} from '../../services/api.js';
import {gpsStatus,requestLocation,startGps,stopGps} from '../../services/gps.js';
import CatalogModal from './CatalogModal.jsx';
import './styles/Gps.css';
export default function GpsGuard({user}){
 const driver=user.role!=='admin'&&user.permissions.includes('viajes');
 const [state,S]=useState(gpsStatus()),[trip,T]=useState(null),[permission,P]=useState('unknown'),[busy,B]=useState(false),[error,E]=useState(''),[dismissed,D]=useState(false);
 const checking=useRef(false);
 useEffect(()=>{if(!driver)return;let permissionStatus,disposed=false;
 const update=e=>{S(e.detail);if(e.detail.permission==='denied'){P('denied');D(false)}else if(e.detail.permission==='granted')P('granted')};
 window.addEventListener('guayaca:gps',update);
 async function check(){if(checking.current)return;checking.current=true;try{
  if(nativeLocation){P(await locationPermission())}else if(navigator.permissions){try{if(!permissionStatus)permissionStatus=await navigator.permissions.query({name:'geolocation'});if(disposed)return;P(permissionStatus.state);permissionStatus.onchange=()=>{if(!disposed){P(permissionStatus.state);if(permissionStatus.state!=='granted'){stopGps();D(false)}}};}catch{/* Browsers without Permissions API still support the activation button. */}}
  const active=await api('/gps-session');if(disposed)return;active.sort((a,b)=>Number(String(b.id)===String(gpsStatus().trip_id))-Number(String(a.id)===String(gpsStatus().trip_id))||Number(b.status==='en_curso')-Number(a.status==='en_curso'));
  let candidate=null;for(const t of active){const local=await projectedTrip(t.id);if(!local?.route_complete){candidate=t;break;}}
  if(disposed)return;T(candidate);E('');
  if(!candidate){if(gpsStatus().active)stopGps();}
  else if((nativeLocation?await locationPermission()==='granted':permissionStatus?.state==='granted'||gpsStatus().permission==='granted')&&(!gpsStatus().active||String(gpsStatus().trip_id)!==String(candidate.id)))startGps(candidate.id);
 }catch(e){if(!disposed)E(e.message)}finally{checking.current=false}}
 check();const timer=setInterval(check,15000);window.addEventListener('guayaca:trips-changed',check);
 return()=>{disposed=true;clearInterval(timer);window.removeEventListener('guayaca:gps',update);window.removeEventListener('guayaca:trips-changed',check);if(permissionStatus)permissionStatus.onchange=null;stopGps()};
 },[user.id,driver]);
 if(!driver)return null;
 const needsPermission=permission!=='granted';
 async function activate(){B(true);E('');try{await requestLocation();P('granted');D(false);if(trip)startGps(trip.id)}catch(e){E(e.message)}finally{B(false)}}
 return <>{needsPermission&&!dismissed&&<CatalogModal title="Activa la ubicación para trabajar en GUAYACA" busy={busy} busyLabel="Solicitando ubicación al dispositivo…" onClose={()=>D(true)}><p>Para registrar llegadas, salidas y el recorrido necesitas permitir la ubicación precisa del dispositivo. El seguimiento se usa durante tu viaje real activo y se detiene al terminar el recorrido.</p><p className="gps-permission-note">Pulsa Activar ubicación y permite el acceso en el navegador. Activa también el GPS del teléfono. La web debe permanecer abierta; con pantalla bloqueada no garantiza seguimiento.</p>{error&&<p role="alert" className="catalog-error">{error}</p>}<button disabled={busy} onClick={activate}>Activar ubicación</button><p>Puedes consultar pendientes mientras solucionas el permiso; sin ubicación no se registran automáticamente los movimientos.</p></CatalogModal>}
 {(needsPermission||trip&&(!state.active||!state.healthy)||error)&&<div className="gps-required-banner" role="status"><span>{error|| (needsPermission?'Ubicación necesaria para registrar tu viaje.':state.message)}</span><button onClick={needsPermission?()=>D(false):activate} disabled={busy}>{busy?'Verificando…':'Activar / revisar GPS'}</button></div>}</>;
}
