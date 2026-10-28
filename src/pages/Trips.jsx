import CreateTrip from '../components/catalog/CreateTrip.jsx';
import {useState} from 'react';
import DeleteRecord from '../components/catalog/DeleteRecord.jsx';
import TripCatalogFields from '../components/catalog/TripCatalogFields.jsx';
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
  const [deleting,Deleting]=useState(null),[creating,Creating]=useState(false);
  return (
    <>
      {deleting&&<DeleteRecord resource="trips" id={deleting.id} label={deleting.code} onClose={()=>Deleting(null)} onDeleted={refresh}/>}
      <h1>Viajes</h1>
      <p>Consulta y registra los movimientos del viaje.</p>
      <button onClick={()=>Creating(true)}>Crear viaje</button>
      {creating&&<CreateTrip admin={admin} onClose={()=>Creating(false)} onCreated={refresh}/>}
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
            <button onClick={() => run(() => detail(t.id))}>Abrir viaje</button> {admin&&<button className="danger" onClick={()=>Deleting(t)}>Eliminar viaje</button>}
          </article>
        ))}
        {!data.length && <p>No hay viajes registrados.</p>}
      </div>
    </>
  );
}
