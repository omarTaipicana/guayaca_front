import { api } from "../services/api.js";
import { money, date } from "../services/format.js";
import UserCard from "../components/common/UserCard.jsx";
export default function Reports({
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
      <h1>Resultados</h1>
      <p>
        Resultado después de combustible y peajes registrados; no es utilidad
        completa.
      </p>
      <div className="metrics">
        <article>
          <strong>{data.length}</strong>
          <span>Viajes mostrados</span>
        </article>
        <article>
          <strong>
            ${money(data.reduce((a, x) => a + Number(x.amount), 0))}
          </strong>
          <span>Valor registrado</span>
        </article>
        <article>
          <strong>
            ${money(data.reduce((a, x) => a + Number(x.expenses), 0))}
          </strong>
          <span>Gastos registrados</span>
        </article>
        <article>
          <strong>
            $
            {money(
              data.reduce(
                (a, x) => a + Number(x.amount) - Number(x.expenses),
                0,
              ),
            )}
          </strong>
          <span>Resultado</span>
        </article>
      </div>
      <p>
        Los resultados corresponden a los hasta 300 viajes más recientes. En el
        detalle se muestran tiempos y kilometraje.
      </p>
    </>
  );
}
