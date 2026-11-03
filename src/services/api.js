import {rawApi,getBearer,setBearer as setHttpBearer,download,fetchBlob} from './http.js';
import {queueable,queueRequest,cached,cacheResponse,ownerId} from './offline/queue.js';
import {saveNativeSession} from './native/session.js';
export {getBearer,download,fetchBlob};
export function setBearer(token){setHttpBearer(token);return saveNativeSession(token);}
const cacheable=path=>/^\/(me|trips|gps-session)$/.test(path)||/^\/trips\/\d+(\/(gps-state|control))?$/.test(path);
export async function api(path,options={}){
 const owner=ownerId();
 if(queueable(path,options))return queueRequest(path,options);
 try{const result=await rawApi(path,options);if(owner&&owner!==ownerId()){const error=Error('La cuenta cambió durante la solicitud');error.status=409;throw error;}if((!options.method||options.method==='GET')&&cacheable(path)){try{await cacheResponse(path,result)}catch(e){window.dispatchEvent(new CustomEvent('guayaca:offline-error',{detail:'No se pudo guardar la copia local: '+e.message}))}}return result;}
 catch(e){if(owner&&owner!==ownerId())throw Error('La cuenta cambió durante la solicitud');if(!e.status&&(!options.method||options.method==='GET')&&cacheable(path)){const copy=await cached(path);if(copy){window.dispatchEvent(new CustomEvent('guayaca:offline-cache',{detail:{path,saved_at:copy.saved_at}}));return copy.data;}}throw e;}
}
