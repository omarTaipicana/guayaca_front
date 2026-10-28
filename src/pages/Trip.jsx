import GpsTrip from '../components/catalog/GpsTrip.jsx';
import PlannedRouteMap from '../components/catalog/PlannedRouteMap.jsx';
import { useState } from "react";
import { api, download } from "../services/api.js";
import { money, date, labels } from "../services/format.js";
import TripMap from "../components/common/TripMap.jsx";
export default function Trip({ detail, refresh, back, run, admin,currentUser }) {
  let { trip: t, events, expenses, files,deliveries=[] } = detail;
  const [eventType,EventType]=useState('');
  const [expenseType,ExpenseType]=useState('combustible');
  let [geo, G] = useState(null),
    [geoState, GS] = useState("Sin solicitar");
  const getGeo = () => {
    if (!navigator.geolocation) {
      GS("No disponible");
      return;
    }
    GS("Obteniendo ubicación...");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        G({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
        });
        GS(
          "Ubicación lista; precisión aproximada " +
            Math.round(p.coords.accuracy) +
            " m",
        );
      },
      () => {
        G(null);
        GS("Ubicación denegada o no disponible");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  let km =
    events.length > 1
      ? Number(events.at(-1).odometer) - Number(events[0].odometer)
      : 0;
  return (
    <>
      <button className="secondary" onClick={back}>
        ← Volver a viajes
      </button>
      <h1>{t.code}</h1>
      {t.metadata?.route&&<><h2>Ruta calculada al crear el viaje</h2><PlannedRouteMap route={t.metadata.route} points={[t.metadata.origin_place,...t.metadata.destination_places]}/><GpsTrip trip={t} user={currentUser} onUpdated={refresh}/><p>Tarifa aplicada: {t.metadata.farthest?.name} · ${money(t.amount)} · {t.tonnage} t</p><ul>{t.metadata.destination_places.map((p,i)=><li key={p.id}>{p.name}</li>)}</ul></>}
      {t.metadata&&<details><summary>Datos conservados al crear el viaje</summary><p>Cliente: {t.metadata.client?.name||t.metadata.client||'—'}</p>{t.metadata.client?.document_number&&<p>Cédula/RUC: {t.metadata.client.document_number}</p>}<p>Origen: {t.metadata.origin_place?.name||t.metadata.origin||'—'}</p><p>Destinos: {t.metadata.destination_places?.map(p=>p.name).join(' → ')||t.metadata.destination||'—'}</p><p>Categoría: {t.metadata.category?.name||'Sin categoría registrada'} · Valor guardado: ${money(t.metadata.amount??t.amount)}</p>{t.metadata.rates?.map((r,i)=><p key={i}>Tarifa registrada: ${money(r.amount)} · {r.active?'Activa':'Inactiva'}</p>)}<small>{t.metadata.legacy?'Viaje anterior: se conservaron los textos existentes.':'Estos datos no cambian al editar o eliminar clientes, lugares o tarifas.'}</small></details>}
      <p>
        {t.origin || "Origen"} → {t.destination || "Destino"} ·{" "}
        {t.status.replace("_", " ")}
      </p>
      <div className="metrics">
        <article>
          <strong>{km.toFixed(1)} km</strong>
          <span>Odómetro</span>
        </article>
        <article>
          <strong>${money(t.amount)}</strong>
          <span>Valor del viaje</span>
        </article>
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
            {t.metadata?.calculation==='farthest_road_destination'&&['llegada_destino','entrega'].includes(eventType)&&<label>Destino<select name="destination_index" required defaultValue=""><option value="">Selecciona</option>{t.metadata.destination_places.map((p,i)=><option key={p.id} value={i} disabled={eventType==='entrega'&&deliveries.some(d=>d.position===i)}>{p.name}</option>)}</select></label>}
            <label>
              Kilometraje del tablero
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
          {expenseType==='combustible'&&<label>Kilometraje al cargar combustible<input name="odometer" type="number" min="0" max="99999999999" step="0.1" required/></label>}
          <label>
            Valor USD
            <input name="amount" type="number" min="0" step="0.01" required />
          </label>
          <label>
            Detalle
            <input name="notes" />
          </label>
          <label>Foto del recibo<input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required/></label>
          <button>Guardar gasto y recibo</button>
        </form>
      </details>
      <details>
        <summary>Adjuntar guía</summary>
        {t.metadata?.route&&<p>Las guías de cada punto se suben en sus pendientes de llegada o salida. Aquí puedes adjuntar una guía adicional.</p>}
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
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
            />
          </label>
          <button>Subir guía</button>
        </form>
      </details>
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
      <h2>Mapa</h2>
      <TripMap events={events} />
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
