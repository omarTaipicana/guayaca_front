import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import { useEffect, useState } from "react";
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
export default function App() {
  const [user, setUser] = useState(null),
    [section, S] = useState("viajes"),
    [message, M] = useState(""),
    [trip, T] = useState(null),
    [data, D] = useState([]),
    [users, U] = useState([]),
    [vehicles, V] = useState([]),
    [storage, ST] = useState(null),
    [audit, A] = useState([]),
    [loading, Ld] = useState(false),
    [step, Step] = useState(null),
    [challenge, C] = useState("");
  const admin = user?.role === "admin";
  const run = async (fn) => {
    try {
      M("");
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
    });
  }
  async function exit() {
    await run(async () => {
      await api("/auth/logout");
      setBearer("");
      sessionStorage.removeItem("token");
      setUser(null);
      T(null);
    });
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
    });
  };
  if (!user)
    return (
      <Login
        step={step}
        login={login}
        loading={loading}
        message={message}
        Step={Step}
      />
    );
  return (
    <div className="layout">
      <Header user={user} exit={exit}/><Sidebar admin={admin} user={user} section={section} S={S} T={T}/>
      <main className="content">
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        {loading && <p>Cargando...</p>}
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
            }}
          />
        )}
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
