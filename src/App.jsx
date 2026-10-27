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
import Progress from "./pages/Progress.jsx";
import Control from "./pages/Control.jsx";
import Profile from "./pages/Profile.jsx";
import ActivateAccount from "./pages/auth/ActivateAccount.jsx";
export default function App() {
  const [user, setUser] = useState(null),
    [section, S] = useState("viajes"),
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
  useEffect(() => {
    if (getBearer())
      run(async () => {
        try {
          {
            let u = await api("/me");
            setUser(u);
            S(
              u.role === "admin" || u.permissions.includes("viajes")
                ? "viajes"
                : u.permissions.includes("reportes")
                  ? "reportes"
                  : "sin_acceso",
            );
          }
        } catch {
          sessionStorage.removeItem("token");
          setBearer("");
        }
      });
  }, []);
  async function refresh() {
    if (!user) return;
    if (section === "viajes" || section === "reportes") {
      D(await api("/trips"));
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
            body: { step, challenge, code: f.get("code") },
          })
        : await api("/auth/login", {
            method: "POST",
            body: Object.fromEntries(f),
          });
      if (r.step) {
        Step(r.step);
        C(r.challenge);
      } else {
        setBearer(r.token);
        sessionStorage.setItem("token", r.token);
        setUser(r.user);
        S(
          r.user.role === "admin" || r.user.permissions.includes("viajes")
            ? "viajes"
            : r.user.permissions.includes("reportes")
              ? "reportes"
              : "sin_acceso",
        );
        Step(null);
      }
    }, step ? 'Verificando el código…' : 'Iniciando sesión…');
  }
  function clearSession(message = '') {
    setBearer('');
    sessionStorage.removeItem('token');
    setUser(null); T(null); D([]); U([]); V([]); ST(null); A([]); SetControl(null); Step(null); setMenuOpen(false); S('viajes'); M(message);
  }
  async function exit() {
    setLoadingText('Cerrando sesión…');
    Ld(true);
    let warning = '';
    try { await api('/auth/logout', {method:'POST'}); }
    catch { warning = 'La sesión se cerró en este dispositivo, pero no se pudo confirmar el cierre en el servidor.'; }
    finally { clearSession(warning); Ld(false); }
  }
  async function detail(id) {
    T(await api("/trips/" + id));
  }
  const submit = (url, after) => (e) => {
    e.preventDefault();
    let form = e.currentTarget,
      body = Object.fromEntries(new FormData(form));
    run(async () => {
      await api(url, { method: "POST", body });
      form.reset();
      await after();
      M("Guardado correctamente");
    }, 'Guardando información…');
  };
  if (activationToken) return <ActivateAccount token={activationToken} onBack={async () => { if (getBearer()) { try { await api('/auth/logout',{method:'POST'}); } catch {} } clearSession(); setActivationToken(''); }}/>;
  if (!user)
    return (
      <>
        <Login step={step} login={login} loading={loading} message={message} Step={Step}/>
        {loading && <LoadingOverlay message={loadingText}/>}
      </>
    );
  return (
    <div className={'layout'+(collapsed ? ' sidebar-collapsed' : '')}>
      <Header user={user} exit={exit} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(value => !value)} menuButtonRef={menuButtonRef} onOpenProfile={() => {S("perfil");T(null);setMenuOpen(false)}}/>
      <Sidebar admin={admin} user={user} section={section} S={S} T={T} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} mobile={mobile} open={menuOpen} onClose={closeMenu}/>
      {loading && <LoadingOverlay message={loadingText}/>}
      <main className="content">
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
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
            detail={trip}
            refresh={() => detail(trip.trip.id)}
            back={() => {
              T(null);
              run(refresh);
            }}
            run={run}
            admin={admin}
          />
        )}
        {section === "reportes" && (
          <Reports
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
        {section === "avance" && (
          <Progress
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
