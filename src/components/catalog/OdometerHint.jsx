import './styles/OdometerHint.css';

const formatter=new Intl.NumberFormat('es-EC',{maximumFractionDigits:1});
export function lastOdometer(...values){
 const readings=values.filter(v=>v!=null&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0).map(Number);
 return readings.length?Math.max(...readings):null;
}

export default function OdometerHint({value}){
 return <small className="odometer-hint">Último kilometraje registrado: {value==null?'sin lectura disponible':formatter.format(value)+' km'}</small>;
}
