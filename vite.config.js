import {fileURLToPath} from 'node:url';
import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
export default defineConfig(({mode})=>{
 const android=mode==='android',env=loadEnv(mode,process.cwd(),'');
 if(android&&(!env.VITE_API_URL?.startsWith('https://')||/localhost|127\.0\.0\.1/.test(env.VITE_API_URL)))throw Error('Configura VITE_API_URL HTTPS del servidor en .env.android antes de compilar Android');
 return {base:android?'./':'/',resolve:{alias:android?{'virtual:pwa-register':fileURLToPath(new URL('./src/services/offline/noWebUpdate.js',import.meta.url))}:{}},plugins:[react(),...(!android?[VitePWA({registerType:'prompt',injectRegister:false,manifest:{name:'GUAYACA Transport',short_name:'GUAYACA',start_url:'/',display:'standalone',background_color:'#eef3f8',theme_color:'#07346b',icons:[{src:'/logo.png',sizes:'1181x1181',type:'image/png'}]},workbox:{globPatterns:['**/*.{js,css,html,png,svg,ico,woff2}'],navigateFallback:'/index.html',navigateFallbackDenylist:[/^\/api\//,/^\/privacidad(?:\/|$)/],cleanupOutdatedCaches:true}})]:[])],server:{host:'0.0.0.0',port:5173,proxy:{'/api':{target:env.VITE_DEV_PROXY||'http://localhost:8080',changeOrigin:true}}},preview:{proxy:{'/api':{target:env.VITE_DEV_PROXY||'http://localhost:8080',changeOrigin:true}}}};
});
