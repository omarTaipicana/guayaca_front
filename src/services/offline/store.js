import {Capacitor} from '@capacitor/core';
let opened;
async function storage(){if(opened)return opened;opened=(async()=>{
 if(Capacitor.isNativePlatform()){
  const {CapacitorSQLite,SQLiteConnection}=await import('@capacitor-community/sqlite');const sqlite=new SQLiteConnection(CapacitorSQLite),db=await (async()=>{await sqlite.checkConnectionsConsistency();return (await sqlite.isConnection('guayaca_offline',false)).result?sqlite.retrieveConnection('guayaca_offline',false):sqlite.createConnection('guayaca_offline',false,'no-encryption',1,false)})();await db.open();await db.execute('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
  return {get:async key=>{const r=await db.query('SELECT value FROM kv WHERE key=?',[key]);return r.values?.[0]?JSON.parse(r.values[0].value):null},put:async(key,value)=>{await db.run('INSERT OR REPLACE INTO kv (key,value) VALUES (?,?)',[key,JSON.stringify(value)]);},delete:async key=>{await db.run('DELETE FROM kv WHERE key=?',[key]);},all:async(prefix='')=>{const r=await db.query('SELECT key,value FROM kv WHERE key LIKE ?',[prefix+'%']);return (r.values||[]).map(v=>({key:v.key,value:JSON.parse(v.value)}));}};
 }
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('guayaca-offline',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('kv'))r.result.createObjectStore('kv')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 return {get:key=>new Promise((resolve,reject)=>{const r=db.transaction('kv').objectStore('kv').get(key);r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error)}),put:(key,value)=>new Promise((resolve,reject)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(value,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('No se pudo guardar en el dispositivo'));}),delete:key=>new Promise((resolve,reject)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').delete(key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)}),all:(prefix='')=>new Promise((resolve,reject)=>{const t=db.transaction('kv'),s=t.objectStore('kv'),r=s.openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff')),rows=[];r.onsuccess=()=>{const c=r.result;if(c){rows.push({key:c.key,value:c.value});c.continue()}else resolve(rows)};r.onerror=()=>reject(r.error);})};
 })().catch(e=>{opened=null;throw e});return opened;}
export const getLocal=async key=>(await storage()).get(key);
export const putLocal=async(key,value)=>(await storage()).put(key,value);
export const deleteLocal=async key=>(await storage()).delete(key);
export const listLocal=async prefix=>(await (await storage()).all(prefix)).filter(r=>r.key.startsWith(prefix)).map(r=>r.value);
export async function persistStorage(){if(!Capacitor.isNativePlatform()&&navigator.storage?.persist)return navigator.storage.persist();return true;}
