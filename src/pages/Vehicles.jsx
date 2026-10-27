import { api } from "../services/api.js";
import { money, date } from "../services/format.js";
import UserCard from "../components/common/UserCard.jsx";
export default function Vehicles({
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
      <h1>Vehículos</h1>
      <form className="grid" onSubmit={submit("/vehicles", refresh)}>
        <label>
          Placa
          <input name="plate" required />
        </label>
        <label>
          Descripción
          <input name="description" />
        </label>
        <button>Agregar vehículo</button>
      </form>
      <div className="cards">
        {vehicles.map((v) => (
          <article key={v.id}>
            <strong>{v.plate}</strong>
            <p>{v.description}</p>
          </article>
        ))}
      </div>
    </>
  );
}
