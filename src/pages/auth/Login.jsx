import {useState} from 'react';
import ForgotPassword from './ForgotPassword.jsx';
import '../styles/Login.css';
import Mascot from '../../components/common/Mascot.jsx';
export default function Login({ step, login, loading, message, Step }) {
  const [recover, setRecover] = useState(false);
  if (recover) return <ForgotPassword onBack={() => setRecover(false)}/>;
  return (
    <main className="login">
      <div className="loginbox">
        <img className="login-brand" src="/logo.png" alt="GUAYACA" width="90" height="90"/>
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
        {!step && <button type="button" className="recovery-login-link" onClick={() => setRecover(true)}>¿Olvidaste tu contraseña?</button>}
        {message && <div className="notice">{message}</div>}
        <p><a href="/privacidad/index.html">Política de privacidad</a></p>
        <Mascot/>
      </div>
    </main>
  );
}
