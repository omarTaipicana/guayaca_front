export default function Sidebar({admin,user,section,S,T}) { return (
      <nav>
        {[
          ...(admin || user.permissions.includes("viajes")
            ? [["viajes", "Viajes"]]
            : []),
          ...(admin || user.permissions.includes("reportes")
            ? [["reportes", "Resultados"]]
            : []),
          ...(admin
            ? [
                ["usuarios", "Usuarios"],
                ["vehiculos", "Vehículos"],
                ["actividad", "Actividad"],
                ["almacenamiento", "Almacenamiento"],
                ["avance", "Avance del proyecto"],
              ]
            : []),
        ].map(([id, label]) => (
          <button
            key={id}
            className={section === id ? "active" : ""}
            onClick={() => {
              S(id);
              T(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>

); }
