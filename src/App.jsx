import {Device} from './services/native/device.js';
import {Capacitor} from '@capacitor/core';
import {cacheResponse} from './services/offline/queue.js';
import {AutoPrepareTrips} from './components/catalog/TripPreparation.jsx';
import {prepareTrip} from './services/offline/preparation.js';
import OfflinePanel from './components/catalog/OfflinePanel.jsx';
import GpsGuard from './components/catalog/GpsGuard.jsx';
import {currentSection,allowedSection,writeSection} from './services/navigation.js';
import Collections from './pages/Collections.jsx';
import GpsBanner from './components/catalog/GpsBanner.jsx';
import {stopGps} from './services/gps.js';
import Notifications from './pages/Notifications.jsx';
import Maintenances from './pages/Maintenances.jsx';
import Catalog from './pages/Catalog.jsx';
import Zones from './pages/Zones.jsx';
import LoadingOverlay from './components/common/LoadingOverlay.jsx';
import './components/layout/styles/AppLayout.css';
import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import { useEffect, useState, useRef, useCallback } from "react";
import { api, getBearer, setBearer } from "./services/api.js";
import Login from "./pages/auth/Login.jsx";
import Trip from "./pages/Trip.jsx";
import Storage from "./pages/Storage.jsx";
import Trips from "./pages/Trips.jsx";
import Reports from "./pages/Reports.jsx";
import Vehicles from "./pages/Vehicles.jsx";
import Users from "./pages/Users.jsx";
import Activity from "./pages/Activity.jsx";
import Control from "./pages/Control.jsx";
import Profile from "./pages/Profile.jsx";
import ActivateAccount from "./pages/auth/ActivateAccount.jsx";
const android=Capacitor.getPlatform()==='android';
const nativeLogin=android?{client:'android'}:{};
async function sessionRequest(path,options={},timeout=8000){
  if(!android)return api(path,options);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{return await api(path,{...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
}
export default function App() {
  const [user, setUser] = useState(null),
    [section, SetSection] = useState(currentSection),
    [message, M] = useState(""),
    [trip, T] = useState(null),
    [data, D] = useState([]),
    [users, U] = useState([]),
    [vehicles, V] = useState([]),
    [storage, ST] = useState(null),
    [control, SetControl] = useState(null),
    [audit, A] = useState([]),
    [loading, Ld] = useState(false),
    [step, Step] = useState(null),
    [challenge, C] = useState("");
  const [restorePending,setRestorePending]=useState(()=>android&&!!getBearer());
  function S(value){const next=user?allowedSection(user,value):value;SetSection(next);writeSection(next);}
  useEffect(()=>{const pop=()=>{if(!user)return;const next=allowedSection(user,currentSection());SetSection(next);T(null);writeSection(next,true)};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[user]);
  const [activationToken, setActivationToken] = useState(() => {
    const prefix = '#/activar-cuenta?';
    if (!window.location.hash.startsWith(prefix)) return '';
    const value = new URLSearchParams(window.location.hash.slice(prefix.length)).get('token') || '';
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return value;
  });
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('guayaca_sidebar_collapsed') === 'true'; } catch { return false; } });
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeMenu = useCallback((restoreFocus = false) => { setMenuOpen(false); if (restoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus()); }, []);
  useEffect(() => { const media = window.matchMedia('(max-width: 760px)'); const change = e => { setMobile(e.matches); setMenuOpen(false); }; media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  useEffect(() => { if (!mobile || !menuOpen) return; const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, [mobile, menuOpen]);
  const toggleCollapsed = () => setCollapsed(value => { const next = !value; try { localStorage.setItem('guayaca_sidebar_collapsed', String(next)); } catch {} return next; });
  const [loadingText, setLoadingText] = useState('Cargando información…');
  const admin = user?.role === "admin";
  const [notificationCount,SetNotificationCount]=useState(0);

  const run = async (fn, label) => {
    try {
      M("");
      const sections = { viajes:'Cargando viajes…', reportes:'Cargando resultados…', usuarios:'Cargando usuarios…', vehiculos:'Cargando vehículos…', actividad:'Cargando actividad…', almacenamiento:'Consultando almacenamiento…', control:'Actualizando control de viajes…' };
      setLoadingText(label || (user ? sections[section] || 'Procesando información…' : 'Verificando tu acceso…'));
      Ld(true);
      await fn();
    } catch (e) {
      M(e.message);
    } finally {
      Ld(false);
    }
  };
  function openSession(u){
    setUser(u);
    const target=allowedSection(u,currentSection());SetSection(target);writeSection(target,true);
  }
  async function restoreSession(){
    if(!getBearer())return;
    await run(async()=>{
      try{
        openSession(await sessionRequest('/me'));
        setRestorePending(false);
      }catch(e){
        if(!android||e.status===401||e.status===403){
          await clearSession(android?'Tu sesión ya no está autorizada. Vuelve a ingresar.':'');
        }else{
          setRestorePending(true);
          M('No pudimos comprobar tu sesión. Sigue guardada en el dispositivo; vuelve a intentar cuando tengas conexión.');
        }
      }
    });
  }
  useEffect(()=>{restoreSession()},[]);
  useEffect(()=>{
    if(!restorePending||user)return;
    const retry=()=>restoreSession();
    window.addEventListener('online',retry);
    return ()=>window.removeEventListener('online',retry);
  },[restorePending,user]);
  async function refresh() {
    if (!user) return;
    if (section === "viajes" || section === "reportes") {
      const rows=await api('/trips');D(rows);
      if(navigator.onLine!==false)await Promise.allSettled(rows.filter(t=>String(t.driver_id)===String(user.id)&&['creado','en_curso'].includes(t.status)).map(t=>prepareTrip(t.id)));
      if (admin) {
        U(await api("/users"));
        V(await api("/vehicles"));
      }
    } else if (section === "usuarios") U(await api("/users"));
    else if (section === "vehiculos") V(await api("/vehicles"));
    else if (section === "almacenamiento") ST(await api("/storage"));
    else if (section === "actividad") A(await api("/audit"));
    else if (section === "control") SetControl(await api("/control-map"));
  }
  useEffect(() => {
    if (user) run(refresh);
  }, [user, section]);
  async function login(e) {
    e.preventDefault();
    let f = new FormData(e.currentTarget);
    await run(async () => {
      let r = step
        ? await api("/auth/code", {
            method: "POST",
            body: { step, challenge, code: f.get("code"), ...nativeLogin },
          })
        : await api("/auth/login", {
            method: "POST",
            body: {...Object.fromEntries(f),...nativeLogin},
          });
      if (r.step) {
        Step(r.step);
        C(r.challenge);
      } else {
        await setBearer(r.token);
        sessionStorage.setItem("token", r.token);
        if(android)await cacheResponse('/me',r.user).catch(()=>{});
        openSession(r.user);
        Step(null);
      }
    }, step ? 'Verificando el código…' : 'Iniciando sesión…');
  }
  async function clearSession(message = '') {
    stopGps();
    sessionStorage.removeItem('token');
    await setBearer('');
    setRestorePending(false);
    setUser(null); T(null); D([]); U([]); V([]); ST(null); A([]); SetControl(null); Step(null); setMenuOpen(false); S('viajes'); M(message);
  }
  async function exit() {
    setLoadingText('Cerrando sesión…');
    Ld(true);
    let warning = '';
    try { await sessionRequest('/auth/logout',{method:'POST'},5000); }
    catch { warning = 'La sesión se cerró en este dispositivo, pero no se pudo confirmar el cierre en el servidor.'; }
    finally { try{await clearSession(warning)}catch(e){M(e.message)}finally{Ld(false)} }
  }
  const [noticeTarget,setNoticeTarget]=useState(null);
  async function openNoticeTrip(id,notice){
    await run(async()=>{await detail(id);setNoticeTarget(notice&&(notice.stop_id!=null||notice.position!=null)?{...notice,trip_id:id}:null);S('viajes');},'Abriendo viaje…');
  }
  useEffect(()=>{
    if(!android||!user)return;
    let active=true,listener;
    const take=async()=>{try{const target=await Device.takeAlertTarget();if(active&&target.trip_id&&String(target.owner)===String(user.id))await openNoticeTrip(target.trip_id,target);}catch{}};
    Device.addListener('tripAlertOpened',take).then(h=>{if(active){listener=h;take()}else h.remove()}).catch(()=>{});
    return()=>{active=false;listener?.remove()};
  },[user?.id]);
  async function detail(id) {
    T(await api("/trips/" + id));prepareTrip(id).catch(()=>{});
  }
  const submit = (url, after) => (e) => {
    e.preventDefault();
    let form = e.currentTarget,
      body = Object.fromEntries(new FormData(form));
    if(url === "/trips")body.destination_ids=new FormData(form).getAll("destination_ids");
    run(async () => {
      await api(url, { method: "POST", body });
      form.reset();
      await after();
      M("Guardado correctamente");
    }, 'Guardando información…');
  };
  if (activationToken) return <ActivateAccount token={activationToken} onBack={async () => { if (getBearer()) { try { await api('/auth/logout',{method:'POST'}); } catch {} } await clearSession(); setActivationToken(''); }}/>;
  if(restorePending&&!user)return <main className="login"><div className="loginbox">
    <img src="/logo.png" alt="GUAYACA"/><h1>Tu sesión está guardada</h1>
    <p>{message||'Estamos recuperando tu acceso…'}</p>
    <div className="modal-actions"><button disabled={loading} onClick={restoreSession}>Reintentar</button><button disabled={loading} className="secondary" onClick={exit}>Cerrar sesión</button></div>
    {loading&&<LoadingOverlay message={loadingText}/>}
  </div></main>;
  if (!user)
    return (
      <>
        <Login step={step} login={login} loading={loading} message={message} Step={Step}/>
        {loading && <LoadingOverlay message={loadingText}/>}
      </>
    );
  return (
    <div className={'layout'+(collapsed ? ' sidebar-collapsed' : '')}>
      <Header onNotificationCount={SetNotificationCount} onOpenInbox={()=>{S("notificaciones");T(null);setMenuOpen(false)}} onOpenTrip={openNoticeTrip} user={user} exit={exit} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(value => !value)} menuButtonRef={menuButtonRef} onOpenProfile={() => {S("perfil");T(null);setMenuOpen(false)}}/>
      <Sidebar notificationCount={notificationCount} admin={admin} user={user} section={section} S={S} T={T} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} mobile={mobile} open={menuOpen} onClose={closeMenu}/>
      {loading && <LoadingOverlay message={loadingText}/>}
      <AutoPrepareTrips user={user}/><GpsBanner/><GpsGuard user={user}/>
      <main className="content"><OfflinePanel user={user}/>
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        {section === "notificaciones" && <Notifications admin={admin} onOpenTrip={openNoticeTrip}/>}
        {section === "mantenimientos" && admin && <Maintenances/>}
        
        {section === "cobros" && admin && <Collections/>}
        {section === "lugares" && admin && <Catalog key="places" places/>}
        {section === "zonas" && admin && <Zones/>}
        {section === "perfil" && <Profile user={user} run={run} onUpdated={updated => { setUser({...updated, photo_revision: Date.now()}); M('Perfil actualizado correctamente.'); }}/>} 
        {section === "sin_acceso" && (
          <p>
            Su cuenta no tiene módulos habilitados. Solicite acceso al
            administrador.
          </p>
        )}
        {section === "viajes" && !trip && (
          <Trips
            {...{
              admin,
              data,
              users,
              vehicles,
              run,
              refresh,
              submit,
              detail,
              audit,
            }}
          />
        )}
        {section === "viajes" && trip && (
          <Trip
            key={trip.trip.id}
            detail={trip}
            noticeTarget={noticeTarget}
            onNoticeFocused={()=>setNoticeTarget(null)}
            refresh={() => detail(trip.trip.id)}
            back={() => {
              T(null);
              setNoticeTarget(null);
              run(refresh);
            }}
            run={run}
            admin={admin}
            currentUser={user}
          />
        )}
        {section === "reportes" && (
          <Reports canOpenTrip={admin||user.permissions.includes("viajes")} onOpenTrip={async id=>{await detail(id);S("viajes")}}
            {...{
              admin,
              data,
              users,
              vehicles,
              run,
              refresh,
              submit,
              detail,
              audit,
            }}
          />
        )}
        {section === "vehiculos" && (
          <Vehicles
            {...{
              admin,
              data,
              users,
              vehicles,
              run,
              refresh,
              submit,
              detail,
              audit,
              M,
              message,
            }}
          />
        )}
        {section === "control" && admin && <Control data={control} loading={loading} onRefresh={() => run(refresh)} onOpenTrip={id => run(async () => { await detail(id); S("viajes"); })}/>}
        {section === "usuarios" && (
          <Users
            {...{
              admin,
              data,
              users,
              vehicles,
              run,
              refresh,
              submit,
              detail,
              audit,
              M,
              currentUser: user,
              message,
              clearSession,
            }}
          />
        )}
        {section === "actividad" && (
          <Activity
            {...{
              admin,
              data,
              users,
              vehicles,
              run,
              refresh,
              submit,
              detail,
              audit,
            }}
          />
        )}
        {section === "almacenamiento" && storage && (
          <Storage data={storage} run={run} refresh={refresh} />
        )}
      </main>
    </div>
  );
}
