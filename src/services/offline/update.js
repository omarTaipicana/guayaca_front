import {Capacitor} from '@capacitor/core';import {listLocal} from './store.js';
let update;
export async function registerWebUpdate(){if(Capacitor.isNativePlatform()||import.meta.env.MODE==='android'||!import.meta.env.PROD)return;const {registerSW}=await import('virtual:pwa-register');update=registerSW({immediate:true,onNeedRefresh:()=>window.dispatchEvent(new Event('guayaca:update-ready'))});}
export async function applyWebUpdate(){if((await listLocal('op:')).some(o=>o.state!=='confirmed'))throw Error('Primero confirma todos los envíos pendientes del dispositivo antes de actualizar');if(update)await update(true);}
