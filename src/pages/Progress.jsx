import { api } from "../services/api.js";
import { money, date } from "../services/format.js";
import UserCard from "../components/common/UserCard.jsx";
export default function Progress({
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
      <h1>Avance del proyecto</h1>
      <p>
        <strong>0 % validado por el cliente.</strong> Esta versión contiene
        funciones en desarrollo y pruebas iniciales; el porcentaje se
        actualizará después de revisarlas en el servidor y con el cliente.
      </p>
      <div className="cards">
        {[
          ["Usuarios, permisos y correo", "Primera versión para probar"],
          ["Viajes, puntos y gastos", "Primera versión para probar"],
          ["Comprobantes y almacenamiento", "Primera versión para probar"],
          ["Mapa de puntos", "Primera versión para probar"],
          ["Seguimiento automático", "Pendiente"],
          ["Recuperación de contraseña", "Pendiente"],
          ["Pruebas en teléfonos y servidor", "Pendiente"],
        ].map(([name, status]) => (
          <article key={name}>
            <strong>{name}</strong>
            <p>{status}</p>
          </article>
        ))}
      </div>
    </>
  );
}
