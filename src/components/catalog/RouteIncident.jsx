import {useState} from 'react';
import {api} from '../../services/api.js';

export const incidentLabels={partial:'Entrega parcial',rejected:'Entrega rechazada',failed:'Entrega fallida'};

export default function RouteIncident({trip,position,busy,onBusy,onSaved}){
 const [outcome,setOutcome]=useState('partial'),[error,setError]=useState('');
 async function save(e){
  e.preventDefault();
  const {reason,delivered_tons}=Object.fromEntries(new FormData(e.currentTarget));
  const detail=reason.trim();
  if(detail.length<5){setError('Describe la incidencia con al menos 5 caracteres.');return;}
  if(outcome==='partial'&&Number(trip.tonnage)>0&&Number(delivered_tons)>=Number(trip.tonnage)){
   setError('El tonelaje entregado debe ser menor que la carga total.');return;
  }
  onBusy(true);setError('');
  try{
   const result=await api(`/trips/${trip.id}/outcomes`,{method:'POST',body:{
    position,outcome,reason:detail,delivered_tons:outcome==='partial'?delivered_tons:0,request_id:crypto.randomUUID(),
   }});
   await onSaved(result);
  }catch(e){setError(e.message);}
  finally{onBusy(false);}
 }
 return <details>
  <summary>Registrar incidencia de entrega</summary>
  <form className="route-panel-form" onSubmit={save}>
   <p>Una entrega parcial, rechazada o fallida queda pendiente de revisión.</p>
   <label>Resultado<select value={outcome} onChange={e=>setOutcome(e.target.value)}>{Object.entries(incidentLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   {outcome==='partial'&&<label>Toneladas entregadas<input name="delivered_tons" type="number" min="0.001" step="0.001" required/></label>}
   <label>Motivo<textarea name="reason" minLength={5} maxLength={1000} rows={3} required/></label>
   {error&&<p className="catalog-error" role="alert">{error}</p>}
   <button disabled={busy}>Guardar incidencia</button>
  </form>
 </details>;
}
