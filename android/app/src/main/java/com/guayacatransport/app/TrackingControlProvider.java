package com.guayacatransport.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Binder;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Process;
import org.json.JSONObject;
import java.util.concurrent.FutureTask;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

/** Private bridge to the tracking process. No command here starts location collection. */
public final class TrackingControlProvider extends ContentProvider {
    static volatile boolean uiVisible;
    private final Handler main=new Handler(Looper.getMainLooper());

    static Bundle request(Context context,String method,Bundle args){
        Uri uri=Uri.parse("content://"+context.getPackageName()+".tracking.control");
        Bundle reply=context.getContentResolver().call(uri,method,null,args);
        if(reply==null||!reply.getBoolean("ok"))throw new IllegalStateException("Servicio GPS no disponible");
        return reply;
    }
    static void setVisible(Context context,boolean visible){
        Bundle args=new Bundle();args.putBoolean("visible",visible);
        try{request(context,"visibility",args);}
        catch(RuntimeException e){android.util.Log.w("GuayacaGPS","No se pudo notificar el estado de la pantalla",e);}
    }
    @Override public boolean onCreate(){return true;}
    @Override public Bundle call(String method,String arg,Bundle extras){
        if(Binder.getCallingUid()!=Process.myUid())throw new SecurityException("Control GPS privado");
        Bundle args=extras==null?new Bundle():extras;
        // Visibility is sent by the UI's main thread. Never wait for the service main thread here.
        if("visibility".equals(method)){
            uiVisible=args.getBoolean("visible");
            if(!uiVisible)main.post(()->TrackingSyncJob.schedule(getContext()));
            Bundle reply=new Bundle();reply.putBoolean("ok",true);return reply;
        }
        FutureTask<Bundle> task=new FutureTask<>(()->dispatch(method,args));
        if(Looper.myLooper()==Looper.getMainLooper())task.run();else main.post(task);
        try{return task.get(2500,TimeUnit.MILLISECONDS);}
        catch(Exception e){
            task.cancel(false);
            android.util.Log.w("GuayacaGPS","No se pudo ejecutar "+method,e);
            return new Bundle();
        }
    }
    private Bundle dispatch(String method,Bundle args) throws Exception {
        Context ctx=getContext();
        Bundle reply=new Bundle();
        String owner=args.getString("owner","");
        TripTrackerService tracker=TripTrackerService.active;
        switch(method){
            case "sessionGet":
                reply.putString("token",GuayacaSessionPlugin.storedToken(ctx));
                break;
            case "sessionSet": {
                String token=args.getString("token","");
                GuayacaSessionPlugin.storeToken(ctx,token);
                if(tracker!=null&&!tracker.ownedBy(GuayacaSessionPlugin.tokenOwner(token)))tracker.endTracking();
                break;
            }
            case "channel": {
                boolean sound=args.getBoolean("sound",true), vibration=args.getBoolean("vibration",true);
                ctx.getSharedPreferences("guayaca_alerts_native",Context.MODE_PRIVATE).edit()
                    .putBoolean(owner+":sound",sound).putBoolean(owner+":vibration",vibration).apply();
                reply.putString("id",NativeAlerts.channel(ctx,sound,vibration));
                break;
            }
            case "alert":
                reply.putBoolean("posted",NativeAlerts.post(ctx,owner,args.getString("title","GUAYACA"),args.getString("message",""),
                    ThreadLocalRandom.current().nextInt(7000,Integer.MAX_VALUE),args.getString("trip_id"),args.getString("stop_id"),-1));
                break;
            case "stop":
                if(tracker!=null)tracker.endTracking();
                else{
                    TripTrackerService.clearCheckpoint(ctx);
                    ctx.stopService(new Intent(ctx,TripTrackerService.class));
                }
                break;
            case "action":
                if(tracker!=null&&tracker.matches(owner,args.getString("trip","")))
                    tracker.applyAction(args.getInt("position",-1),args.getString("kind",""),new JSONObject(args.getString("body","{}")));
                break;
            case "status": {
                boolean active=tracker!=null&&tracker.ownedBy(owner);
                JSONObject result=new JSONObject().put("active",active).put("notificationsEnabled",NativeAlerts.enabled(ctx,owner));
                if(active){
                    result.put("healthy",tracker.hasFix()).put("trip",tracker.tripId()).put("lastCapturedAt",tracker.lastCapturedAt());
                    result.put("locationEnabled",tracker.locationEnabled()).put("fix",tracker.latestFix());
                }else if(!owner.isEmpty()){
                    try(TripTrackerService.Database db=new TripTrackerService.Database(ctx)){
                        JSONObject saved=TripTrackerService.readCheckpoint(db.getReadableDatabase());
                        if(saved!=null&&owner.equals(saved.optString("owner")))
                            result.put("trip",saved.getString("trip")).put("lastCapturedAt",saved.optLong("lastSaved"));
                    }
                }
                reply.putString("json",result.toString());
                break;
            }
            default: throw new IllegalArgumentException("Acción GPS no reconocida");
        }
        reply.putBoolean("ok",true);
        return reply;
    }
    @Override public Cursor query(Uri u,String[] p,String s,String[] a,String o){throw new UnsupportedOperationException();}
    @Override public String getType(Uri u){return null;}
    @Override public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
    @Override public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
    @Override public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
}
