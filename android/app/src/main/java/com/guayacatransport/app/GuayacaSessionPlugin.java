package com.guayacatransport.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "GuayacaSession")
public class GuayacaSessionPlugin extends Plugin {
    private static final String ALIAS = "guayaca_session_v1";
    private static synchronized SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (!ks.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) ks.getKey(ALIAS, null);
    }
    static void storeToken(Context context,String token) throws Exception {
        SharedPreferences prefs=context.getSharedPreferences("guayaca_session",Context.MODE_PRIVATE);
        if(token.isEmpty()){
            if(!prefs.edit().clear().commit())throw new IllegalStateException();
            return;
        }
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE,key());
        String encrypted=Base64.encodeToString(cipher.doFinal(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP);
        if(!prefs.edit().putString("token",encrypted).putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).commit())
            throw new IllegalStateException();
    }
    @PluginMethod public void set(PluginCall call){
        android.os.Bundle args=new android.os.Bundle();args.putString("token",call.getString("token",""));
        try{TrackingControlProvider.request(getContext(),"sessionSet",args);call.resolve();}
        catch(RuntimeException e){call.reject("No se pudo proteger la sesión en el dispositivo");}
    }
    static String storedToken(Context context) throws Exception {
        SharedPreferences p=context.getSharedPreferences("guayaca_session",Context.MODE_PRIVATE);
        String stored=p.getString("token",null);if(stored==null)return "";
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(p.getString("iv",""),Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(stored,Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8);
    }
    static String tokenOwner(String token) throws Exception {
        if(token.isEmpty())return "";
        return new org.json.JSONObject(new String(Base64.decode(token.split("\\.")[1],Base64.URL_SAFE|Base64.NO_WRAP),java.nio.charset.StandardCharsets.UTF_8)).optString("sub");
    }
    static String storedOwner(Context context) throws Exception {return tokenOwner(storedToken(context));}
    @PluginMethod public void get(PluginCall call) {
        try {JSObject result=new JSObject();result.put("token",TrackingControlProvider.request(getContext(),"sessionGet",null).getString("token",""));call.resolve(result);}
        catch(Exception e){call.reject("No se pudo recuperar la sesión local; inicia sesión con conexión");}
    }
    @PluginMethod public void configureChannel(PluginCall call) {
        String owner=call.getString("owner","");
        boolean sound=Boolean.TRUE.equals(call.getBoolean("sound",true)), vibration=Boolean.TRUE.equals(call.getBoolean("vibration",true));
        android.os.Bundle args=new android.os.Bundle();args.putString("owner",owner);
        args.putBoolean("sound",sound);args.putBoolean("vibration",vibration);
        try{
            JSObject result=new JSObject();result.put("id",TrackingControlProvider.request(getContext(),"channel",args).getString("id"));call.resolve(result);
        }catch(RuntimeException e){call.reject("No se pudo configurar el aviso");}
    }
    @PluginMethod public void openAlertSettings(PluginCall call){
        boolean sound=Boolean.TRUE.equals(call.getBoolean("sound",true));
        boolean vibration=Boolean.TRUE.equals(call.getBoolean("vibration",true));
        getActivity().runOnUiThread(()->{
            try{
                String id=NativeAlerts.channel(getContext(),sound,vibration);
                android.content.Intent intent=new android.content.Intent(android.provider.Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                    .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE,getContext().getPackageName())
                    .putExtra(android.provider.Settings.EXTRA_CHANNEL_ID,id);
                try{getActivity().startActivity(intent);}
                catch(android.content.ActivityNotFoundException e){
                    getActivity().startActivity(new android.content.Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE,getContext().getPackageName()));
                }
                call.resolve();
            }catch(RuntimeException e){call.reject("Abre Ajustes de Android → Notificaciones → GUAYACA para cambiar el tono");}
        });
    }
    @PluginMethod public void postAlert(PluginCall call){
        try{
            android.os.Bundle args=new android.os.Bundle();
            for(String k:new String[]{"owner","title","message","trip_id","stop_id"})args.putString(k,call.getString(k));
            boolean posted=TrackingControlProvider.request(getContext(),"alert",args).getBoolean("posted");
            if(posted)call.resolve();else call.reject("Activa las notificaciones y el canal GUAYACA en Ajustes de Android");
        }catch(RuntimeException e){call.reject("No se pudo publicar la notificación");}
    }
    @Override protected void handleOnNewIntent(android.content.Intent intent){
        if(intent.hasExtra("guayaca_alert_trip"))notifyListeners("tripAlertOpened",new JSObject());
    }
    @PluginMethod public void takeAlertTarget(PluginCall call){
        getActivity().runOnUiThread(()->{
            android.content.Intent intent=getActivity().getIntent();
            JSObject target=new JSObject();
            if(intent!=null&&intent.hasExtra("guayaca_alert_trip")){
                target.put("owner",intent.getStringExtra("guayaca_alert_owner"));
                target.put("trip_id",intent.getStringExtra("guayaca_alert_trip"));
                String stop=intent.getStringExtra("guayaca_alert_stop");
                if(stop!=null&&!stop.isEmpty())target.put("stop_id",stop);
                int position=intent.getIntExtra("guayaca_alert_position",-1);
                if(position>=0)target.put("position",position);
                for(String key:new String[]{"owner","trip","stop","position"})intent.removeExtra("guayaca_alert_"+key);
            }
            call.resolve(target);
        });
    }
    @PluginMethod public void startTracking(PluginCall call){
        String owner=call.getString("owner",""),trip=call.getString("trip","");
        com.getcapacitor.JSArray stops=call.getArray("stops");
        boolean resumeOnly=Boolean.TRUE.equals(call.getBoolean("resumeOnly",false));
        if(!owner.matches("[0-9]+")||!trip.matches("[0-9]+")||(!resumeOnly&&(stops==null||stops.length()==0))){
            call.reject("Prepara el viaje antes de activar GPS");return;
        }
        android.content.Intent intent=new android.content.Intent(getContext(),TripTrackerService.class)
            .putExtra("owner",owner).putExtra("trip",trip).putExtra("resumeOnly",resumeOnly)
            .putExtra("lastSaved",call.getLong("lastSaved",0L));
        if(stops!=null)intent.putExtra("stops",stops.toString());
        JSObject route=call.getObject("route");if(route!=null)intent.putExtra("route",route.toString());
        getActivity().runOnUiThread(()->{
            android.os.Handler handler=new android.os.Handler(android.os.Looper.getMainLooper());
            java.util.concurrent.atomic.AtomicBoolean completed=new java.util.concurrent.atomic.AtomicBoolean();
            Runnable timeout=()->{if(completed.compareAndSet(false,true))call.reject("Android no confirmó el arranque del GPS. Abre el viaje y vuelve a intentar.");};
            android.os.ResultReceiver reply=new android.os.ResultReceiver(handler){
                @Override protected void onReceiveResult(int code,android.os.Bundle details){
                    if(!completed.compareAndSet(false,true))return;
                    handler.removeCallbacks(timeout);
                    if(code==1)call.resolve();else call.reject(details.getString("message","No se pudo iniciar el GPS"));
                }
            };
            try{
                if(!MainActivity.visible)throw new IllegalStateException("GUAYACA no está visible");
                intent.putExtra("apiUrl",call.getString("apiUrl",""));
                handler.postDelayed(timeout,6000);
                getContext().startForegroundService(intent.putExtra(TripTrackerService.START_RESULT,reply));
            }catch(RuntimeException e){
                handler.removeCallbacks(timeout);
                if(completed.compareAndSet(false,true))call.reject("Abre GUAYACA y revisa el permiso de ubicación precisa");
            }
        });
    }
    @PluginMethod public void stopTracking(PluginCall call){
        try{TrackingControlProvider.request(getContext(),"stop",null);call.resolve();}
        catch(RuntimeException e){call.reject("No se pudo detener el seguimiento");}
    }
    private static final long PROCESS_STARTED_AT=System.currentTimeMillis();
    private boolean exitChecked;
    private String lastExit;
    private String recentExit(Context context){
        if(android.os.Build.VERSION.SDK_INT<30)return null;
        try{
            android.app.ActivityManager am=context.getSystemService(android.app.ActivityManager.class);
            java.util.List<android.app.ApplicationExitInfo> exits=am.getHistoricalProcessExitReasons(null,0,8);
            if(exits.isEmpty())return null;
            android.app.ApplicationExitInfo exit=null;
            for(android.app.ApplicationExitInfo item:exits)if((context.getPackageName()+":tracking").equals(item.getProcessName())){exit=item;break;}
            if(exit==null)return null;
            if(exit.getTimestamp()>PROCESS_STARTED_AT||System.currentTimeMillis()-exit.getTimestamp()>30*60*1000L)return null;
            switch(exit.getReason()){
                case android.app.ApplicationExitInfo.REASON_USER_REQUESTED: return "cierre solicitado desde el sistema";
                case android.app.ApplicationExitInfo.REASON_LOW_MEMORY: return "memoria insuficiente";
                case android.app.ApplicationExitInfo.REASON_CRASH:
                case android.app.ApplicationExitInfo.REASON_CRASH_NATIVE: return "fallo de la aplicación";
                case android.app.ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE: return "restricción de recursos";
                default: return null;
            }
        }catch(RuntimeException ignored){return null;}
    }
    @PluginMethod public void trackingStatus(PluginCall call){
        String owner=call.getString("owner","");
        android.os.Bundle args=new android.os.Bundle();args.putString("owner",owner);
        Context ctx=getContext();
        JSObject result;
        try{result=JSObject.fromJSONObject(new org.json.JSONObject(TrackingControlProvider.request(ctx,"status",args).getString("json","{}")));}
        catch(RuntimeException|org.json.JSONException e){call.reject("No se pudo consultar el servicio de GPS");return;}
        boolean active=result.optBoolean("active");
        android.os.PowerManager power=ctx.getSystemService(android.os.PowerManager.class);
        if(power!=null)result.put("batteryOptimized",!power.isIgnoringBatteryOptimizations(ctx.getPackageName()));
        if(active||result.has("trip")){
            if(!exitChecked){lastExit=recentExit(ctx);exitChecked=true;}
            result.put("previousExit",lastExit);
        }
        android.app.NotificationChannel status=ctx.getSystemService(android.app.NotificationManager.class).getNotificationChannel(TripTrackerService.STATUS_CHANNEL);
        result.put("statusNotificationEnabled",status==null||status.getImportance()!=android.app.NotificationManager.IMPORTANCE_NONE);
        call.resolve(result);
    }
    @PluginMethod public void openTrackingSettings(PluginCall call){
        getActivity().runOnUiThread(()->{
            try{
                Context ctx=getContext();
                android.content.Intent intent=new android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    android.net.Uri.fromParts("package",ctx.getPackageName(),null));
                getActivity().startActivity(intent);call.resolve();
            }catch(RuntimeException e){call.reject("Abre Ajustes → Aplicaciones → GUAYACA");}
        });
    }
    @PluginMethod public void trackingAction(PluginCall call){
        android.os.Bundle args=new android.os.Bundle();
        for(String k:new String[]{"owner","trip","kind"})args.putString(k,call.getString(k,""));
        args.putInt("position",call.getInt("position",-1));args.putString("body",call.getObject("body",new JSObject()).toString());
        try{TrackingControlProvider.request(getContext(),"action",args);call.resolve();}
        catch(RuntimeException e){call.reject("No se pudo actualizar el seguimiento del punto");}
    }
    @PluginMethod public void trackingPending(PluginCall call){
        String owner=call.getString("owner","");
        com.getcapacitor.JSArray rows=new com.getcapacitor.JSArray();
        try(TripTrackerService.Database helper=new TripTrackerService.Database(getContext());
            android.database.Cursor c=helper.getReadableDatabase().rawQuery(
                "SELECT id,trip,captured,lat,lng,accuracy,route FROM points WHERE owner=? ORDER BY captured,id LIMIT 500",new String[]{owner})){
            while(c.moveToNext()){
                JSObject r=new JSObject();r.put("id",c.getString(0));r.put("trip",c.getString(1));r.put("captured",c.getLong(2));r.put("latitude",c.getDouble(3));
                r.put("longitude",c.getDouble(4));r.put("accuracy",c.getDouble(5));r.put("route_point",c.getInt(6)==1);rows.put(r);
            }
            JSObject result=new JSObject();result.put("rows",rows);call.resolve(result);
        }catch(RuntimeException e){call.reject("No se pudo leer el recorrido guardado");}
    }
    @PluginMethod public void trackingCopied(PluginCall call){
        String owner=call.getString("owner","");com.getcapacitor.JSArray ids=call.getArray("ids");
        if(ids==null||ids.length()>500){call.reject("Confirmación inválida");return;}
        try(TripTrackerService.Database helper=new TripTrackerService.Database(getContext())){
            android.database.sqlite.SQLiteDatabase db=helper.getWritableDatabase();db.beginTransaction();
            try{for(int i=0;i<ids.length();i++)db.delete("points","owner=? AND id=?",new String[]{owner,ids.getString(i)});db.setTransactionSuccessful();}
            finally{db.endTransaction();}
            call.resolve();
        }catch(RuntimeException|org.json.JSONException e){call.reject("No se pudo confirmar la copia del recorrido");}
    }
}
