import {useEffect,useState} from 'react';
import {api} from '../../services/api.js';
import CatalogModal from './CatalogModal.jsx';
import './styles/TripModeControl.css';

export default function TripModeControl({admin}){
 const [mode,setMode]=useState(null),[target,setTarget]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  const load=()=>api('/trip-mode').then(m=>{if(alive)setMode(m)}).catch(e=>{if(alive)setError(e.message)});
  load();const timer=setInterval(load,15000);
  return()=>{alive=false;clearInterval(timer);};
 },[]);
 async function confirm(){
  setBusy(true);setError('');
  try{setMode(await api('/trip-mode',{method:'PUT',body:{is_test:target,confirm:true}}));setTarget(null);}
  catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 function close(){setTarget(null);setError('');}
 return <div className="trip-mode-compact">
  {admin&&mode?<button type="button" role="switch" aria-label="Modo de prueba para viajes nuevos" aria-checked={mode.is_test} className="trip-mode-toggle" onClick={()=>{setError('');setTarget(!mode.is_test);}}>
   <span className="trip-mode-track" aria-hidden="true"/><span>{mode.is_test?'Prueba':'Real'}</span>
  </button>:<small>{mode?(mode.is_test?'Prueba':'Real'):error?'Modo no disponible':'Consultando modo…'}</small>}
  {target===null&&error&&<small role="alert">{error}</small>}
  {target!==null&&<div className="trip-mode-confirm"><CatalogModal title={target?'Activar modo Prueba':'Activar modo Real'} busy={busy} onClose={close}>
   <p>El cambio se aplica a los viajes nuevos de todos los conductores. Los viajes existentes conservan su tipo.</p>
   {target&&<p>Los viajes de prueba no afectan los cobros ni el kilometraje real.</p>}
   {error&&<p className="catalog-error" role="alert">{error}</p>}
   <div className="catalog-footer"><button type="button" className="secondary" disabled={busy} onClick={close}>Cancelar</button><button type="button" disabled={busy} onClick={confirm}>Confirmar</button></div>
  </CatalogModal></div>}
 </div>;
}
