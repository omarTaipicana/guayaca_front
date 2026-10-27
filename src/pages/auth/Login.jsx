export default function Login({ step, login, loading, message, Step }) {
  return (
    <main className="login">
      <div className="loginbox">
        <img src="/logo.png" />
        <h1>GUAYACA Transport</h1>
        <p>Control de viajes</p>
        <form onSubmit={login}>
          {step ? (
            <>
              <h2>
                {step === "verify" ? "Verifique su correo" : "Doble factor"}
              </h2>
              <p>Ingrese el código enviado a su correo. Vence en 10 minutos.</p>
              <label>
                Código
                <input
                  name="code"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Correo
                <input type="email" name="email" required />
              </label>
              <label>
                Contraseña
                <input type="password" name="password" required />
              </label>
            </>
          )}
          <button disabled={loading}>{step ? "Verificar" : "Ingresar"}</button>
          {step && (
            <button
              type="button"
              className="secondary"
              onClick={() => Step(null)}
            >
              Volver a ingresar
            </button>
          )}
        </form>
        {message && <div className="notice">{message}</div>}
      </div>
    </main>
  );
}
