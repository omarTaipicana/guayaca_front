import {Capacitor} from '@capacitor/core';
import {Preferences} from '@capacitor/preferences';
import {LocalNotifications} from '@capacitor/local-notifications';
import {Device} from './device.js';
let audio;
const defaults=()=>({sound:Capacitor.isNativePlatform(),vibration:Capacitor.isNativePlatform()});
export async function alertSettings(user){const key='guayaca_alerts_'+user;try{const value=Capacitor.isNativePlatform()?(await Preferences.get({key})).value:localStorage.getItem(key);return {...defaults(),...JSON.parse(value||'{}')}}catch{return defaults()}}
async function enableAudio(){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('Este navegador no permite sonido');audio??=new Context();await audio.resume();if(audio.state!=='running')throw Error('Pulsa para habilitar el sonido en esta sesión');}
export async function saveAlertSettings(user,value){if(Capacitor.isNativePlatform()){let p=await LocalNotifications.checkPermissions();if(p.display==='prompt'||p.display==='prompt-with-rationale')p=await LocalNotifications.requestPermissions();if(p.display!=='granted')throw Error('Habilita las notificaciones en Ajustes de Android');await Device.configureChannel({owner:String(user),...value});await Preferences.set({key:'guayaca_alerts_'+user,value:JSON.stringify(value)})}else{if(value.sound)await enableAudio();if(value.vibration&&!navigator.vibrate)throw Error('Este navegador no admite vibración');localStorage.setItem('guayaca_alerts_'+user,JSON.stringify(value))}return value;}
function beep(){if(audio?.state!=='running')return;for(const [i,f] of [880,1175].entries()){const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.18;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.28);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.3)}}
export async function notifyAlert(user,notice={title:'GUAYACA · Prueba de avisos',message:'Comprueba sonido y vibración según tus ajustes.'},test=false){const prefs=await alertSettings(user);
 if(Capacitor.isNativePlatform()){
  let permissions=await LocalNotifications.checkPermissions();
  if(test&&['prompt','prompt-with-rationale'].includes(permissions.display))permissions=await LocalNotifications.requestPermissions();
  if(permissions.display!=='granted')throw Error('Activa las notificaciones de GUAYACA en Ajustes de Android');
  if(test&&!prefs.sound&&!prefs.vibration)throw Error('Activa sonido o vibración antes de hacer la prueba');
  await Device.configureChannel({owner:String(user),...prefs});
  await Device.postAlert({owner:String(user),title:notice.title,message:notice.message.slice(0,220),trip_id:notice.kind==='trip'&&notice.stop_id!=null?String(notice.trip_id):'',stop_id:notice.stop_id!=null?String(notice.stop_id):''});
 }else{if(prefs.sound){if(test)await enableAudio();beep()}if(prefs.vibration)navigator.vibrate?.([220,100,220]);}
}
