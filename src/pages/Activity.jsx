import { api } from "../services/api.js";
import { money, date } from "../services/format.js";
import UserCard from "../components/common/UserCard.jsx";
export default function Activity({
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
      <h1>Actividad de usuarios</h1>
      <p>
        Últimos 300 registros. Las operaciones de creación, cambios, accesos,
        descargas y limpieza quedan registradas.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((x) => (
              <tr key={x.id}>
                <td>{date(x.created_at)}</td>
                <td>{x.name || "—"}</td>
                <td>{x.action}</td>
                <td>{JSON.stringify(x.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
