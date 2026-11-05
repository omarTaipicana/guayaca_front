import {nativeLocation} from '../../services/native/location.js';
import TripPreparation from './TripPreparation.jsx';
import {prepareTrip} from '../../services/offline/preparation.js';
import {projectedTrip} from '../../services/offline/projection.js';
import {pendingOperations} from '../../services/offline/queue.js';
import DocumentInput from '../common/DocumentInput.jsx';
import {useEffect,useRef,useState} from 'react';
import {api,download} from '../../services/api.js';
import {date} from '../../services/format.js';
import {gpsStatus,startGps,requestLocation} from '../../services/gps.js';
import TripMap from '../common/TripMap.jsx';
import './styles/Gps.css';
const maps=p=>'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',destination:p.latitude+','+p.longitude,travelmode:'driving',dir_action:'navigate'});
export default function GpsTrip({trip,user,onUpdated,noticeTarget,onNoticeFocused}){
 const [offline,Offline]=useState(navigator.onLine===false),[pending,Pending]=useState([]),[data,D]=useState({stops:[],samples:[]}),[tracking,T]=useState(gpsStatus()),[error,E]=useState(''),[busy,B]=useState(false);
 const pointRefs=useRef(new Map());
 const [exitFeedback,SetExitFeedback]=useState({});
 const own=String(user.id)===String(trip.driver_id),canEdit=own||user.role==='admin',closed=['finalizado','cancelado'].includes(trip.status),points=[trip.metadata.origin_place,...trip.metadata.destination_places];
 useEffect(()=>{prepareTrip(trip.id).catch(()=>{})},[trip.id]);
 async function load(){try{D(await projectedTrip(trip.id,await api(`/trips/${trip.id}/gps-state`)))}catch(e){E(e.message)}}
 useEffect(()=>{load();const timer=setInterval(load,15000),update=e=>{if(String(e.detail.trip_id)===String(trip.id)){load();if(e.detail.transition||(e.detail.status&&e.detail.status!==trip.status))onUpdated()}};window.addEventListener('guayaca:gps-updated',update);return()=>{clearInterval(timer);window.removeEventListener('guayaca:gps-updated',update)}},[trip.id,trip.status,trip.control_revision]);
 useEffect(()=>{const update=e=>T(e.detail);window.addEventListener('guayaca:gps',update);return()=>window.removeEventListener('guayaca:gps',update)},[]);
 async function submitExit(e,s){
  e.preventDefault();
  const body=Object.fromEntries(new FormData(e.currentTarget));B(true);
  SetExitFeedback(x=>({...x,[s.position]:{text:'Guardando respuesta…'}}));
  try{
   const result=await api(`/trips/${trip.id}/stops/${s.id}/exit`,{method:'POST',body,position:s.position});
   if(result.queued){
    SetExitFeedback(x=>({...x,[s.position]:{id:result.operation_id,text:'Respuesta guardada. Se enviará automáticamente.'}}));
    Pending((await pendingOperations()).filter(o=>String(o.trip_id)===String(trip.id)));
    const projected=await projectedTrip(trip.id);if(projected)D(projected);
   }else{SetExitFeedback(x=>({...x,[s.position]:{text:'Situación registrada.'}}));await load();await onUpdated();}
  }catch(e){SetExitFeedback(x=>({...x,[s.position]:{error:true,text:e.message}}));}finally{B(false)}
 }
 async function run(fn){B(true);E('');try{const result=await fn();if(!result?.queued){await load();await onUpdated();}window.dispatchEvent(new Event('guayaca:trips-changed'))}catch(e){E(e.message)}finally{B(false)}}
 useEffect(()=>{let active=true;const update=()=>pendingOperations().then(async rows=>{if(active){Pending(rows.filter(o=>String(o.trip_id)===String(trip.id)));const state=await projectedTrip(trip.id);if(active&&state)D(state);}}).catch(()=>{}),local=()=>Offline(true),online=()=>Offline(navigator.onLine===false);update();window.addEventListener('guayaca:outbox',update);window.addEventListener('guayaca:offline-cache',local);window.addEventListener('offline',local);window.addEventListener('online',online);return()=>{active=false;window.removeEventListener('guayaca:outbox',update);window.removeEventListener('guayaca:offline-cache',local);window.removeEventListener('offline',local);window.removeEventListener('online',online)}},[trip.id]);
 const visibleStops=data.stops.length?data.stops:offline?points.map((place,position)=>({id:'local-'+position,place,position})):[];
 useEffect(()=>{
  if(!noticeTarget||String(noticeTarget.trip_id)!==String(trip.id))return;
  const stop=visibleStops.find(s=>noticeTarget.stop_id!=null?String(s.id)===String(noticeTarget.stop_id):s.position===Number(noticeTarget.position));
  const card=stop&&pointRefs.current.get(stop.position);if(!card)return;
  const form=card.querySelector('details.gps-documents');if(form)form.open=true;
  const input=form?.querySelector('input[name="odometer"]')||card.querySelector('.gps-exit-form select')||card;
  input.focus({preventScroll:true});input.scrollIntoView({block:'center'});onNoticeFocused?.();
 },[noticeTarget,visibleStops,trip.id,onNoticeFocused]);
 const routeDone=data.stops.length>0&&data.stops.every(s=>s.departed_at);
 return <section className="gps-trip"><TripPreparation id={trip.id}/><div className="gps-nav-buttons">{points.map((p,i)=><a key={p.id} href={maps(p)} target="_blank" rel="noreferrer">Navegar a {i===0?'embarque':'entrega '+i}: {p.name}</a>)}</div>
 <p>{nativeLocation?'Puedes bloquear la pantalla mientras el seguimiento esté activo.':'Mantén GUAYACA abierta durante el recorrido.'}</p>
 {own&&!closed&&!trip.is_test&&!routeDone&&<div className="gps-status"><p role="status">{tracking.message}</p>{(!tracking.active||!tracking.healthy)&&<button type="button" onClick={async()=>{try{E('');await requestLocation();await startGps(trip.id)}catch(e){E(e.message)}}}>Revisar ubicación</button>}<small>El seguimiento se activa automáticamente con permiso concedido. Se confirman cruces con señal precisa durante al menos 20 segundos.</small></div>}
 {trip.is_test&&<p className="catalog-info">Viaje de prueba: usa la simulación del administrador, sin GPS real.</p>}
 {error&&<p className="catalog-error" role="alert">{error}</p>}
 <h2>Llegadas, salidas y pendientes</h2>{data.local_projection&&<p className="catalog-info">Estimación local con operaciones pendientes: las llegadas y salidas se confirmarán en el servidor al sincronizar.</p>}{routeDone&&!closed&&<p className="catalog-info">{data.stops.some(s=>s.exception_resolved===false)?'Recorrido terminado. Hay incidencias pendientes de resolución administrativa.':'Recorrido terminado. Completa los documentos y kilometrajes pendientes para finalizar el viaje.'}</p>}
 {!data.stops.length&&<p>Esperando primeras coordenadas o simulación.</p>}
 {visibleStops.map(s=>{const localPending=pending.some(o=>o.kind==='point'&&o.position===s.position);const done=(s.arrival_file_id||s.document_waived)&&s.arrival_odometer!=null;const exitOp=pending.find(o=>o.kind==='exit'&&o.position===s.position),feedback=exitFeedback[s.position];
 const failedExit=exitOp&&['conflict','auth'].includes(exitOp.state);
 return <article className="catalog-card" tabIndex={-1} ref={node=>{if(node)pointRefs.current.set(s.position,node);else pointRefs.current.delete(s.position)}} key={s.id}>
 <h3>{s.position===0?'Embarque':'Entrega '+s.position} · {s.place.name}</h3>
 <p>Llegada: {s.arrived_at?date(s.arrived_at):'Pendiente de GPS'} · Salida definitiva: {s.departed_at?date(s.departed_at):'Pendiente'}</p>
 {s.arrived_at&&<p>Tiempo desde llegada: {Math.max(0,Math.round((new Date(s.departed_at||trip.test_clock||Date.now())-new Date(s.arrived_at))/60000))} minutos · incluye la espera temporal fuera del lugar.</p>}

 {s.outside_at&&!s.departed_at&&<p className="catalog-info">Salida física: {date(s.outside_at)} · {s.exit_state==='waiting'?user.role==='admin'?'Sigue esperando fuera del lugar. El stand by puede continuar.':'Sigue esperando fuera del lugar.':s.exit_state==='review'?'Novedad pendiente de revisión.':'Confirma qué ocurrió para continuar al siguiente punto.'} {s.exit_reason}</p>}
 {(s.arrived_at||offline)&&<div className="gps-requirement">{localPending&&<p className="catalog-info">Datos guardados en este dispositivo. Pendiente de confirmación del servidor; revisa Sincronización.</p>}{!s.arrived_at&&offline&&<p>La llegada todavía no está confirmada. Puedes guardar los datos; el servidor validará las coordenadas y el orden al sincronizar.</p>}<strong>{done?'Punto documentado · '+s.arrival_odometer+' km':localPending?'Guía y kilometraje guardados':s.outside_at?'Completa los datos pendientes':'Puedes adjuntar la guía antes de salir'}</strong>
 {!done&&!localPending&&canEdit&&!closed&&<details className="gps-documents" open={!!s.outside_at||undefined}><summary>{s.position===0?'Adjuntar guía':'Adjuntar guía de entrega'}</summary><form onSubmit={e=>{e.preventDefault();const body=new FormData(e.currentTarget);body.set('phase','arrival');run(()=>api(`/trips/${trip.id}/stops/${s.id}/complete`,{method:'POST',body,position:s.position}))}}>
 <label>Kilometraje del punto<input name="odometer" required type="number" min="0" step="0.1"/></label><label>{s.position===0?'Guía principal de embarque':['partial','rejected','failed'].includes(s.outcome)?'Documento de soporte de la incidencia':'Documento de entrega (confirma recepción)'}<DocumentInput name="file" required multiple/></label><button disabled={busy}>{busy?'Guardando todas las hojas…':'Guardar guía y kilometraje'}</button></form></details>}
 {!!s.arrival_file_ids?.length&&<p>Adjuntos de este punto: {s.arrival_file_ids.length}. {s.local_pending?'Pendientes de confirmación.':s.arrival_file_ids.map((id,i)=><button type="button" className="link" key={id} onClick={()=>run(()=>download(id,s.document_files?.find(f=>String(f.id)===String(id))?.original_name||('guia-'+s.position+'-hoja-'+(i+1))))}>Descargar archivo {i+1}</button>)}</p>}{s.document_waived&&<p>Documento eximido por el administrador con motivo e historial.</p>}</div>}
 {(exitOp||feedback)&&<p className={failedExit||feedback?.error?'catalog-error':'catalog-info'} role={failedExit||feedback?.error?'alert':'status'}>{failedExit?'No se pudo enviar la respuesta: '+exitOp.error:exitOp?'Respuesta guardada. Se enviará automáticamente.':feedback?.id&&['waiting','review','incident','delivered'].includes(s.exit_state)&&!s.local_pending?'Situación registrada.':feedback?.text}</p>}
 {s.position>0&&s.outside_at&&!s.departed_at&&canEdit&&!closed&&!exitOp&&<form className="gps-exit-form" onSubmit={e=>submitExit(e,s)}>
 <h4>¿Saliste después de entregar o continuarás esperando?</h4><label>Situación<select name="choice" required defaultValue=""><option value="" disabled>Selecciona</option>{!['partial','rejected','failed'].includes(s.outcome)&&<option value="delivered">Ya entregué · subiré el documento pendiente</option>}{['partial','rejected','failed'].includes(s.outcome)&&<option value="incident">Salí con incidencia de entrega registrada</option>}<option value="waiting" disabled={s.exit_state==='waiting'}>No me recibieron · sigo esperando (hotel/comida/estacionamiento)</option><option value="review" disabled={s.exit_state==='review'}>Otra novedad · requiere revisión</option></select></label><label>Motivo / detalle<textarea name="reason" maxLength="1000" placeholder="Obligatorio si sigues esperando o registras otra novedad"/></label>
 <p>{user.role==='admin'?'Si confirmas entrega, el stand by se detiene desde la salida física. Si sigues esperando, puede sumar $60 al cambiar de día. Sin respuesta u otra novedad, los cargos posteriores a esta salida quedan sin generar hasta aclararla.':'Indica si completaste la entrega, si sigues esperando o si hubo una novedad.'}</p><button disabled={busy}>{busy?'Guardando respuesta…':'Confirmar situación'}</button></form>}
 {!!s.exit_history?.length&&<details><summary>Historial de salidas y regresos</summary>{s.exit_history.map((h,i)=><p key={i}>{date(h.at)} · {{exit:'Salida física',return:'Regreso al lugar',decision:'Respuesta del conductor',documented_after_exit:'Documento registrado tras salir'}[h.event]||h.event}{h.choice?' · '+({delivered:'Entregado',waiting:'Continúa esperando',review:'Novedad en revisión',incident:'Salida con incidencia registrada'}[h.choice]||h.choice):''}{h.reason?' · '+h.reason:''}</p>)}</details>}
 </article>})}
 <p>El viaje finaliza con la salida definitiva del último destino y todos los puntos documentados.</p>
 {data.samples.length>0&&<details><summary>Recorrido GPS registrado · {data.sample_count??data.samples.filter(s=>!s.local_pending).length} coordenadas confirmadas · {data.samples.filter(s=>s.local_pending).length} locales pendientes</summary>{data.sample_count>data.samples.length&&<small>Vista resumida de todo el recorrido; las coordenadas completas se conservan en el servidor.</small>}<TripMap gps events={data.samples.map(s=>({...s,created_at:s.device_at}))}/></details>}
 </section>;
}
