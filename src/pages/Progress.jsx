import './styles/Progress.css';
const modules = [
 {name:'Usuarios y seguridad',progress:90,description:'Invitación, perfil, permisos, recuperación, correo y doble factor. Pendiente: pruebas finales de seguridad y sesiones en APK.'},
 {name:'Clientes',progress:90,description:'Catálogo, búsqueda, edición y eliminación con código. Copia histórica en viajes. Pendiente: ajustes de operación real.'},
 {name:'Lugares de embarque y entrega',progress:85,description:'Mapa, contactos, tipo, coordenadas y radio de detección. Pendiente: revisión física de ubicaciones y radios.'},
 {name:'Zonas, capas y tarifas',progress:90,description:'Capas BPA, categorías de tonelaje y tarifas por polígono. Pendiente: completar precios reales y revisar cobertura.'},
 {name:'Vehículos e historial',progress:90,description:'Ficha, foto, disponibilidad y detalle de viajes, gastos, eventos y documentos. Pendiente: revisión integral de flota.'},
 {name:'Mantenimientos y kilometraje',progress:90,description:'Ingreso, cierre, alertas por km y edición de finalizados con 2FA. Pendiente: verificar avisos con vehículos reales.'},
 {name:'Viajes del conductor',progress:85,description:'Creación desde su cuenta, vehículo disponible, cliente, tonelaje y múltiples entregas. Pendiente: pruebas completas en ruta.'},
 {name:'Rutas y precio automático',progress:85,description:'Ruta, puntos con detalle, km por tramo y tarifa del destino más lejano. Pendiente: motor de rutas de producción y validación en Ecuador.'},
 {name:'GPS y geocercas en web',progress:70,description:'Llegadas, salidas, permanencias y pendientes por GPS con web abierta. Pendiente: pruebas físicas, señal inestable y cambios de orden.'},
 {name:'APK y GPS en segundo plano',progress:0,description:'Pendiente: APK Android, servicio nativo, permisos, notificaciones del sistema y recuperación de lecturas sin conexión.'},
 {name:'Guías, peajes y combustible',progress:85,description:'Guías por punto, km, recibos fotográficos y conservación histórica. Pendiente: pruebas de captura en dispositivos reales.'},
 {name:'Notificaciones y sonido',progress:80,description:'Campanita, pendientes privados, sonido activable y correo de mantenimiento. Pendiente: push nativo y pruebas de entrega reales.'},
 {name:'Resultados y analítica',progress:80,description:'Filtros, tiempos medidos, balance registrado y gráficos interactivos. Pendiente: exportaciones y validación con operación real.'},
 {name:'Almacenamiento y limpieza',progress:85,description:'Disco/RAM, gráficos, filtros, selección entre páginas y eliminación con 2FA. Pendiente: política de retención y respaldo automatizado.'},
 {name:'Auditoría e historial',progress:85,description:'Acciones, antes/después, metadatos de viaje y eliminaciones restringidas al administrador. Pendiente: revisión exhaustiva de eventos.'},
 {name:'Stand by y recargos',progress:0,description:'Pendiente: regla de USD 60 por día adicional, recepción aplazada y desglose en el valor por cobrar.'},
 {name:'Pruebas integrales',progress:55,description:'Pruebas de API, migraciones, correo/rutas/GPS simulados y formularios. Pendiente: pruebas físicas y flujo completo en varios celulares.'},
 {name:'Puesta en producción',progress:25,description:'Base PostgreSQL y capas preparadas; back/front en pruebas. Pendiente: despliegue final, HTTPS, router y respaldo/restauración.'},
];
const average = Math.round(modules.reduce((sum, item) => sum + item.progress, 0) / modules.length);
function Donut({value, size = 120, label}) {
 const r=42, circumference=2*Math.PI*r;
 return <div className="progress-donut" style={{'--donut-size':`${size}px`}} role="img" aria-label={`${label}: ${value}%`}>
  <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="donut-track" cx="50" cy="50" r={r}/><circle className="donut-value" cx="50" cy="50" r={r} strokeDasharray={circumference} style={{'--dash-target':circumference*(1-value/100),strokeDashoffset:circumference*(1-value/100)}}/></svg><div className="donut-center"><strong>{value}%</strong>{size>150&&<span>avance</span>}</div>
 </div>;
}
export default function Progress() {
 return <div className="progress-page"><div className="progress-intro"><div><span className="progress-eyebrow">GUAYACA TRANSPORT</span><h1>Avance del proyecto</h1><p>Consulta cómo avanza el desarrollo del sistema y lo que estamos preparando en cada módulo.</p></div><span className="progress-version">Back 0.3.2 · Front 0.2.2 · 28 oct 2026</span></div>
 <div className="progress-overview"><article className="progress-summary"><div className="progress-summary-copy"><span className="progress-kicker">DESARROLLO GENERAL</span><h2>Estamos construyendo GUAYACA</h2><p>Este porcentaje es una estimación del desarrollo actual. Se calcula como el promedio simple de los 18 frentes mostrados abajo, incluidos los nuevos pendientes y se actualizará con cada avance.</p><div className="progress-status"><span/> En desarrollo</div></div><Donut value={average} size={190} label="Progreso general estimado"/></article><article className="progress-next"><span className="progress-kicker">SIGUIENTES PASOS</span><h2>Lo que sigue</h2><ul><li><span/>APK y ubicación nativa en segundo plano</li><li><span/>Stand by y recargos por espera</li><li><span/>Pruebas reales de GPS, recibos y notificaciones</li><li><span/>Router de producción, HTTPS y respaldos</li></ul></article></div>
 <div className="progress-section-heading"><div><h2>Avance por módulo</h2><p>Estimaciones internas, no mediciones automáticas. Al incorporar nuevos frentes cambia el promedio general.</p></div><span>{modules.length} módulos</span></div><div className="progress-modules">{modules.map((item,index)=><article className="progress-module" key={item.name} style={{'--card-delay':`${index*45}ms`}}><div className="progress-module-header"><span className="progress-number">{String(index+1).padStart(2,'0')}</span><Donut value={item.progress} size={82} label={item.name}/></div><h3>{item.name}</h3><small>{item.progress===0?'Pendiente':item.progress>=80?'Disponible con pendientes':'En desarrollo / pruebas'}</small><p>{item.description}</p><div className="progress-bar" aria-hidden="true"><span style={{width:`${item.progress}%`}}/></div></article>)}</div></div>;
}
