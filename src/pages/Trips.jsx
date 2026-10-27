import { api } from "../services/api.js";
import { money, date } from "../services/format.js";
import UserCard from "../components/common/UserCard.jsx";
export default function Trips({
  admin,
  data,
  users,
  vehicles,
  run,
  refresh,
  submit,
  detail,
  audit,
}) {
  return (
    <>
      <h1>Viajes</h1>
      <p>Consulta y registra los movimientos del viaje.</p>
      {admin && (
        <details>
          <summary>Crear viaje</summary>
          <form className="grid" onSubmit={submit("/trips", refresh)}>
            <label>
              Conductor
              <select name="driver_id" required defaultValue="">
                <option value="">Seleccione</option>
                {users
                  .filter((x) => x.active)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Camión
              <select name="vehicle_id" required defaultValue="">
                <option value="">Seleccione</option>
                {vehicles
                  .filter((x) => x.active)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.plate}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Cliente
              <input name="client" />
            </label>
            <label>
              Origen
              <input name="origin" />
            </label>
            <label>
              Destino
              <input name="destination" />
            </label>
            <label>
              Valor del viaje USD
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
              />
            </label>
            <button>Crear viaje</button>
          </form>
        </details>
      )}
      <div className="cards">
        {data.map((t) => (
          <article key={t.id}>
            <div className="row">
              <h3>{t.code}</h3>
              <span className="badge">{t.status.replace("_", " ")}</span>
            </div>
            <p>
              {t.origin || "Origen"} → {t.destination || "Destino"}
            </p>
            <p>
              {t.plate} · {t.driver}
            </p>
            <p>
              Ingreso ${money(t.amount)} · Gastos ${money(t.expenses)}
            </p>
            <button onClick={() => run(() => detail(t.id))}>Abrir viaje</button>
          </article>
        ))}
        {!data.length && <p>No hay viajes registrados.</p>}
      </div>
    </>
  );
}
