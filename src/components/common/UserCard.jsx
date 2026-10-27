import { useState } from "react";
import { api } from "../../services/api.js";
export default function UserCard({ user: u, run, refresh }) {
  const [perms, P] = useState(u.permissions || []),
    [active, A] = useState(u.active),
    [two, T] = useState(u.two_factor);
  return (
    <article>
      <h3>{u.name}</h3>
      <p>
        {u.email} · {u.role} · correo{" "}
        {u.email_verified ? "verificado" : "pendiente"}
      </p>
      <div className="checks">
        <label>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => A(e.target.checked)}
          />{" "}
          Activo
        </label>
        <label>
          <input
            type="checkbox"
            checked={two}
            onChange={(e) => T(e.target.checked)}
          />{" "}
          Doble factor
        </label>
        {["viajes", "reportes"].map((p) => (
          <label key={p}>
            <input
              type="checkbox"
              checked={perms.includes(p)}
              onChange={(e) =>
                P(
                  e.target.checked
                    ? [...perms, p]
                    : perms.filter((x) => x !== p),
                )
              }
            />{" "}
            {p}
          </label>
        ))}
      </div>
      <button
        onClick={() =>
          run(async () => {
            await api("/users/" + u.id, {
              method: "PATCH",
              body: { active, permissions: perms, two_factor: two },
            });
            await refresh();
          })
        }
      >
        Guardar permisos
      </button>
    </article>
  );
}
