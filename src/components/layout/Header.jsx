export default function Header({user,exit}) { return (
      <header>
        <img src="/logo.png" />
        <strong>
          GUAYACA <small>Transport</small>
        </strong>
        <span>{user.name}</span>
        <button onClick={exit} className="secondary">
          Salir
        </button>
      </header>

); }
