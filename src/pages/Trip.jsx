import { useState } from "react";
import { api, download } from "../services/api.js";
import { money, date, labels } from "../services/format.js";
import TripMap from "../components/common/TripMap.jsx";
export default function Trip({ detail, refresh, back, run, admin }) {
  let { trip: t, events, expenses, files } = detail;
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
      {!["finalizado", "cancelado"].includes(t.status) && (
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
                G(null);
                GS("Sin solicitar");
                await refresh();
              });
            }}
          >
            <label>
              Evento
              <select name="type">
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
                body: Object.fromEntries(new FormData(form)),
              });
              form.reset();
              await refresh();
            });
          }}
        >
          <label>
            Tipo
            <select name="type">
              <option value="combustible">Combustible</option>
              <option value="peaje">Peaje</option>
            </select>
          </label>
          <label>
            Valor USD
            <input name="amount" type="number" min="0" step="0.01" required />
          </label>
          <label>
            Detalle
            <input name="notes" />
          </label>
          <button>Guardar gasto</button>
        </form>
      </details>
      <details>
        <summary>Adjuntar guía o factura</summary>
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
          <label>
            Tipo
            <select name="category">
              <option value="guia">Guía de carga</option>
              <option value="entrega">Comprobante de entrega</option>
              <option value="combustible">Factura combustible</option>
              <option value="peaje">Factura peaje</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label>
            Vincular a punto (opcional)
            <select name="event_id">
              <option value="">Ninguno</option>
              {events.map((x) => (
                <option key={x.id} value={x.id}>
                  {labels[x.type]} · {date(x.created_at)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vincular a gasto (opcional)
            <select name="expense_id">
              <option value="">Ninguno</option>
              {expenses.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.type} ${money(x.amount)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Foto o PDF (máx. 12 MB)
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
            />
          </label>
          <button>Subir archivo</button>
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
