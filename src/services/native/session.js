import {Capacitor} from '@capacitor/core';import {setBearer} from '../http.js';
import {Device as Session} from './device.js';
export async function restoreNativeSession(){if(Capacitor.isNativePlatform()){const {token}=await Session.get();if(token){setBearer(token);sessionStorage.setItem('token',token)}}}
export async function saveNativeSession(token){if(Capacitor.isNativePlatform())await Session.set({token:token||''});}
