import {useEffect,useRef,useState} from 'react';
import {LocalNotifications} from '@capacitor/local-notifications';
import {api} from '../../services/api.js';
import {Device} from '../../services/native/device.js';
import {nativeLocation,locationPermission} from '../../services/native/location.js';
import {gpsStatus,requestLocation,startGps,stopGps,readNativeGps} from '../../services/gps.js';
import CatalogModal from './CatalogModal.jsx';
import './styles/Gps.css';

const closed=t=>['finalizado','cancelado'].includes(t?.status);
export default function GpsGuard({user,openedTrip}){
 const driver=user.role!=='admin'&&user.permissions.includes('viajes');
 const [needs,Need]=useState(false),[busy,B]=useState(false),[error,E]=useState('');
 const [notice,Notice]=useState(null);
 const acknowledged=useRef(new Set());
 const selected=useRef(null),requested=useRef(false),alertPermission=useRef(false);
 const eligible=driver&&openedTrip&&!openedTrip.is_test&&String(openedTrip.driver_id)===String(user.id)&&openedTrip.metadata?.origin_place&&openedTrip.metadata?.destination_places?.length;
 const id=eligible?String(openedTrip.id):null,status=openedTrip?.status;
 const noticeKey=id&&!closed(openedTrip)?JSON.stringify([user.id,id]):null;
 useEffect(()=>{
  if(!nativeLocation||!noticeKey){Notice(null);return;}
  const update=({detail}={detail:gpsStatus()})=>{
   const show=detail.active&&String(detail.trip_id)===id&&!acknowledged.current.has(noticeKey);
   Notice(show?noticeKey:null);
  };
  window.addEventListener('guayaca:gps',update);
  update();
  return()=>window.removeEventListener('guayaca:gps',update);
 },[id,noticeKey]);

 useEffect(()=>{
  if(!driver)return;
  let disposed=false,checking=false;
  async function check(verify=false){
   if(checking||document.visibilityState==='hidden')return;
   checking=true;
   try{
    await readNativeGps();if(disposed)return;
    if(id&&closed(openedTrip)){if(String(gpsStatus().trip_id)===id)stopGps();if(selected.current===id)selected.current=null;Need(false);return;}
    if(id)selected.current=id;
    const target=selected.current||gpsStatus().trip_id;if(!target)return;
    let p=await locationPermission();if(disposed)return;
    if(id&&p==='prompt'&&!requested.current){
     requested.current=true;
     try{await requestLocation();p='granted';}catch(e){if(!disposed)E(e.message);}
    }
    if(disposed)return;
    Need(p!=='granted');
    if(p==='granted'){
     await startGps(target);if(!disposed)E('');
     if(id&&nativeLocation&&!alertPermission.current){
      alertPermission.current=true;
      LocalNotifications.checkPermissions().then(p=>{
       if(!disposed&&['prompt','prompt-with-rationale'].includes(p.display))return LocalNotifications.requestPermissions();
      }).catch(()=>{});
     }
    }
    if(verify&&navigator.onLine!==false){
     const detail=await api('/trips/'+target,{signal:AbortSignal.timeout(8000)});
     if(!disposed&&closed(detail?.trip)&&String(gpsStatus().trip_id)===String(target)){selected.current=null;stopGps();window.dispatchEvent(new Event('guayaca:trip-closed'));}
    }
   }catch(e){if(!disposed){if([401,403,404].includes(e.status))stopGps();else if(id)E(e.message);}}
   finally{checking=false;}
  }
  const resume=()=>check(true),poll=()=>{if(document.visibilityState!=='hidden')readNativeGps().catch(()=>{});};
  check();
  const timer=setInterval(resume,20000),nativeTimer=nativeLocation?setInterval(poll,4000):null;
  window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  return()=>{disposed=true;clearInterval(timer);clearInterval(nativeTimer);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
 },[user.id,driver,id,status]);
 if(!driver||!id||closed(openedTrip))return null;
 async function activate(){B(true);E('');try{await requestLocation();Need(false);await startGps(id);}catch(e){E(e.message);}finally{B(false);}}
 const acknowledge=()=>{acknowledged.current.add(noticeKey);Notice(null);};
 return <>{(needs||error)&&<div className="gps-required-banner" role="status"><span>{error||'Permite la ubicación precisa para registrar este viaje.'}</span><button type="button" onClick={nativeLocation&&needs?()=>Device.openTrackingSettings().catch(e=>E(e.message)):activate} disabled={busy}>{busy?'Verificando…':nativeLocation&&needs?'Abrir ajustes':'Reintentar GPS'}</button></div>}
 {noticeKey&&notice===noticeKey&&<div className="gps-start-dialog"><CatalogModal title="Mantén GUAYACA activa durante el viaje" onClose={acknowledge}><div className="gps-start-body">
  <div className="gps-start-intro">
   <span className="gps-start-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
   <p><strong>Seguimiento iniciado</strong><span>GUAYACA usa el GPS para guardar tu ruta y avisarte al llegar al embarque o a la entrega, incluso sin internet.</span></p>
  </div>
  <div className="gps-start-keep"><strong>✓ Puedes bloquear la pantalla o usar otras apps.</strong><span>Deja GUAYACA en la lista de apps recientes.</span></div>
  <div className="gps-start-warning"><strong>⚠ No quites GUAYACA de Recientes.</strong><span>En algunos teléfonos, al deslizarla fuera de Recientes se detiene el GPS y dejan de llegar los avisos.</span></div>
  <div className="catalog-footer"><button type="button" onClick={acknowledge}>Entendido</button></div>
 </div></CatalogModal></div>}</>;
}
