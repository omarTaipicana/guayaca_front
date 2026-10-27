import { useState } from "react";
import { api, download } from "../services/api.js";
export default function Storage({ data, run, refresh }) {
  let [selected, S] = useState([]),
    [confirm, C] = useState("");
  let mb = (n) => (Number(n) / 1024 / 1024).toFixed(1);
  return (
    <>
      <h1>Almacenamiento del servidor</h1>
      <p>
        Espacio del volumen que contiene los adjuntos. Se muestran hasta 500
        archivos más antiguos.
      </p>
      <div className="metrics">
        <article>
          <strong>{mb(data.total)} MB</strong>
          <span>Capacidad</span>
        </article>
        <article>
          <strong>{mb(data.used)} MB</strong>
          <span>Usado</span>
        </article>
        <article>
          <strong>{mb(data.free)} MB</strong>
          <span>Disponible</span>
        </article>
        <article>
          <strong>{mb(data.attachments.bytes)} MB</strong>
          <span>Adjuntos ({data.attachments.count})</span>
        </article>
      </div>
      <p>
        Memoria RAM: {mb(data.system.ramTotal - data.system.ramFree)} MB en uso
        aproximado de {mb(data.system.ramTotal)} MB. Carga promedio del sistema
        (1, 5 y 15 minutos):{" "}
        {data.system.load.map((x) => x.toFixed(2)).join(" / ")}. Estos valores
        dependen del entorno del VPS.
      </p>
      <p>
        Descargue los archivos que necesite antes de eliminarlos. Los viajes y
        valores permanecerán.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Elegir</th>
              <th>Fecha</th>
              <th>Viaje</th>
              <th>Archivo</th>
              <th>Peso</th>
              <th>Descarga</th>
            </tr>
          </thead>
          <tbody>
            {data.files.map((f) => (
              <tr key={f.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(f.id)}
                    onChange={(e) =>
                      S(
                        e.target.checked
                          ? [...selected, f.id]
                          : selected.filter((x) => x !== f.id),
                      )
                    }
                  />
                </td>
                <td>{date(f.created_at)}</td>
                <td>{f.trip_id}</td>
                <td>
                  {f.original_name} · {f.category}
                </td>
                <td>{mb(f.bytes)} MB</td>
                <td>
                  <button
                    className="link"
                    onClick={() => run(() => download(f.id, f.original_name))}
                  >
                    Descargar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Seleccionados: {selected.length} ·{" "}
        {mb(
          data.files
            .filter((x) => selected.includes(x.id))
            .reduce((a, x) => a + Number(x.bytes), 0),
        )}{" "}
        MB
      </p>
      <label>
        Escriba ELIMINAR para confirmar
        <input value={confirm} onChange={(e) => C(e.target.value)} />
      </label>
      <button
        className="danger"
        disabled={!selected.length || confirm !== "ELIMINAR"}
        onClick={() =>
          run(async () => {
            let r = await api("/storage/delete", {
              method: "POST",
              body: { ids: selected, confirm },
            });
            S([]);
            C("");
            await refresh();
            if (r.errors.length)
              throw Error(
                `Se eliminaron ${r.deleted.length}; ${r.errors.length} no pudieron eliminarse.`,
              );
          })
        }
      >
        Eliminar archivos seleccionados
      </button>
    </>
  );
}
