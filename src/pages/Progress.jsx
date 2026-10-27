import './styles/Progress.css';
const modules = [
  { name: 'Usuarios y seguridad', progress: 75, description: 'Invitación por correo, perfil, acceso, permisos, recuperación y doble factor.' },
  { name: 'Vehículos', progress: 65, description: 'Registro, edición, ficha técnica y fotografía de vehículos.' },
  { name: 'Viajes y puntos', progress: 50, description: 'Creación de viaje, eventos, ubicación por punto y kilometraje.' },
  { name: 'Gastos y comprobantes', progress: 55, description: 'Combustible, peajes y carga de imágenes o PDF.' },
  { name: 'Mapa y seguimiento', progress: 30, description: 'Control de conductores y puntos registrados. Seguimiento automático pendiente.' },
  { name: 'Resultados', progress: 35, description: 'Resumen inicial de ingresos y gastos. Faltan filtros y reportes ampliados.' },
  { name: 'Almacenamiento y actividad', progress: 55, description: 'Uso del servidor, actividad y limpieza de archivos seleccionados.' },
  { name: 'Pruebas y puesta en marcha', progress: 20, description: 'Pruebas iniciales realizadas. Faltan pruebas completas en dispositivos y servidor.' },
];
const average = Math.round(modules.reduce((sum, item) => sum + item.progress, 0) / modules.length);
function Donut({value, size = 120, label}) {
 const r=42, circumference=2*Math.PI*r;
 return <div className="progress-donut" style={{'--donut-size':`${size}px`}} role="img" aria-label={`${label}: ${value}%`}>
  <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="donut-track" cx="50" cy="50" r={r}/><circle className="donut-value" cx="50" cy="50" r={r} strokeDasharray={circumference} style={{'--dash-target':circumference*(1-value/100),strokeDashoffset:circumference*(1-value/100)}}/></svg><div className="donut-center"><strong>{value}%</strong>{size>150&&<span>avance</span>}</div>
 </div>;
}
export default function Progress() {
 return <div className="progress-page"><div className="progress-intro"><div><span className="progress-eyebrow">GUAYACA TRANSPORT</span><h1>Avance del proyecto</h1><p>Consulta cómo avanza el desarrollo del sistema y lo que estamos preparando en cada módulo.</p></div><span className="progress-version">Versión inicial</span></div>
 <div className="progress-overview"><article className="progress-summary"><div className="progress-summary-copy"><span className="progress-kicker">DESARROLLO GENERAL</span><h2>Estamos construyendo GUAYACA</h2><p>Este porcentaje es una estimación del desarrollo actual. Se calcula como el promedio de los ocho módulos mostrados abajo y se actualizará con cada avance.</p><div className="progress-status"><span/> En desarrollo</div></div><Donut value={average} size={190} label="Progreso general estimado"/></article><article className="progress-next"><span className="progress-kicker">SIGUIENTES PASOS</span><h2>Lo que sigue</h2><ul><li><span/>Pruebas completas en celular</li><li><span/>Seguimiento automático de ubicación</li><li><span/>Pruebas de recuperación por correo</li><li><span/>Mejoras de reportes y edición</li></ul></article></div>
 <div className="progress-section-heading"><div><h2>Avance por módulo</h2><p>Porcentajes estimados para dar seguimiento al trabajo.</p></div><span>{modules.length} módulos</span></div><div className="progress-modules">{modules.map((item,index)=><article className="progress-module" key={item.name} style={{'--card-delay':`${index*45}ms`}}><div className="progress-module-header"><span className="progress-number">{String(index+1).padStart(2,'0')}</span><Donut value={item.progress} size={82} label={item.name}/></div><h3>{item.name}</h3><p>{item.description}</p><div className="progress-bar" aria-hidden="true"><span style={{width:`${item.progress}%`}}/></div></article>)}</div></div>;
}
