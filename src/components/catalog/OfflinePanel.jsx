import ResponsiveTable from '../common/ResponsiveTable.jsx';
import {useEffect,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {Network} from '@capacitor/network';
import {pendingOperations,startSync,syncNow,retryOperation} from '../../services/offline/queue.js';
import {persistStorage} from '../../services/offline/store.js';
import {applyWebUpdate} from '../../services/offline/update.js';
import CatalogModal from './CatalogModal.jsx';
import './styles/OfflinePanel.css';
const kinds={gps:'Coordenada GPS',point:'Guía y kilometraje',expense:'Gasto y comprobante',exit:'Situación de salida',outcome:'Incidencia de entrega'};
export default function OfflinePanel({user}){
 const [pending,P]=useState([]),[online,O]=useState(navigator.onLine!==false),[open,Open]=useState(false),[busy,B]=useState(false),[error,E]=useState(''),[sending,S]=useState(false),[update,U]=useState(false),[message,M]=useState('');
 const driver=user.role==='conductor';
 useEffect(()=>{
  let active=true,network,revision=0;
  const refresh=()=>{const seq=++revision;return pendingOperations().then(r=>{if(active&&seq===revision)P(r)}).catch(e=>{if(active&&seq===revision)E('Almacenamiento local: '+e.message)})};
  const on=()=>{O(true);refresh()},off=()=>O(false),err=e=>{if(!driver)E(e.detail)},available=()=>U(true),send=e=>S(e.detail);
  const listeners={'guayaca:outbox':refresh,online:on,offline:off,'guayaca:offline-error':err,'guayaca:update-ready':available,'guayaca:sending':send};
  for(const [event,fn] of Object.entries(listeners))window.addEventListener(event,fn);
  refresh();const stop=startSync();
  if(Capacitor.isNativePlatform())Network.addListener('networkStatusChange',s=>{if(!active)return;O(s.connected);if(s.connected)syncNow().catch(e=>{if(active)E(e.message)})}).then(h=>{if(active)network=h;else h.remove()}).catch(()=>{});
  return()=>{active=false;stop();network?.remove();for(const [event,fn] of Object.entries(listeners))window.removeEventListener(event,fn)};
 },[user.id,driver]);
 async function run(fn){B(true);E('');try{await fn();P(await pendingOperations())}catch(e){E(e.message)}finally{B(false)}}
 const review=pending.some(o=>o.state==='conflict'||o.state==='auth');
 const status=review?'Hay envíos por revisar':sending?'Sincronizando pendientes…':'Guardado. Se enviará automáticamente.';
 return <>{(pending.length>0||update||error)&&<div className={'offline-bar'+(review||error?' offline-warning':'')}><span role="status">{pending.length>0?status:error?'No se pudo comprobar el envío.':''}</span>{(review||error||!driver&&pending.length>0)&&<button className="secondary" onClick={()=>Open(true)}>Ver detalles</button>}{update&&<button onClick={()=>run(applyWebUpdate)}>Actualización disponible</button>}</div>}

 {open&&<CatalogModal title="Sincronización del dispositivo" busy={busy} busyLabel="Sincronizando operaciones pendientes…" onClose={()=>Open(false)}>{error&&<p className="catalog-error">{error}</p>}<p>Los datos y fotos permanecen guardados para tu cuenta hasta que el servidor confirme su recepción. Cerrar sesión no los borra. No desinstales la aplicación ni borres sus datos mientras haya pendientes.</p>{!driver&&<p>{Capacitor.isNativePlatform()?'Almacenamiento Android: SQLite privado de la aplicación.':'Almacenamiento web: IndexedDB del navegador.'} La copia de mapas de calles no está incluida.</p>}<div className="catalog-footer"><button disabled={busy||!online} onClick={()=>run(syncNow)}>Sincronizar ahora</button><button className="secondary" disabled={busy} onClick={()=>run(async()=>{for(const o of pending)if(['auth','conflict'].includes(o.state))await retryOperation(o.id);await syncNow()})}>Reintentar después de revisar</button>{!Capacitor.isNativePlatform()&&!driver&&<button className="secondary" onClick={()=>run(async()=>M(await persistStorage()?'Almacenamiento persistente solicitado.':'El navegador no concedió persistencia; conserva espacio y evita limpiar datos.'))}>Proteger almacenamiento web</button>}</div>{message&&<p className="catalog-info">{message}</p>}<p>Si hay un conflicto, revisa el viaje con el administrador y luego reintenta. Los errores de sesión requieren volver a iniciar sesión con conexión. Las operaciones posteriores del mismo viaje esperan para conservar el orden.</p>
 <div className="catalog-table"><ResponsiveTable primary={[0,2]}><thead><tr><th>Operación</th><th>Captura original</th><th>Estado / detalle</th><th>Acción</th></tr></thead><tbody>{pending.slice(0,100).map(o=><tr key={o.id}><td>{kinds[o.kind]}<small>Viaje #{o.trip_id}{o.position!=null?' · Punto '+o.position:''}</small></td><td>{new Date(o.captured_at).toLocaleString()}</td><td>{({pending:'Pendiente de envío',conflict:'Requiere revisión',auth:'Requiere iniciar sesión'})[o.state]||o.state}{o.error&&<small>{o.error}</small>}{(o.files||[o.file].filter(Boolean)).map((f,i)=><small key={i}>Adjunto {i+1} guardado: {f.name}</small>)}</td><td><button className="secondary" disabled={busy||!online} onClick={()=>run(()=>retryOperation(o.id))}>Reintentar</button></td></tr>)}</tbody></ResponsiveTable>{!pending.length&&<p>No hay datos pendientes de esta cuenta.</p>}</div><small>Se muestran los primeros 100 pendientes. Abre la aplicación para que pueda enviar los registros guardados.</small></CatalogModal>}</>;
}
