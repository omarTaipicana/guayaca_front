import {useState} from 'react';
import CatalogModal from './CatalogModal.jsx';
import DocumentInput from '../common/DocumentInput.jsx';
import {api} from '../../services/api.js';

export default function RouteExpense({trip,onClose,onSaved}){
 const [type,Type]=useState('combustible'),[busy,Busy]=useState(false),[error,ErrorText]=useState('');
 async function save(e){
  e.preventDefault();const body=new FormData(e.currentTarget);Busy(true);ErrorText('');
  try{
   const result=await api(`/trips/${trip.id}/expenses`,{method:'POST',body});
   onSaved(result.queued?'Gasto guardado en este teléfono. Se enviará al sincronizar.':'Gasto guardado.');
  }catch(e){ErrorText(e.message);}
  finally{Busy(false);}
 }
 return <CatalogModal title="Registrar gasto" eyebrow={'Viaje '+trip.code} routeVariant="expenses" busy={busy} onClose={onClose}>
  <form className="route-panel-form" onSubmit={save}>
   <fieldset className="route-expense-choice">
    <legend>Tipo de gasto</legend>
    <div className="route-expense-options">{['combustible','peaje'].map(value=><label key={value}>
     <input type="radio" name="type" value={value} checked={type===value} onChange={()=>Type(value)}/>
     <span>{value==='combustible'?'Combustible':'Peaje'}</span>
    </label>)}</div>
   </fieldset>
   <div className="route-panel-card route-panel-form">
    <label>Valor (USD)<input name="amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" required/></label>
    {type==='combustible'&&<label>Kilometraje al cargar combustible<input name="odometer" type="number" min="0" max="99999999999" step="0.1" inputMode="decimal" required/></label>}
    <label>Detalle <small>Opcional</small><input name="notes" placeholder="Estación, garita u observación"/></label>
   </div>
   <div className="route-panel-card">
    <label>Foto del recibo<DocumentInput name="receipt" accept="image/jpeg,image/png,image/webp" required/></label>
   </div>
   {error&&<p role="alert" className="catalog-error">{error}</p>}
   <button className="route-expense-save" disabled={busy}>Guardar gasto y recibo</button>
  </form>
 </CatalogModal>;
}
