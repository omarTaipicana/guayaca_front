import { api } from "../services/api.js";
import { money, date } from "../services/format.js";
import UserCard from "../components/common/UserCard.jsx";
export default function Users({
  admin,
  data,
  users,
  vehicles,
  run,
  refresh,
  submit,
  detail,
  audit,
  M,
}) {
  return (
    <>
      <h1>Usuarios y permisos</h1>
      <p>
        El correo debe estar configurado para verificar los usuarios y enviar
        códigos de doble factor.
      </p>
      <details>
        <summary>Crear usuario</summary>
        <form
          className="grid"
          onSubmit={(e) => {
            e.preventDefault();
            let form = e.currentTarget,
              f = new FormData(form);
            run(async () => {
              await api("/users", {
                method: "POST",
                body: {
                  name: f.get("name"),
                  email: f.get("email"),
                  password: f.get("password"),
                  role: f.get("role"),
                  two_factor: f.has("two_factor"),
                  permissions: f.getAll("permissions"),
                },
              });
              form.reset();
              await refresh();
              M(
                "Usuario creado. Al ingresar recibirá un código para verificar su correo.",
              );
            });
          }}
        >
          <label>
            Nombre
            <input name="name" required />
          </label>
          <label>
            Correo
            <input name="email" type="email" required />
          </label>
          <label>
            Contraseña inicial
            <input name="password" type="password" minLength="12" required />
          </label>
          <label>
            Rol
            <select name="role">
              <option value="conductor">Conductor</option>
              <option value="usuario">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="permissions"
              value="viajes"
              defaultChecked
            />
            Viajes
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="permissions"
              value="reportes"
              defaultChecked
            />
            Reportes
          </label>
          <label className="check">
            <input type="checkbox" name="two_factor" />
            Doble factor por correo
          </label>
          <button>Crear usuario</button>
        </form>
      </details>
      <div className="cards">
        {users.map((u) => (
          <UserCard key={u.id} user={u} run={run} refresh={refresh} />
        ))}
      </div>
    </>
  );
}
