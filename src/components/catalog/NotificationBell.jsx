import {useEffect,useId,useRef,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {api} from '../../services/api.js';
import {alertSettings,saveAlertSettings,notifyAlert} from '../../services/native/alerts.js';
import {nativeLocation} from '../../services/native/location.js';
import {Device} from '../../services/native/device.js';
import './styles/NotificationBell.css';

const unreadNotice=n=>!n.read_at&&n.email_status!=='cancelled';
const noticeKey=n=>n.kind+':'+n.id;

export default function NotificationBell({user,onOpenInbox,onOpenTrip,onCount}){
 const [rows,setRows]=useState([]),[view,setView]=useState(null),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false);
 const [preferences,setPreferences]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[feedback,setFeedback]=useState('');
 const root=useRef(null),trigger=useRef(null),closeButton=useRef(null),settingsButton=useRef(null);
 const previousView=useRef(null),loadRef=useRef(()=>{}),callbacks=useRef(null);
 const panelId=useId(),titleId=useId();
 callbacks.current={onCount,onOpenInbox,onOpenTrip};

 useEffect(()=>{
  let alive=true,request=0,seen=null;
  setRows([]);setLoaded(false);setFailed(false);setPreferences(null);setView(null);setError('');setFeedback('');setBusy(false);
  alertSettings(user.id).then(value=>{if(alive)setPreferences(value);});
  async function load(){
   const sequence=++request;
   try{
    const data=await api('/inbox');
    if(!alive||sequence!==request)return;
    const unread=data.filter(unreadNotice),keys=new Set(unread.map(noticeKey));
    const fresh=seen&&unread.find(n=>!seen.has(noticeKey(n))&&!(nativeLocation&&n.kind==='trip'&&String(n.phase).startsWith('salida:')));
    seen=keys;
    setRows(data);setLoaded(true);setFailed(false);callbacks.current.onCount(unread.length);
    if(fresh)notifyAlert(user.id,fresh).catch(e=>{if(alive)setError(e.message);});
   }catch{if(alive&&sequence===request){setLoaded(true);setFailed(true);}}
  }
  loadRef.current=load;
  load();
  const timer=setInterval(load,15000);
  window.addEventListener('guayaca:gps-updated',load);
  window.addEventListener('guayaca:notifications-updated',load);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('guayaca:gps-updated',load);window.removeEventListener('guayaca:notifications-updated',load);};
 },[user.id]);

 useEffect(()=>{
  if(!view){previousView.current=null;return;}
  if(view==='list'&&previousView.current==='settings')settingsButton.current?.focus();
  else closeButton.current?.focus();
  previousView.current=view;
  const outside=e=>{if(!root.current?.contains(e.target))setView(null);};
  const escape=e=>{if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();setView(null);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside,true);
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape);};
 },[view]);

 function close(){setView(null);trigger.current?.focus();}
 async function select(n){
  const read=()=>api(n.kind==='trip'?`/inbox/${n.id}/read`:`/notifications/${n.id}/read`,{method:'PATCH'}).then(()=>loadRef.current());
  if(n.kind==='trip'){setView(null);read().catch(()=>{});callbacks.current.onOpenTrip(n.trip_id,n);return;}
  try{await read();setView(null);callbacks.current.onOpenInbox();}catch(e){setError(e.message);}
 }
 async function configure(action,message){
  if(busy||!preferences)return;
  setBusy(true);setError('');setFeedback('');
  try{await action();setFeedback(message||'');}catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const count=rows.filter(unreadNotice).length;
 const settings=view==='settings';
 return <div className="notification-bell-wrap" ref={root}>
  <button ref={trigger} type="button" className="notification-bell" aria-label={`Notificaciones${count?', '+count+' sin leer':''}`} aria-expanded={!!view} aria-controls={view?panelId:undefined} aria-haspopup="dialog" onClick={()=>{if(view)setView(null);else{setError('');setFeedback('');setView('list');loadRef.current();}}}>
   <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 5-3 7-3 9h18c0-2-3-4-3-9M10 21h4"/></svg>{count>0&&<b>{count}</b>}
  </button>
  {view&&<section id={panelId} className="notification-popover" role="dialog" aria-labelledby={titleId}>
   <header className="notification-popover-head">
    <div><h2 id={titleId}>{settings?'Configuración de notificaciones':'Notificaciones'}</h2><small>{settings?'Elige cómo quieres recibir los avisos.':count?`${count} sin leer`:'Estás al día'}</small></div>
    <button ref={closeButton} type="button" className="notification-close" onClick={close} aria-label="Cerrar notificaciones">×</button>
   </header>
   {settings?<div className="notification-settings">
    <button type="button" className="notification-nav" onClick={()=>{setError('');setFeedback('');setView('list');}}>← Volver a notificaciones</button>
    <fieldset disabled={busy||!preferences}>
     <legend>Preferencias del dispositivo</legend>
     {[['sound','Sonido','Reproduce un tono con el aviso.'],['vibration','Vibración','Haz que el teléfono vibre con el aviso.']].map(([key,label,hint])=><label className="notification-setting" key={key}>
      <span><strong>{label}</strong><small>{hint}</small></span>
      <input type="checkbox" role="switch" checked={!!preferences?.[key]} onChange={e=>{const checked=e.target.checked;configure(async()=>setPreferences(await saveAlertSettings(user.id,{...preferences,[key]:checked})),'Preferencia guardada.');}}/>
     </label>)}
    </fieldset>
    <div className="notification-settings-actions">
     <button type="button" disabled={busy||!preferences||(!preferences.sound&&!preferences.vibration)} onClick={()=>configure(()=>notifyAlert(user.id,undefined,true),'Prueba enviada.')}>Probar sonido y vibración</button>
     {Capacitor.getPlatform()==='android'&&<button type="button" className="secondary" disabled={busy||!preferences} onClick={()=>configure(()=>Device.openAlertSettings({owner:String(user.id),...preferences}))}>Cambiar tono en Android</button>}
    </div>
    {nativeLocation&&<p className="notification-hint">El sonido y la vibración respetan los permisos y ajustes de Android.</p>}
    {feedback&&<p className="notification-feedback" role="status">{feedback}</p>}
   </div>:<>
    <button ref={settingsButton} type="button" className="notification-nav notification-settings-link" onClick={()=>{setError('');setFeedback('');setView('settings');}}>Configuración de notificaciones</button>
    <div className="notification-popover-list">
     {rows.slice(0,10).map(n=><button key={noticeKey(n)} type="button" className={'notification-item-preview'+(unreadNotice(n)?' is-unread':'')} onClick={()=>select(n)}><strong>{n.title}</strong><small>{n.message}</small></button>)}
     {!rows.length&&<p className="notification-empty">{failed?'No se pudieron cargar las notificaciones.':loaded?'No hay notificaciones para mostrar.':'Cargando notificaciones…'}</p>}
    </div>
    <footer className="notification-footer">
     <button type="button" className="secondary" onClick={()=>{setView(null);onOpenInbox();}}>Ver todas</button>
    </footer>
   </>}
   {error&&<p className="notification-error" role="alert">{error}</p>}
  </section>}
 </div>;
}
