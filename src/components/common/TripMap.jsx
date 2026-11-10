import {useEffect,useRef} from "react";
import L from "leaflet";
import {addMapBasemaps} from './mapBasemaps.js';

const valid=x=>x.latitude!=null&&x.longitude!=null&&Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude));
const time=x=>+new Date(x.device_at||x.created_at);
export default function TripMap({events,gps=false}){
 const ref=useRef(),map=useRef(null),layer=useRef(null);
 const hasPoints=events.some(valid);
 useEffect(()=>{
  if(!hasPoints)return;
  map.current=L.map(ref.current);
  addMapBasemaps(map.current);
  const resize=new ResizeObserver(()=>map.current?.invalidateSize({pan:false}));
  resize.observe(ref.current);
  return()=>{resize.disconnect();map.current.remove();map.current=null;layer.current=null;};
 },[hasPoints]);
 useEffect(()=>{
  if(!map.current)return;
  const rows=events.filter(valid);
  if(gps)rows.sort((a,b)=>time(a)-time(b));
  const pts=rows.map(x=>[Number(x.latitude),Number(x.longitude)]);
  const first=!layer.current;
  layer.current?.remove();
  layer.current=L.layerGroup().addTo(map.current);
  const draw=(points,options)=>{if(points.length>1)L.polyline(points,{color:"#07346b",...options}).addTo(layer.current);};
  if(gps){
   let segment=[pts[0]];
   for(let i=1;i<pts.length;i++){
    if(time(rows[i])-time(rows[i-1])>5*60*1000){
     draw(segment);draw([pts[i-1],pts[i]],{dashArray:'5 8',opacity:0.55});segment=[];
    }
    segment.push(pts[i]);
   }
   draw(segment);
   L.circleMarker(pts[0],{radius:6,color:"#07346b"}).addTo(layer.current).bindPopup("Primer punto GPS");
   L.circleMarker(pts.at(-1),{radius:8,color:"#ff5b0a",fillOpacity:0.8}).addTo(layer.current).bindPopup("Última ubicación registrada");
  }else{
   draw(pts);
   pts.forEach((p,i)=>L.circleMarker(p,{radius:6,color:"#ff5b0a"}).addTo(layer.current).bindPopup("Punto "+(i+1)));
  }
  if(first||!gps){
   if(pts.length>1)map.current.fitBounds(pts,{padding:[25,25],maxZoom:16});
   else map.current.setView(pts[0],15);
  }
 },[events,gps,hasPoints]);
 return hasPoints?<><p className="hint">{gps?'El punto naranja indica la última ubicación registrada. La línea une muestras GPS; los tramos punteados indican más de cinco minutos entre puntos mostrados.':'La línea une los eventos registrados; no representa necesariamente la ruta real.'}</p><div className="map" ref={ref}/></>:<p>Sin ubicaciones registradas.</p>;
}
