import {nativeLocation} from '../../services/native/location.js';
import {Device} from '../../services/native/device.js';
import TripPreparation from './TripPreparation.jsx';
import {prepareTrip} from '../../services/offline/preparation.js';
import {projectedTrip} from '../../services/offline/projection.js';
import {pendingOperations} from '../../services/offline/queue.js';
import DocumentInput from '../common/DocumentInput.jsx';
import {useEffect,useRef,useState} from 'react';
import {api,download} from '../../services/api.js';
import {date} from '../../services/format.js';
import {gpsStatus} from '../../services/gps.js';
import RouteMap from './RouteMap.jsx';
import CatalogModal from './CatalogModal.jsx';
import RouteExpense from './RouteExpense.jsx';
import RouteIncident,{incidentLabels} from './RouteIncident.jsx';
import './styles/Gps.css';
const maps=p=>'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',destination:p.latitude+','+p.longitude,travelmode:'driving',dir_action:'navigate'});
export default function GpsTrip({trip,user,onUpdated,noticeTarget,onNoticeFocused}){
 const [offline,Offline]=useState(navigator.onLine===false),[pending,Pending]=useState([]),[data,D]=useState({stops:[],samples:[]}),[tracking,T]=useState(gpsStatus()),[error,E]=useState(''),[busy,B]=useState(false);
 const [panel,Panel]=useState(null),[position,Position]=useState(0),[saved,Saved]=useState('');
 const pointRefs=useRef(new Map());
 const [exitFeedback,SetExitFeedback]=useState({});
 const admin=user.role==='admin',own=String(user.id)===String(trip.driver_id),canEdit=own||user.role==='admin',closed=['finalizado','cancelado'].includes(trip.status),points=[trip.metadata.origin_place,...trip.metadata.destination_places];
 useEffect(()=>{prepareTrip(trip.id).catch(()=>{})},[trip.id]);
 async function load(){try{
  const local=await projectedTrip(trip.id);if(local)D(local);
  if(navigator.onLine!==false){const server=await api(`/trips/${trip.id}/gps-state`,{signal:AbortSignal.timeout(8000)});const next=await projectedTrip(trip.id,server);if(next)D(next);}
 }catch(e){if(e.status)E(e.message);}}
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
 const visibleStops=data.stops.length?data.stops:points.map((place,position)=>({id:'local-'+position,place,position}));
 useEffect(()=>{
  if(!noticeTarget||String(noticeTarget.trip_id)!==String(trip.id))return;
  const stop=visibleStops.find(s=>noticeTarget.stop_id!=null?String(s.id)===String(noticeTarget.stop_id):s.position===Number(noticeTarget.position));
  if(stop&&!admin&&(panel!=='documents'||position!==stop.position)){Position(stop.position);Panel('documents');return;}
  const card=stop&&pointRefs.current.get(stop.position);if(!card)return;
  const form=card.querySelector('details.gps-documents');if(form)form.open=true;
  const input=form?.querySelector('input[name="odometer"]')||card.querySelector('.gps-exit-form select')||card;
  input.focus({preventScroll:true});input.scrollIntoView({block:'center'});onNoticeFocused?.();
 },[noticeTarget,visibleStops,trip.id,onNoticeFocused,admin,panel,position]);
 const routeDone=data.stops.length>0&&data.stops.every(s=>s.departed_at);
 const trackHere=String(tracking.trip_id)===String(trip.id);
 const fix=!admin&&trackHere?tracking.fix:null;
 const openDocuments=()=>{const relevant=visibleStops.find(s=>s.outside_at&&!s.departed_at)||[...visibleStops].reverse().find(s=>s.arrived_at&&!s.departed_at)||visibleStops.find(s=>!s.departed_at)||visibleStops[0];Position(relevant?.position??0);E('');Panel('documents');};
 const cards=(stops)=>stops.map(s=>{const localPending=pending.some(o=>o.kind==='point'&&o.position===s.position);const done=(s.arrival_file_id||s.document_waived)&&s.arrival_odometer!=null;const exitOp=pending.find(o=>o.kind==='exit'&&o.position===s.position),feedback=exitFeedback[s.position];
 const failedExit=exitOp&&['conflict','auth'].includes(exitOp.state);
 const incidentOp=pending.find(o=>o.kind==='outcome'&&Number(o.body?.position)===s.position);
 const incident=incidentLabels[s.outcome];
 const docsLabel=localPending?'Guía guardada en el dispositivo':done?'Guía y kilometraje registrados':closed?'Sin documento registrado':'Adjuntar guía y kilometraje';
 return <article className="catalog-card" tabIndex={-1} ref={node=>{if(node)pointRefs.current.set(s.position,node);else pointRefs.current.delete(s.position)}} key={s.id}>
 <h3 className="route-stop-heading">{s.position===0?'Embarque':'Entrega '+s.position} · {s.place.name}</h3>
 {admin?<p>Llegada: {s.arrived_at?date(s.arrived_at):'Pendiente de GPS'} · Salida definitiva: {s.departed_at?date(s.departed_at):'Pendiente'}</p>:<dl className="route-stop-times"><div><dt>Llegada</dt><dd>{s.arrived_at?date(s.arrived_at):'Pendiente de GPS'}</dd></div><div><dt>Salida definitiva</dt><dd>{s.departed_at?date(s.departed_at):'Pendiente'}</dd></div></dl>}
 {s.arrived_at&&<p>Tiempo desde llegada: {Math.max(0,Math.round((new Date(s.departed_at||trip.test_clock||Date.now())-new Date(s.arrived_at))/60000))} minutos · incluye la espera temporal fuera del lugar.</p>}

 {s.outside_at&&!s.departed_at&&<p className="catalog-info">Salida física: {date(s.outside_at)} · {s.exit_state==='waiting'?user.role==='admin'?'Sigue esperando fuera del lugar. El stand by puede continuar.':'Sigue esperando fuera del lugar.':s.exit_state==='review'?'Novedad pendiente de revisión.':'Confirma qué ocurrió en esta entrega.'} {s.exit_reason}</p>}
 {(s.arrived_at||offline||!admin&&!closed)&&<div className="gps-requirement">{localPending&&<p className="catalog-info">Datos guardados en este dispositivo. Pendiente de confirmación del servidor; revisa Sincronización.</p>}{!s.arrived_at&&(offline||!admin)&&<p>La llegada todavía no está confirmada. Puedes guardar los datos; el servidor validará la llegada con las coordenadas al sincronizar.</p>}<strong>{admin?(done?'Punto documentado · '+s.arrival_odometer+' km':localPending?'Guía y kilometraje guardados':s.outside_at?'Completa los datos pendientes':'Puedes adjuntar la guía antes de salir'):docsLabel}</strong>
 {!done&&!localPending&&canEdit&&!closed&&<details className="gps-documents" open={!admin||!!s.outside_at||undefined}><summary>{s.position===0?'Adjuntar guía':'Adjuntar guía de entrega'}</summary><form onSubmit={e=>{e.preventDefault();const body=new FormData(e.currentTarget);body.set('phase','arrival');run(()=>api(`/trips/${trip.id}/stops/${s.id}/complete`,{method:'POST',body,position:s.position}))}}>
 <label>Kilometraje del punto<input name="odometer" required type="number" min="0" step="0.1"/></label><label>{s.position===0?'Guía principal de embarque':['partial','rejected','failed'].includes(s.outcome)?'Documento de soporte de la incidencia':'Documento de entrega (confirma recepción)'}<DocumentInput name="file" required multiple/></label><button disabled={busy}>{busy?'Guardando todas las hojas…':'Guardar guía y kilometraje'}</button></form></details>}
 {!!(s.arrival_file_ids?.length||s.arrival_file_id)&&<p>Adjuntos: {s.arrival_file_ids?.length||1}. {localPending?'Pendientes de confirmación.':(s.arrival_file_ids?.length?s.arrival_file_ids:[s.arrival_file_id]).map((id,i)=><button type="button" className="link" key={id} disabled={String(id).startsWith('pending-')} onClick={()=>run(()=>download(id,s.document_files?.find(f=>String(f.id)===String(id))?.original_name||('guia-'+s.position+'-hoja-'+(i+1))))}>Descargar archivo {i+1}</button>)}</p>}{s.document_waived&&<p>Documento eximido por el administrador con motivo e historial.</p>}</div>}
 {(exitOp||feedback)&&<p className={failedExit||feedback?.error?'catalog-error':'catalog-info'} role={failedExit||feedback?.error?'alert':'status'}>{failedExit?'No se pudo enviar la respuesta: '+exitOp.error:exitOp?'Respuesta guardada. Se enviará automáticamente.':feedback?.id&&['waiting','review','incident','delivered'].includes(s.exit_state)&&!s.local_pending?'Situación registrada.':feedback?.text}</p>}
 {s.position>0&&s.outside_at&&!s.departed_at&&canEdit&&!closed&&!exitOp&&<form className="gps-exit-form" onSubmit={e=>submitExit(e,s)}>
 <h4>¿Saliste después de entregar o continuarás esperando?</h4><label>Situación<select name="choice" required defaultValue=""><option value="" disabled>Selecciona</option>{!['partial','rejected','failed'].includes(s.outcome)&&<option value="delivered">Ya entregué · subiré el documento pendiente</option>}{['partial','rejected','failed'].includes(s.outcome)&&<option value="incident">Salí con incidencia de entrega registrada</option>}<option value="waiting" disabled={s.exit_state==='waiting'}>No me recibieron · sigo esperando (hotel/comida/estacionamiento)</option><option value="review" disabled={s.exit_state==='review'}>Otra novedad · requiere revisión</option></select></label><label>Motivo / detalle<textarea name="reason" maxLength="1000" placeholder="Obligatorio si sigues esperando o registras otra novedad"/></label>
 <p>{user.role==='admin'?'Si confirmas entrega, el stand by se detiene desde la salida física. Si sigues esperando, puede sumar $60 al cambiar de día. Sin respuesta u otra novedad, los cargos posteriores a esta salida quedan sin generar hasta aclararla.':'Indica si completaste la entrega, si sigues esperando o si hubo una novedad.'}</p><button disabled={busy}>{busy?'Guardando respuesta…':'Confirmar situación'}</button></form>}
 {!admin&&s.position>0&&(incident||incidentOp||s.arrived_at&&canEdit&&!closed)&&<section className="route-incident">
  {incident&&<div><strong>{incident}</strong>{s.outcome_note&&<p>{s.outcome_note}</p>}{s.delivered_tons!=null&&Number(s.delivered_tons)>0&&<p>Entregado: {s.delivered_tons} t</p>}{s.exception_resolved===false&&!incidentOp&&<small>Pendiente de revisión administrativa.</small>}</div>}
  {incidentOp&&<p className={['auth','conflict'].includes(incidentOp.state)?'catalog-error':'catalog-info'} role="status">{['auth','conflict'].includes(incidentOp.state)?'No se pudo sincronizar la incidencia. '+(incidentOp.error||'Revisa la cola de sincronización.'):'Incidencia guardada en el dispositivo. Se enviará al recuperar conexión.'}</p>}
  {s.arrived_at&&canEdit&&!closed&&s.exception_resolved!==false&&!incidentOp&&<RouteIncident key={s.position} trip={trip} position={s.position} busy={busy} onBusy={B} onSaved={async result=>{if(result.queued){Pending((await pendingOperations()).filter(o=>String(o.trip_id)===String(trip.id)));const projected=await projectedTrip(trip.id);if(projected)D(projected);}else{await load();await onUpdated();}window.dispatchEvent(new Event('guayaca:trips-changed'));}}/>}
 </section>}
 {!!s.exit_history?.length&&<details><summary>Historial de salidas y regresos</summary>{s.exit_history.map((h,i)=><p key={i}>{date(h.at)} · {{exit:'Salida física',return:'Regreso al lugar',decision:'Respuesta del conductor',documented_after_exit:'Documento registrado tras salir'}[h.event]||h.event}{h.choice?' · '+({delivered:'Entregado',waiting:'Continúa esperando',review:'Novedad en revisión',incident:'Salida con incidencia registrada'}[h.choice]||h.choice):''}{h.reason?' · '+h.reason:''}</p>)}</details>}
 </article>});
 return <section className={'gps-trip'+(!admin?' gps-trip-driver':'')}>
  {admin&&<h2>{trip.is_test?'Mapa de simulación':'Mapa del viaje'}</h2>}
  <RouteMap route={trip.metadata.route} points={points} samples={data.samples||[]} fix={fix} follow={!admin} offline={offline}/>
  <div className="route-nav" aria-label="Navegar a un punto">{points.map((p,i)=><a key={i} href={maps(p)} target="_blank" rel="noreferrer" title={p.name}>{i===0?'Ir a embarque':'Entrega '+i}</a>)}</div>
  {!admin&&<div className="route-actions"><button type="button" onClick={openDocuments}>{closed?'Ver documentos':'Registrar documentos'}</button>{!closed&&<button type="button" className="secondary" onClick={()=>Panel('expenses')}>Registrar gastos</button>}</div>}
  <p className="route-state" role="status">
    {admin?<span>{data.samples?.length?'Último punto sincronizado: '+date(data.samples.at(-1).device_at):'Aún no hay ubicaciones sincronizadas.'}</span>:<strong>{closed?'Viaje '+trip.status:routeDone?'Recorrido terminado':trackHere?tracking.message:'Preparando seguimiento GPS…'}</strong>}
    {!admin&&data.local_projection&&<span>Datos guardados pendientes de sincronización</span>}
  </p>
  {!admin&&!nativeLocation&&!closed&&<small>En la web, mantén GUAYACA abierta para registrar el recorrido.</small>}
  {!admin&&nativeLocation&&!closed&&!routeDone&&<details className="gps-diagnostics">
    <summary>Seguimiento con la pantalla cerrada</summary>
    <p>{trackHere&&tracking.lastCapturedAt?'Último punto guardado: '+date(tracking.lastCapturedAt):'Espera la primera ubicación antes de cerrar la pantalla.'}</p>
    {trackHere&&tracking.notificationsEnabled===false&&<p>Activa las notificaciones de GUAYACA y el canal de avisos de viaje.</p>}
    {trackHere&&tracking.batteryOptimized===true&&<p>En los ajustes de GUAYACA, revisa Batería y permite el uso en segundo plano o elige «Sin restricciones» si aparece.</p>}
    <p>Antes de salir de la app, comprueba que la notificación de seguimiento indique «Recibiendo ubicación del viaje».</p>
    <button type="button" className="secondary" onClick={()=>Device.openTrackingSettings().catch(e=>E(e.message))}>Abrir ajustes de Android</button>
  </details>}
  {admin&&<>{Number(trip.metadata.route?.distance_m)>0&&<p className="route-state">Ruta sugerida: {(Number(trip.metadata.route.distance_m)/1000).toLocaleString('es-EC',{maximumFractionDigits:1})} km · {Math.round(Number(trip.metadata.route.duration_s||0)/60)} min estimados</p>}<TripPreparation id={trip.id}/>{data.stops.some(s=>s.arrived_at)&&<p><strong>Orden real de llegadas:</strong> {data.stops.filter(s=>s.arrived_at).sort((a,b)=>new Date(a.arrived_at)-new Date(b.arrived_at)).map(s=>s.place.name).join(' → ')}</p>}<h2>Llegadas, salidas y pendientes</h2>{cards(visibleStops)}</>}
  {saved&&<p className="catalog-info" role="status">{saved}</p>}
  {error&&panel!=='documents'&&<p className="catalog-error" role="alert">{error}</p>}
  {panel==='documents'&&<CatalogModal title="Documentos de ruta" eyebrow={'Viaje '+trip.code} routeVariant="documents" onClose={()=>Panel(null)} busy={busy}>
   <label className="route-doc-select"><span>Punto del viaje</span><select value={position} onChange={e=>Position(Number(e.target.value))}>{visibleStops.map(s=><option key={s.position} value={s.position}>{s.position?'Entrega '+s.position:'Embarque'} · {s.place.name}</option>)}</select><small>Consulta la llegada y la salida, adjunta la guía o registra una incidencia del punto seleccionado.</small></label>
   {error&&<p className="catalog-error" role="alert">{error}</p>}
   {cards(visibleStops.filter(s=>s.position===position))}
  </CatalogModal>}
  {panel==='expenses'&&<RouteExpense trip={trip} onClose={()=>Panel(null)} onSaved={message=>{Saved(message);Panel(null);}}/>}
 </section>;
}
