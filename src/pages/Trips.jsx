import BulkDelete from '../components/catalog/BulkDelete.jsx';
import TripModeControl from '../components/catalog/TripModeControl.jsx';
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
  const [selected,Selected]=useState([]),[bulk,Bulk]=useState(false);
  const [deleting,Deleting]=useState(null),[creating,Creating]=useState(false);
  return (
    <>
      {deleting&&<DeleteRecord resource="trips" id={deleting.id} label={deleting.code} onClose={()=>Deleting(null)} onDeleted={refresh}/>}
      {bulk&&<BulkDelete resource="trips" rows={data.filter(t=>selected.includes(String(t.id)))} onClose={()=>Bulk(false)} onDeleted={async()=>{Selected([]);await refresh()}}/>}<h1>Viajes</h1><TripModeControl admin={admin}/>
      <p>Consulta y registra los movimientos del viaje.</p>
      <button onClick={()=>Creating(true)}>Crear viaje</button>
      {creating&&<CreateTrip admin={admin} onClose={()=>Creating(false)} onCreated={refresh}/>}
      {admin&&<div className="catalog-footer"><button className="secondary" onClick={()=>Selected(data.map(t=>String(t.id)))}>Seleccionar todos los visibles</button><button className="secondary" onClick={()=>Selected([])}>Quitar selección</button><button className="danger" disabled={!data.some(t=>selected.includes(String(t.id)))} onClick={()=>Bulk(true)}>Eliminar seleccionados</button></div>}<div className="cards">
        {data.map((t) => (
          <article key={t.id}>
            {admin&&<label><input type="checkbox" style={{width:'auto'}} checked={selected.includes(String(t.id))} onChange={e=>Selected(e.target.checked?[...selected,String(t.id)]:selected.filter(id=>id!==String(t.id)))}/> Seleccionar</label>}<div className="row">
              <h3>{t.code} · {t.is_test?'PRUEBA':'REAL'}</h3>
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
