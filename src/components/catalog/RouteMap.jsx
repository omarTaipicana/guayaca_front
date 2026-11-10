import {useEffect,useRef} from 'react';
import L from 'leaflet';
import {addMapBasemaps} from '../common/mapBasemaps.js';
import './styles/RouteWorkspace.css';

const coords=p=>p?.latitude!=null&&p?.longitude!=null&&Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude))?[Number(p.latitude),Number(p.longitude)]:null;
const timestamp=p=>+new Date(p.device_at||p.timestamp||0);
export default function RouteMap({route,points,samples,fix,follow=false,offline=false}){
 const root=useRef(null),map=useRef(null),base=useRef(null),actual=useRef(null),current=useRef(null),following=useRef(follow),lastCentered=useRef(null);
 const pointKey=JSON.stringify(points);
 useEffect(()=>{
  const m=L.map(root.current,{scrollWheelZoom:true}).setView([-1.83,-78.18],7);map.current=m;
  addMapBasemaps(m);
  for(const [name,z] of [['suggested',420],['driven',430],['current-fix',440]])m.createPane(name).style.zIndex=z;
  base.current=L.layerGroup().addTo(m);actual.current=L.layerGroup().addTo(m);current.current=L.layerGroup().addTo(m);
  m.on('dragstart',()=>{following.current=false;});
  const resize=new ResizeObserver(()=>m.invalidateSize({pan:false}));resize.observe(root.current);
  return()=>{resize.disconnect();m.remove();map.current=null;};
 },[]);
 useEffect(()=>{
  const m=map.current;if(!m)return;
  const layer=base.current;layer.clearLayers();
  const bounds=L.latLngBounds([]);
  if(route?.geometry){const line=L.geoJSON(route.geometry,{pane:'suggested',style:{className:'route-suggested-line',color:'#475d80',weight:6,opacity:.34,dashArray:'7 8'}}).addTo(layer);const b=line.getBounds();if(b.isValid())bounds.extend(b);}
  for(const [i,p] of JSON.parse(pointKey).entries()){
   const at=coords(p);if(!at)continue;bounds.extend(at);
   const title=(i?'Entrega '+i:'Embarque')+' · '+p.name;
   const popup=document.createElement('div');
   for(const text of [title,p.address,p.representative&&'Representante: '+p.representative,p.phone&&'Teléfono: '+p.phone,p.email&&'Correo: '+p.email].filter(Boolean)){
    const line=document.createElement('div');line.textContent=text;popup.append(line);
   }
   L.circleMarker(at,{pane:'suggested',radius:7,color:'#fff',weight:2,fillColor:'#384969',fillOpacity:1}).addTo(layer).bindPopup(popup);
  }
  if(bounds.isValid()&&!lastCentered.current)m.fitBounds(bounds,{padding:[28,28],maxZoom:15});
 },[route,pointKey]);
 useEffect(()=>{
  const layer=actual.current;if(!layer)return;layer.clearLayers();
  const rows=samples.filter(coords).sort((a,b)=>timestamp(a)-timestamp(b));
  let segment=[];
  const draw=()=>{if(segment.length>1){L.polyline(segment,{pane:'driven',color:'#fff',weight:8,opacity:.9}).addTo(layer);L.polyline(segment,{pane:'driven',color:'#087d72',weight:5,opacity:1}).addTo(layer);}};
  for(let i=0;i<rows.length;i++){
   if(i&&timestamp(rows[i])-timestamp(rows[i-1])>300000){draw();segment=[];}
   segment.push(coords(rows[i]));
  }
  draw();
  if(rows.length)L.circleMarker(coords(rows[0]),{pane:'driven',radius:4,color:'#087d72',fillOpacity:1}).addTo(layer);
 },[samples]);
 const last=fix||samples.at(-1),lat=last?.latitude,lng=last?.longitude;
 useEffect(()=>{
  const m=map.current,layer=current.current;layer.clearLayers();const at=coords({latitude:lat,longitude:lng});if(!at)return;
  L.circleMarker(at,{pane:'current-fix',radius:9,color:'#fff',weight:3,fillColor:'#0065d2',fillOpacity:1}).addTo(layer).bindTooltip('Última ubicación');
  if(following.current){if(!lastCentered.current)m.setView(at,16);else if(!m.getBounds().pad(-.2).contains(at))m.panTo(at);}
  lastCentered.current=at;
 },[lat,lng]);
 return <div className="route-workspace">
  <div className="route-map-frame"><div ref={root} className="route-map" aria-label="Mapa del viaje con ruta sugerida y recorrido GPS"/>
  {follow&&coords(last)&&<button className="route-recenter" type="button" onClick={()=>{following.current=true;map.current.setView(coords(last),16);}}>Mi ubicación</button>}</div>
  <div className="route-legend"><span><i className="planned"/>Sugerida</span><span><i className="driven"/>Recorrida</span><span><i className="position"/>Última ubicación</span>{offline&&<span className="route-offline">Sin internet · el fondo del mapa puede no cargar</span>}</div>
 </div>;
}
