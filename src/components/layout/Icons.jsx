const paths = {
 notificaciones:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
 mantenimientos:<><path d="m14 6 4-4a6 6 0 0 1-7 8L4 17a2 2 0 0 0 3 3l7-7a6 6 0 0 0 8-7l-4 4z"/></>,
 clientes: <><path d="M4 21V5h10v16M14 10h6v11M8 9h2M8 13h2M8 17h2M17 14h1M17 18h1M2 21h20"/></>,
 lugares: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>,
  zonas: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/><path d="M10 10h4M12 8v6"/></>,
  control: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/><circle cx="12" cy="10" r="2"/></>,
  viajes: <><path d="M3 6h12v10H3z"/><path d="M15 9h3l3 3v4h-6M6 16a2 2 0 1 0 4 0M16 16a2 2 0 1 0 4 0"/></>,
  reportes: <><path d="M4 20V5M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6M20 16V5"/></>,
  usuarios: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19zM16 5.5a3 3 0 0 1 0 5.8M17 13.5a4 4 0 0 1 3.5 4V19"/></>,
  vehiculos: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17" r="2"/><circle cx="18" cy="17" r="2"/></>,
  actividad: <><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
  almacenamiento: <><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
  avance: <><path d="M5 20V5h14v15H5zM8 9h8M8 13h8M8 17h5"/><path d="m15.5 17 1 1 2-2"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  cerrar: <><path d="M6 6l12 12M18 6 6 18"/></>,
  izquierda: <><path d="m14 6-6 6 6 6"/></>,
  derecha: <><path d="m10 6 6 6-6 6"/></>,
  salir: <><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/></>,
};
export default function Icon({name,size=21}) {
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
