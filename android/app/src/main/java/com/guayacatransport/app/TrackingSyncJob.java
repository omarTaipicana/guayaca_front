package com.guayacatransport.app;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Handler;
import android.os.Looper;
import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;
import org.json.JSONArray;

/** Drains points still in the native queue when the WebView is not visible. */
public final class TrackingSyncJob extends JobService {
    private static final int JOB_ID=6044;
    private static final DateTimeFormatter ISO_MILLIS=new DateTimeFormatterBuilder().appendInstant(3).toFormatter();
    private static final AtomicLong requests=new AtomicLong();
    private volatile JobParameters running;

    static void configure(Context c,String url){
        URI uri=URI.create(url);
        if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null)
            throw new IllegalArgumentException("Se requiere la API HTTPS");
        c.getSharedPreferences("guayaca_tracking_config",MODE_PRIVATE).edit().putString("api",url.replaceAll("/+$","")).apply();
    }

    static void schedule(Context c){
        requests.incrementAndGet();
        schedulePending(c);
    }

    private static void schedulePending(Context c){
        try{
            JobScheduler jobs=c.getSystemService(JobScheduler.class);
            if(jobs==null||jobs.getPendingJob(JOB_ID)!=null)return;
            jobs.schedule(new JobInfo.Builder(JOB_ID,new ComponentName(c,TrackingSyncJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setMinimumLatency(1500)
                .setBackoffCriteria(15000,JobInfo.BACKOFF_POLICY_EXPONENTIAL).build());
        }catch(RuntimeException e){android.util.Log.w("GuayacaGPS","No se pudo programar el envío GPS",e);}
    }

    @Override public boolean onStartJob(JobParameters job){
        if(MainActivity.visible)return false;
        running=job;
        final long started=requests.get();
        new Thread(()->{
            boolean retry=false;
            try{retry=drain(job);}catch(Exception e){retry=true;}
            final boolean reschedule=retry;
            new Handler(Looper.getMainLooper()).post(()->{
                if(running==job){
                    running=null;jobFinished(job,reschedule);
                    if(!reschedule&&!MainActivity.visible&&requests.get()!=started)
                        new Handler(Looper.getMainLooper()).postDelayed(()->schedulePending(this),1500);
                }
            });
        },"guayaca-gps-sync").start();
        return true;
    }

    @Override public boolean onStopJob(JobParameters job){if(running==job)running=null;return true;}

    private boolean drain(JobParameters job) throws Exception {
        String api=getSharedPreferences("guayaca_tracking_config",MODE_PRIVATE).getString("api","");
        String token=GuayacaSessionPlugin.storedToken(this),owner=GuayacaSessionPlugin.tokenOwner(token);
        if(api.isEmpty()||!owner.matches("[0-9]+"))return false;
        try(TripTrackerService.Database d=new TripTrackerService.Database(this)){
            SQLiteDatabase db=d.getWritableDatabase();
            db.delete("synced_web_gps","captured<?",new String[]{Long.toString(System.currentTimeMillis()-91L*86400000L)});
            Set<String> blocked=new HashSet<>();
            for(int i=0;i<80;i++){
                if(running!=job||MainActivity.visible||!token.equals(GuayacaSessionPlugin.storedToken(this)))return false;
                JSONObject nativePoint=nextPoint(db,owner,blocked),webPoint=oldestWebPoint(db,owner,blocked);
                boolean fromWeb=webPoint!=null&&(nativePoint==null||webPoint.getString("captured_at").compareTo(nativePoint.getString("captured_at"))<=0);
                JSONObject op=fromWeb?webPoint:nativePoint;
                if(op==null){if(i==0&&blocked.isEmpty())return verifyActiveTrip(api,token,owner);return false;}
                if(MainActivity.visible||running!=job)return false;
                String trip=op.getString("trip_id");
                Reply reply=send(api,token,op);
                if(reply.status==401){stopActiveFor(owner);return false;}
                if(reply.status==403||reply.status==404){stopTracking(owner,trip);blocked.add(trip);continue;}
                if(reply.status==429||reply.status>=500)return true;
                if(reply.status!=200||!reply.body.optBoolean("confirmed")||!op.getString("id").equals(reply.body.optString("id"))){blocked.add(trip);continue;}
                ContentValues ack=new ContentValues();ack.put("synced",1);
                db.beginTransaction();
                try{
                    db.update("points",ack,"owner=? AND id=?",new String[]{owner,op.getString("id")});
                    if(fromWeb){
                        ContentValues record=new ContentValues();record.put("id",op.getString("id"));record.put("captured",Instant.parse(op.getString("captured_at")).toEpochMilli());
                        db.replaceOrThrow("synced_web_gps",null,record);
                    }
                    db.setTransactionSuccessful();
                }finally{db.endTransaction();}
                JSONObject result=reply.body.optJSONObject("result");
                if(result!=null&&(result.optBoolean("route_complete")||"cancelado".equals(result.optString("status"))))stopTracking(owner,trip);
            }
            return !MainActivity.visible;
        }
    }

    private void stopActiveFor(String owner){
        new Handler(Looper.getMainLooper()).post(()->{
            TripTrackerService service=TripTrackerService.active;
            if(service!=null&&service.ownedBy(owner))service.stopFor(owner,service.tripId());
        });
    }
    private void stopTracking(String owner,String trip){
        new Handler(Looper.getMainLooper()).post(()->{
            TripTrackerService service=TripTrackerService.active;
            if(service!=null)service.stopFor(owner,trip);
        });
    }

    // Points already handed over to the WebView may be older than native points.
    // The operation UUID and payload match the WebView's retry, so both paths
    // can acknowledge the same coordinate safely when the user reopens the app.
    private JSONObject oldestWebPoint(SQLiteDatabase tracking,String owner,Set<String> blocked) throws Exception{
        File file=getDatabasePath("guayaca_offlineSQLite.db");
        if(!file.exists())return null;
        try(SQLiteDatabase db=SQLiteDatabase.openDatabase(file.getPath(),null,SQLiteDatabase.OPEN_READONLY);
            Cursor cursor=db.rawQuery("SELECT value FROM kv WHERE key LIKE ? AND substr(value,1,512) LIKE ?",new String[]{"op:"+owner+":%","%\"kind\":\"gps\"%"})){
            JSONObject oldest=null;
            while(cursor.moveToNext()){
                JSONObject saved=new JSONObject(cursor.getString(0));
                if(!"gps".equals(saved.optString("kind"))||blocked.contains(saved.optString("trip_id")))continue;
                String state=saved.optString("state");
                if("confirmed".equals(state)||"trip_deleted".equals(state))continue;
                String at=saved.getString("captured_at"),id=saved.getString("id");
                if(oldest!=null&&at.compareTo(oldest.getString("captured_at"))>=0)continue;
                try(Cursor ack=tracking.rawQuery("SELECT 1 FROM synced_web_gps WHERE id=?",new String[]{id})){if(ack.moveToFirst())continue;}
                oldest=new JSONObject().put("id",id).put("trip_id",saved.getString("trip_id")).put("kind","gps")
                    .put("position",JSONObject.NULL).put("captured_at",at).put("body",saved.getJSONObject("body"));
            }
            return oldest;
        }
    }

    private JSONObject nextPoint(SQLiteDatabase db,String owner,Set<String> blocked) throws Exception{
        try(Cursor c=db.rawQuery("SELECT id,trip,captured,lat,lng,accuracy,route FROM points WHERE owner=? AND synced=0 ORDER BY captured,id",new String[]{owner})){
            while(c.moveToNext()){
                String trip=c.getString(1);if(blocked.contains(trip))continue;long at=c.getLong(2);
                String stamp=ISO_MILLIS.format(Instant.ofEpochMilli(at));
                JSONObject body=new JSONObject().put("latitude",c.getDouble(3)).put("longitude",c.getDouble(4))
                    .put("accuracy",c.getDouble(5)).put("timestamp",stamp).put("route_point",c.getInt(6)==1);
                return new JSONObject().put("id",c.getString(0)).put("trip_id",trip).put("kind","gps")
                    .put("position",JSONObject.NULL).put("captured_at",stamp).put("body",body);
            }
        }
        return null;
    }

    private boolean verifyActiveTrip(String api,String token,String owner) throws Exception{
        TripTrackerService service=TripTrackerService.active;
        if(service==null||!service.ownedBy(owner)||MainActivity.visible)return false;
        String trip=service.tripId();
        HttpsURLConnection con=(HttpsURLConnection)URI.create(api+"/gps-session").toURL().openConnection();
        try{
            con.setConnectTimeout(8000);con.setReadTimeout(12000);con.setInstanceFollowRedirects(false);
            con.setRequestProperty("Authorization","Bearer "+token);
            int status=con.getResponseCode();
            if(status==401||status==403){stopTracking(owner,trip);return false;}
            if(status>=500||status==429)return true;
            if(status!=200)return false;
            JSONArray active=new JSONArray(readResponse(con));
            for(int i=0;i<active.length();i++)if(trip.equals(active.getJSONObject(i).optString("id")))return false;
            stopTracking(owner,trip);return false;
        }finally{con.disconnect();}
    }

    private static String readResponse(HttpsURLConnection con) throws IOException{
        try(java.io.InputStream in=con.getInputStream();java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream()){
            byte[] buffer=new byte[4096];int n;
            while((n=in.read(buffer))!=-1){bytes.write(buffer,0,n);if(bytes.size()>65536)throw new IOException("Respuesta GPS demasiado grande");}
            return bytes.toString("UTF-8");
        }
    }

    private static final class Reply {
        final int status;final JSONObject body;
        Reply(int status,JSONObject body){this.status=status;this.body=body;}
    }
    private Reply send(String api,String token,JSONObject op) throws Exception{
        HttpsURLConnection con=(HttpsURLConnection)URI.create(api+"/offline/operations").toURL().openConnection();
        try{
            con.setConnectTimeout(8000);con.setReadTimeout(12000);con.setInstanceFollowRedirects(false);
            con.setRequestMethod("POST");con.setDoOutput(true);
            con.setRequestProperty("Authorization","Bearer "+token);
            String boundary="guayaca"+UUID.randomUUID().toString().replace("-","");
            con.setRequestProperty("Content-Type","multipart/form-data; boundary="+boundary);
            byte[] payload=("--"+boundary+"\r\nContent-Disposition: form-data; name=\"operation\"\r\n\r\n"+op+"\r\n--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8);
            con.setFixedLengthStreamingMode(payload.length);
            try(java.io.OutputStream out=con.getOutputStream()){out.write(payload);}
            int status=con.getResponseCode();
            if(status!=200)return new Reply(status,new JSONObject());
            return new Reply(status,new JSONObject(readResponse(con)));
        }finally{con.disconnect();}
    }
}
