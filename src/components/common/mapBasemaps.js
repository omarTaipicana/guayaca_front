import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './mapBasemaps.css';

const streetsMaxZoom=19;
// Paused for this release. Re-enable here to restore the selector on all maps.
const satelliteEnabled=false;
const esriKey=import.meta.env.VITE_ARCGIS_API_KEY?.trim();
const stadiaKey=import.meta.env.VITE_STADIA_MAPS_API_KEY?.trim();
const basic=!esriKey&&!stadiaKey;
const imageryMaxZoom=basic?14:20;
const imagery=esriKey?{
 url:'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token='+encodeURIComponent(esriKey),
 attribution:'<a href="https://www.esri.com/">Powered by Esri</a> · Esri, Vantor, Earthstar Geographics, and the GIS User Community',
}:stadiaKey?{
 url:'https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg?api_key='+encodeURIComponent(stadiaKey),
 attribution:'© CNES, Distribution Airbus DS, © Airbus DS, © PlanetObserver (Contains Copernicus Data) | © <a href="https://stadiamaps.com/">Stadia Maps</a> © OpenMapTiles © OpenStreetMap',
}:{
 url:'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg',
 maxNativeZoom:imageryMaxZoom,
 attribution:'<a href="https://cloudless.eox.at">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)',
};

export function addMapBasemaps(map){
 const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:streetsMaxZoom,zIndex:1,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
 }).addTo(map);
 if(!satelliteEnabled)return;
 const {url,...options}=imagery;
 const control=L.control({position:'topleft'});
 const host=map.getContainer();
 let button,status,timer,reveal,satellite,streetZoom,streetMaxZoom;
 function showStreets(message=''){
  clearTimeout(timer);
  clearTimeout(reveal);
  if(!map.hasLayer(streets))streets.addTo(map);
  satellite?.off().remove();
  satellite=null;
  if(streetMaxZoom!=null){
   const restoreZoom=streetZoom>options.maxNativeZoom&&map.getZoom()===options.maxNativeZoom;
   map.setMaxZoom(streetMaxZoom);
   if(restoreZoom)map.setZoom(streetZoom,{animate:false});
   streetMaxZoom=null;
  }
  host.classList.remove('guayaca-map-satellite');
  button.setAttribute('aria-pressed','false');
  status.textContent=message;
 }
 function zoomHint(){
  status.textContent=basic&&map.getZoom()>=options.maxNativeZoom?'Límite del satélite básico. Vuelve a calles para acercarte más.':'';
 }
 function showSatellite(){
  const layer=L.tileLayer(url,{...options,maxZoom:imageryMaxZoom,zIndex:2,opacity:0});
  satellite=layer;
  streetZoom=map.getZoom();
  streetMaxZoom=map.getMaxZoom();
  if(basic)map.setMaxZoom(Math.min(streetMaxZoom,imageryMaxZoom));
  let failed=false;
  function loading(){
   failed=false;
   clearTimeout(timer);
   clearTimeout(reveal);
   status.textContent='Cargando satélite…';
   timer=setTimeout(()=>showStreets('El satélite tardó en cargar. Vuelve a intentarlo.'),12000);
  }
  layer.on('loading',loading);
  layer.on('tileerror',()=>{failed=true;});
  layer.on('load',()=>{
   clearTimeout(timer);
   if(failed){
    // Let Leaflet finish its tile callback before removing the layer.
    queueMicrotask(()=>{if(satellite===layer)showStreets('No se cargó la imagen completa. Vuelve a intentarlo.');});
    return;
   }
   layer.setOpacity(1);
   reveal=setTimeout(()=>{
    streets.remove();
    if(!basic)map.setMaxZoom(imageryMaxZoom);
    host.classList.add('guayaca-map-satellite');
    button.setAttribute('aria-pressed','true');
    zoomHint();
   },250);
  });
  loading();
  layer.addTo(map);
 }
 control.onAdd=()=>{
  const container=L.DomUtil.create('div','guayaca-map-switch');
  button=L.DomUtil.create('button','guayaca-map-switch-button',container);
  button.type='button';
  button.title='Alternar mapa de calles y satélite';
  button.setAttribute('aria-label','Satélite');
  button.setAttribute('aria-pressed','false');
  button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></svg>';
  status=L.DomUtil.create('span','guayaca-map-switch-status',container);
  status.setAttribute('role','status');
  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.disableScrollPropagation(container);
  L.DomEvent.on(button,'click',()=>{
   if(satellite){showStreets();return;}
   if(navigator.onLine===false){showStreets('Conéctate a internet para cargar el satélite.');return;}
   showSatellite();
  });
  return container;
 };
 control.addTo(map);
 // Leaflet emits zoomend before or after a tile refresh, depending on how the zoom changed.
 map.on('zoomend',()=>{if(button.getAttribute('aria-pressed')==='true'&&!satellite?.isLoading())zoomHint();});
 map.once('unload',()=>{
  clearTimeout(timer);
  clearTimeout(reveal);
  satellite?.off();
  satellite=null;
  host.classList.remove('guayaca-map-satellite');
 });
}
