import OdometerHint,{lastOdometer} from '../components/catalog/OdometerHint.jsx';
import {getPosition,authorizeLocation} from '../services/native/location.js';
import TripControl from '../components/catalog/TripControl.jsx';
import DocumentInput from '../components/common/DocumentInput.jsx';
import SimulationControls from '../components/catalog/SimulationControls.jsx';
import GpsTrip from '../components/catalog/GpsTrip.jsx';
import { useState } from "react";
import { api, download } from "../services/api.js";
import { money, date, labels } from "../services/format.js";
import TripMap from "../components/common/TripMap.jsx";
export default function Trip({ detail, refresh, back, run, admin,currentUser,noticeTarget,onNoticeFocused }) {
  let { trip: t, events, expenses, files,deliveries=[] } = detail;
  const [eventType,EventType]=useState('');
  const [expenseType,ExpenseType]=useState('combustible');
  let [geo, G] = useState(null),
    [geoState, GS] = useState("Sin solicitar");
  const getGeo = async () => {
    GS("Obteniendo ubicación...");
    try {
      await authorizeLocation();
      const {coords}=await getPosition({enableHighAccuracy:true,timeout:15000,maximumAge:0});
      G({latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy});
      GS("Ubicación lista · "+Math.round(coords.accuracy)+" m");
    } catch(e) { G(null); GS(e.message||"Ubicación no disponible"); }
  };
  let km =
    events.length > 1
      ? Number(events.at(-1).odometer) - Number(events[0].odometer)
      : 0;
  const odometer=lastOdometer(detail.vehicle_odometer,...events.map(e=>e.odometer),...expenses.map(e=>e.odometer));
  const georeferenced=!!(t.metadata?.origin_place&&t.metadata?.destination_places?.length);
  if(georeferenced&&!admin)return <>
   <div className="route-title"><h1>Viaje {t.code}</h1><button className="secondary" type="button" onClick={back}>Volver</button></div>
   <GpsTrip trip={t} baseOdometer={odometer} user={currentUser} onUpdated={refresh} noticeTarget={noticeTarget} onNoticeFocused={onNoticeFocused}/>
  </>;
  return (
    <>
      <button className="secondary" onClick={back}>
        ← Volver a viajes
      </button>
      <h1>{t.code} · {t.is_test?'PRUEBA':'REAL'}</h1>{admin&&t.is_test&&<p className="catalog-info">Viaje de prueba: no se incluirá en resultados ni cortes de cobro y no modifica el kilometraje real.</p>}{t.is_test&&admin&&<SimulationControls trip={t} onUpdated={refresh}/>}{t.metadata?.capacity_warning&&<p className="catalog-info">{t.metadata.capacity_warning}</p>}{admin&&Number(t.standby_amount)>0&&<p className="catalog-info">Tarifa base: ${money(t.base_amount)} · Stand by: ${money(t.standby_amount)} · Total: ${money(t.amount)}</p>}
      {t.metadata?.origin_place&&t.metadata?.destination_places?.length>0&&<GpsTrip trip={t} baseOdometer={odometer} user={currentUser} onUpdated={refresh} noticeTarget={noticeTarget} onNoticeFocused={onNoticeFocused}/>}
      {(georeferenced||admin)&&<><TripControl trip={t} admin={admin} onUpdated={refresh}/>{admin&&georeferenced&&<><p>Tarifa de referencia al crear: {t.metadata.priced_destination?.name||t.metadata.farthest?.name} · ${money(t.metadata.amount)} · {t.tonnage} t</p><p>Flete vigente: ${money(t.base_amount)} · Stand by registrado: ${money(t.standby_amount)}. Los cargos pendientes requieren revisión antes del cobro.</p><ul>{t.metadata.destination_places.map((p,i)=><li key={p.id}>{p.name}</li>)}</ul></>}</>}
      {admin&&t.metadata&&<details><summary>Datos conservados al crear el viaje</summary>{t.metadata.client&&<p>Cliente histórico: {t.metadata.client?.name||t.metadata.client}</p>}{t.metadata.client?.document_number&&<p>Cédula/RUC: {t.metadata.client.document_number}</p>}<p>Origen: {t.metadata.origin_place?.name||t.metadata.origin||'—'}</p><p>Destinos: {t.metadata.destination_places?.map(p=>p.name).join(' → ')||t.metadata.destination||'—'}</p><p>Categoría: {t.metadata.category?.name||'Sin categoría registrada'} · Valor guardado: ${money(t.metadata.amount??t.amount)}</p>{t.metadata.rates?.map((r,i)=><p key={i}>Tarifa registrada: ${money(r.amount)} · {r.active?'Activa':'Inactiva'}</p>)}<small>{t.metadata.legacy?'Viaje anterior: se conservaron los textos existentes.':'Estos datos no cambian al editar o eliminar lugares o tarifas.'}</small></details>}
      <p>
        {t.origin || "Origen"} → {t.destination || "Destino"} ·{" "}
        {t.status.replace("_", " ")}
      </p>
      <div className="metrics">
        <article>
          <strong>{km.toFixed(1)} km</strong>
          <span>Odómetro</span>
        </article>
        {admin&&<article>
          <strong>${money(t.amount)}</strong>
          <span>Valor del viaje</span>
        </article>}
        <article>
          <strong>
            ${money(expenses.reduce((a, x) => a + Number(x.amount), 0))}
          </strong>
          <span>Gastos</span>
        </article>
        <article>
          <strong>
            {t.started_at && t.closed_at
              ? (
                  (new Date(t.closed_at) - new Date(t.started_at)) /
                  3600000
                ).toFixed(1) + " h"
              : "—"}
          </strong>
          <span>Duración total</span>
        </article>
      </div>
      {!t.metadata?.route&&!["finalizado", "cancelado"].includes(t.status) && (
        <details open>
          <summary>Registrar punto</summary>
          <p>
            Primero obtenga ubicación si desea guardarla con este punto. Se
            puede guardar sin ella.
          </p>
          <button type="button" className="secondary" onClick={getGeo}>
            Obtener ubicación
          </button>{" "}
          <span>{geoState}</span>
          <form
            className="grid"
            onSubmit={(e) => {
              e.preventDefault();
              let form = e.currentTarget,
                f = new FormData(form);
              run(async () => {
                await api("/trips/" + t.id + "/events", {
                  method: "POST",
                  body: { ...Object.fromEntries(f), ...(geo || {}) },
                });
                form.reset();
                EventType('');G(null);
                GS("Sin solicitar");
                await refresh();
              });
            }}
          >
            <label>
              Evento
              <select name="type" onChange={e=>EventType(e.target.value)}>
                {(t.status === "creado"
                  ? ["salida_domicilio"]
                  : [
                      "llegada_carga",
                      "salida_carga",
                      "llegada_destino",
                      "entrega",
                    ]
                ).map((x) => (
                  <option key={x} value={x}>
                    {labels[x]}
                  </option>
                ))}
              </select>
            </label>
            {['farthest_road_destination','highest_destination_rate'].includes(t.metadata?.calculation)&&['llegada_destino','entrega'].includes(eventType)&&<label>Destino<select name="destination_index" required defaultValue=""><option value="">Selecciona</option>{t.metadata.destination_places.map((p,i)=><option key={p.id} value={i} disabled={eventType==='entrega'&&deliveries.some(d=>d.position===i)}>{p.name}</option>)}</select></label>}
            <label>
              Kilometraje del tablero
              <OdometerHint value={odometer}/>
              <input
                name="odometer"
                type="number"
                step="0.1"
                min="0"
                required
              />
            </label>
            <label>
              Observaciones
              <input name="notes" />
            </label>
            <button>Guardar punto</button>
          </form>
        </details>
      )}
      <details>
        <summary>Registrar gasto</summary>
        <form
          className="grid"
          onSubmit={(e) => {
            e.preventDefault();
            let form = e.currentTarget;
            run(async () => {
              await api("/trips/" + t.id + "/expenses", {
                method: "POST",
                body: new FormData(form),
              });
              form.reset();ExpenseType("combustible");
              await refresh();
            });
          }}
        >
          <label>
            Tipo
            <select name="type" value={expenseType} onChange={e=>ExpenseType(e.target.value)}>
              <option value="combustible">Combustible</option>
              <option value="peaje">Peaje</option>
            </select>
          </label>
          {expenseType==='combustible'&&<label>Kilometraje al cargar combustible<OdometerHint value={odometer}/><input name="odometer" type="number" min="0" max="99999999999" step="0.1" required/></label>}
          <label>
            Valor USD
            <input name="amount" type="number" min="0" step="0.01" required />
          </label>
          <label>
            Detalle
            <input name="notes" />
          </label>
          <label>Foto del recibo<DocumentInput name="receipt" accept="image/jpeg,image/png,image/webp" required/></label>
          <button>Guardar gasto y recibo</button>
        </form>
      </details>
      {!t.metadata?.route&&<details>
        <summary>Adjuntar guía</summary>
        <form
          className="grid"
          onSubmit={(e) => {
            e.preventDefault();
            let form = e.currentTarget,
              f = new FormData(form);
            run(async () => {
              await api("/trips/" + t.id + "/files", {
                method: "POST",
                body: f,
              });
              form.reset();
              await refresh();
            });
          }}
        >
          <input type="hidden" name="category" value="guia"/>
          <label>
            Foto o PDF (máx. 12 MB)
            <DocumentInput name="file" required/>
          </label>
          <button>Subir guía</button>
        </form>
      </details>}
      <h2>Puntos del viaje</h2>
      <div className="cards">
        {events.map((x) => (
          <article key={x.id}>
            <strong>{labels[x.type]}</strong>
            <p>
              {date(x.created_at)} · {x.odometer} km
            </p>
            <p>
              Ubicación:{" "}
              {x.location_status === "disponible"
                ? `${x.latitude}, ${x.longitude}`
                : "no disponible"}
            </p>
            <p>{x.notes}</p>
          </article>
        ))}
      </div>
      {!georeferenced&&<><h2>Mapa</h2><TripMap events={events}/></>}
      <h2>Gastos</h2>
      {expenses.map((x) => (
        <p key={x.id}>
          {date(x.created_at)} · {x.type} · ${money(x.amount)} · {x.notes}
        </p>
      ))}
      <h2>Archivos</h2>
      {files.map((x) => (
        <p key={x.id}>
          {x.category} · {x.original_name}{" "}
          {x.deleted_at ? (
            "(eliminado)"
          ) : (
            <button
              className="link"
              onClick={() => run(() => download(x.id, x.original_name))}
            >
              Descargar
            </button>
          )}
        </p>
      ))}
    </>
  );
}
