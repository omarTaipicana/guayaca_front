import Mascot from './Mascot.jsx';
import './styles/LoadingOverlay.css';
export default function LoadingOverlay({message='Procesando la información…'}){
 return <div className="loading-overlay" role="status" aria-live="polite" aria-label={message}><div className="loading-overlay-card"><Mascot compact/><div className="loading-spinner" aria-hidden="true"/><strong>{message}</strong><p>Un momento, por favor.</p></div></div>;
}
