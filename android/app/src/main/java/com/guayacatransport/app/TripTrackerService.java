package com.guayacatransport.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import android.database.Cursor;
import android.database.sqlite.*;
import org.json.*;
import java.util.UUID;

public final class TripTrackerService extends Service implements LocationListener {
    static final String STATUS_CHANNEL = "guayaca_tracking_status";
    static final String START_RESULT = "tracking_start_result";
    static volatile TripTrackerService active;
    private LocationManager manager;
    private JSONArray stops;
    private String owner, trip;
    private long lastSaved, candidateAt, lastNetworkCheck;
    private int candidatePosition = -1;
    private String candidate = "";
    private Location lastRoute;
    private final RouteMotionFilter motion=new RouteMotionFilter();
    private Location lastFix;
    private boolean healthy;
    private Database database;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private static final long FIX_FRESH_MS=30000L, POSITION_HEARTBEAT_MS=60000L;
    private final Runnable updateStatus=new Runnable(){
        @Override public void run(){
            if(active!=TripTrackerService.this)return;
            try{
                getSystemService(NotificationManager.class).notify(6021,trackingNotification(hasFix()));
            }catch(RuntimeException e){android.util.Log.w("GuayacaGPS","No se pudo actualizar el aviso de seguimiento",e);}
            handler.postDelayed(this,30000);
        }
    };

    static final class Database extends SQLiteOpenHelper {
        Database(Context context) { super(context.getApplicationContext(), "guayaca_tracking.db", null, 2); setWriteAheadLoggingEnabled(true); }
        @Override public void onCreate(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE points (id TEXT PRIMARY KEY, owner TEXT NOT NULL, trip TEXT NOT NULL, captured INTEGER NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, accuracy REAL NOT NULL, route INTEGER NOT NULL, synced INTEGER NOT NULL DEFAULT 0)");
            db.execSQL("CREATE INDEX tracking_owner_time ON points(owner,captured)");
            createCheckpoint(db);
        }
        private static void createCheckpoint(SQLiteDatabase db){
            db.execSQL("CREATE TABLE tracking_session (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)");
            db.execSQL("CREATE TABLE synced_web_gps (id TEXT PRIMARY KEY, captured INTEGER NOT NULL)");
        }
        @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion) {
            if(oldVersion<2){db.execSQL("ALTER TABLE points ADD COLUMN synced INTEGER NOT NULL DEFAULT 0");createCheckpoint(db);}
        }
    }

    @Override public IBinder onBind(Intent intent) { return null; }
    private Notification trackingNotification(boolean hasSignal){
        Intent launch=getPackageManager().getLaunchIntentForPackage(getPackageName());
        Notification.Builder status=new Notification.Builder(this,STATUS_CHANNEL).setSmallIcon(R.drawable.ic_guayaca_notification)
            .setContentTitle("GUAYACA · Seguimiento del viaje")
            .setContentText(hasSignal?"Recibiendo ubicación del viaje":gpsEnabled()?"Esperando una ubicación precisa":"Ubicación del teléfono desactivada")
            .setOnlyAlertOnce(true).setOngoing(true);
        if(Build.VERSION.SDK_INT>=31)status.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        if(launch!=null)status.setContentIntent(PendingIntent.getActivity(this,1,launch,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT));
        return status.build();
    }
    private boolean gpsEnabled(){
        LocationManager location=manager==null?getSystemService(LocationManager.class):manager;
        return location!=null&&location.isProviderEnabled(LocationManager.GPS_PROVIDER);
    }
    private static void startResult(ResultReceiver reply,boolean ok,String message){
        if(reply==null)return;
        Bundle details=new Bundle();
        details.putString("message",message);
        reply.send(ok?1:0,details);
    }
    static JSONObject readCheckpoint(SQLiteDatabase db) throws JSONException {
        try(Cursor c=db.rawQuery("SELECT payload FROM tracking_session WHERE id=1",null)){
            return c.moveToFirst()?new JSONObject(c.getString(0)):null;
        }
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId) {
        ResultReceiver reply=intent==null?null:intent.getParcelableExtra(START_RESULT);
        try {
            getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(STATUS_CHANNEL,"Seguimiento del viaje",NotificationManager.IMPORTANCE_LOW));
            startForeground(6021,trackingNotification(hasFix()));
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)
                throw new SecurityException("Permite la ubicación precisa para este viaje");
            if(intent!=null){
                try{TrackingSyncJob.configure(this,intent.getStringExtra("apiUrl"));}
                catch(IllegalArgumentException e){android.util.Log.w("GuayacaGPS","Sin API válida para sincronización nativa");}
            }
            String requestedOwner=intent==null?null:intent.getStringExtra("owner");
            String requestedTrip=intent==null?null:intent.getStringExtra("trip");
            String localOwner=GuayacaSessionPlugin.storedOwner(this);
            if(intent!=null&&active==this&&matches(requestedOwner,requestedTrip)&&owner.equals(localOwner)){
                startResult(reply,true,null);
                return START_STICKY;
            }
            if(database==null)database=new Database(this);
            SQLiteDatabase db=database.getWritableDatabase();
            JSONObject checkpoint=readCheckpoint(db);
            long seedAt=intent==null?0:intent.getLongExtra("lastSaved",0);
            boolean resume=checkpoint!=null&&(intent==null||
                (checkpoint.optString("owner").equals(requestedOwner)&&checkpoint.optString("trip").equals(requestedTrip)&&
                 checkpoint.optLong("lastSaved")>=seedAt));
            if(intent!=null&&intent.getBooleanExtra("resumeOnly",false)&&!resume){
                startResult(reply,false,"No hay una sesión GPS guardada para este viaje");
                if(active==this)return START_STICKY;
                stopSelf();return START_NOT_STICKY;
            }
            if(manager!=null)manager.removeUpdates(this);
            if(resume){
                owner=checkpoint.getString("owner");trip=checkpoint.getString("trip");stops=checkpoint.getJSONArray("stops");
                lastSaved=checkpoint.optLong("lastSaved");
                lastRoute=decodeFix(checkpoint.optJSONObject("route"));lastFix=decodeFix(checkpoint.optJSONObject("fix"));
                candidate=checkpoint.optString("candidate","");candidateAt=checkpoint.optLong("candidateAt");candidatePosition=checkpoint.optInt("candidatePosition",-1);
            }else if(intent!=null){
                owner=requestedOwner;trip=requestedTrip;stops=new JSONArray(intent.getStringExtra("stops"));
                lastSaved=seedAt;
                String seed=intent.getStringExtra("route");lastRoute=seed==null?null:decodeFix(new JSONObject(seed));lastFix=lastRoute;
                candidate="";candidatePosition=-1;candidateAt=0;
            }else{stopSelf();return START_NOT_STICKY;}
            if(owner==null||!owner.equals(localOwner)||firstPending()==null){
                startResult(reply,false,"No hay un recorrido activo para esta cuenta");
                clearAndStop();return START_NOT_STICKY;
            }
            motion.reset(lastRoute==null?null:motionPoint(lastRoute));
            healthy=false;saveCheckpoint(db);
            manager=getSystemService(LocationManager.class);
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,5000L,0f,this,Looper.getMainLooper());
            try{
                if(manager.getAllProviders().contains(LocationManager.NETWORK_PROVIDER))
                    manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,10000L,0f,this,Looper.getMainLooper());
            }catch(IllegalArgumentException|SecurityException e){android.util.Log.w("GuayacaGPS","Proveedor de apoyo no disponible",e);}
            active=this;
            handler.removeCallbacks(updateStatus);
            handler.post(updateStatus);
            android.util.Log.i("GuayacaGPS",resume?"Seguimiento restaurado desde el dispositivo":"Servicio de seguimiento iniciado");
            if(!TrackingControlProvider.uiVisible)TrackingSyncJob.schedule(this);
            startResult(reply,true,null);
            return START_STICKY;
        } catch (Exception e) {
            android.util.Log.w("GuayacaGPS","No se pudo iniciar seguimiento",e);
            startResult(reply,false,e instanceof SecurityException?"Abre el viaje y permite la ubicación precisa":"No se pudo iniciar el servicio GPS. Revisa la ubicación del teléfono.");
            stopSelf();return START_NOT_STICKY;
        }
    }
    private Location decodeFix(JSONObject json) throws JSONException {
        if(json==null)return null;
        Location f=new Location(LocationManager.GPS_PROVIDER);
        f.setLatitude(json.getDouble("latitude"));f.setLongitude(json.getDouble("longitude"));
        f.setAccuracy((float)json.optDouble("accuracy",0));f.setTime(json.optLong("timestamp",0));return f;
    }
    static JSONObject encodeFix(Location f) throws JSONException {
        return f==null?null:new JSONObject().put("latitude",f.getLatitude()).put("longitude",f.getLongitude())
                .put("accuracy",f.getAccuracy()).put("timestamp",f.getTime());
    }
    private void saveCheckpoint(SQLiteDatabase db) throws JSONException {
        JSONObject state=new JSONObject().put("owner",owner).put("trip",trip).put("stops",stops)
            .put("lastSaved",lastSaved).put("route",encodeFix(lastRoute))
            .put("fix",encodeFix(lastFix)).put("candidate",candidate).put("candidateAt",candidateAt).put("candidatePosition",candidatePosition);
        ContentValues values=new ContentValues();values.put("id",1);values.put("payload",state.toString());
        db.replaceOrThrow("tracking_session",null,values);
    }
    static void clearCheckpoint(Context context){
        try(Database d=new Database(context)){d.getWritableDatabase().delete("tracking_session",null,null);}
    }
    private void clearAndStop(){try{if(database!=null)database.getWritableDatabase().delete("tracking_session",null,null);}finally{stopSelf();}}
    @Override public void onTaskRemoved(Intent rootIntent){
        super.onTaskRemoved(rootIntent);
        TrackingControlProvider.uiVisible=false;
        android.util.Log.i("GuayacaGPS","Tarea retirada de Recientes; continúa el servicio de ubicación");
        TrackingSyncJob.schedule(this);
    }
    private boolean has(JSONObject o,String k){return o.has(k)&&!o.isNull(k)&&!o.optString(k).isEmpty();}
    private boolean hasGuide(JSONObject s){return has(s,"arrival_file_id")||s.optBoolean("document_waived");}
    private boolean hasKm(JSONObject s){return has(s,"arrival_odometer");}
    private boolean incident(JSONObject s){String v=s.optString("outcome");return "partial".equals(v)||"rejected".equals(v)||"failed".equals(v);}
    private JSONObject firstPending(){for(int i=0;i<stops.length();i++){JSONObject s=stops.optJSONObject(i);if(s!=null&&!has(s,"departed_at"))return s;}return null;}
    boolean matches(String user,String id){return owner!=null&&owner.equals(user)&&trip!=null&&trip.equals(id);}
    boolean hasFix(){return healthy&&lastFix!=null&&SystemClock.elapsedRealtimeNanos()-lastFix.getElapsedRealtimeNanos()<=FIX_FRESH_MS*1000000L;}
    boolean locationEnabled(){return gpsEnabled();}
    String tripId(){return trip;}
    boolean ownedBy(String user){return owner!=null&&owner.equals(user);}
    JSONObject latestFix() throws JSONException {return encodeFix(lastFix);}
    long lastCapturedAt(){return lastSaved;}
    void endTracking(){clearAndStop();}
    void stopFor(String user,String id){if(matches(user,id))clearAndStop();}

    void applyAction(int pos,String kind,JSONObject body) throws JSONException {
        JSONObject s=stops.optJSONObject(pos);if(s==null)return;
        if("point".equals(kind)){
            s.put("arrival_file_id","local");s.put("arrival_odometer",body.get("odometer"));
            if(pos>0&&has(s,"outside_at")&&!incident(s)){s.put("departed_at",s.get("outside_at"));s.put("exit_state","delivered");}
        }else if("outcome".equals(kind)){
            s.put("outcome",body.getString("outcome"));s.put("exception_resolved",false);
        }else if("exit".equals(kind)&&has(s,"outside_at")){
            String choice=body.getString("choice");s.put("exit_state",choice);
            if("delivered".equals(choice)||"incident".equals(choice))s.put("departed_at",s.get("outside_at"));
        }
        if(firstPending()==null)clearAndStop();else saveCheckpoint(database.getWritableDatabase());
    }

    private static RouteMotionFilter.Point motionPoint(Location f){
        return new RouteMotionFilter.Point(f.getLatitude(),f.getLongitude(),f.getAccuracy(),f.getTime(),
            f.hasSpeed()?f.getSpeed():-1,f.hasSpeedAccuracy()?f.getSpeedAccuracyMetersPerSecond():-1);
    }
    @Override public void onLocationChanged(Location fix) {
        if(stops==null||!fix.hasAccuracy())return;
        long at=fix.getTime(),now=System.currentTimeMillis();
        if(at<=lastSaved||now-at>120000||at-now>30000)return;
        if(firstPending()==null){clearAndStop();return;}
        double acc=fix.getAccuracy();
        if(!Double.isFinite(acc)||acc<0||acc>100)return;
        // Prefer fresh satellite readings; use the system network provider as a backup.
        if(!LocationManager.GPS_PROVIDER.equals(fix.getProvider())&&lastFix!=null&&
            LocationManager.GPS_PROVIDER.equals(lastFix.getProvider())&&at-lastFix.getTime()<15000L)return;
        boolean firstFreshFix=!hasFix();
        healthy=true;lastFix=new Location(fix);
        if(firstFreshFix){handler.removeCallbacks(updateStatus);handler.post(updateStatus);}
        JSONObject s=null, active=null;
        String kind="";
        double nearest=Double.POSITIVE_INFINITY;
        float[] d=new float[1];
        for(int i=0;i<stops.length();i++){
            JSONObject row=stops.optJSONObject(i);
            if(row==null||has(row,"departed_at"))continue;
            if(row.optInt("position")==0){active=row;break;}
            if(active==null&&has(row,"arrived_at")&&!has(row,"outside_at"))active=row;
        }
        for(int i=0;i<stops.length();i++){
            JSONObject row=stops.optJSONObject(i);
            if(row==null||has(row,"departed_at")||(active!=null&&row!=active))continue;
            JSONObject place=row.optJSONObject("place");if(place==null)continue;
            double radius=place.optDouble("radius_m",150);
            if(acc>Math.max(25,Math.min(100,radius/2)))continue;
            Location.distanceBetween(fix.getLatitude(),fix.getLongitude(),place.optDouble("latitude"),place.optDouble("longitude"),d);
            if(row==active&&has(row,"arrived_at")){
                if(d[0]>=radius+Math.max(50,acc)){s=row;kind="departure";}
            }else if(d[0]<=radius&&(s==null||d[0]<nearest||d[0]==nearest&&row.optInt("position")<s.optInt("position"))){
                s=row;nearest=d[0];kind=has(row,"arrived_at")?"return":"arrival";
            }
        }
        JSONObject p=s==null?null:s.optJSONObject("place");
        int pos=s==null?-1:s.optInt("position");
        boolean route=LocationManager.GPS_PROVIDER.equals(fix.getProvider())&&motion.accept(motionPoint(fix));
        boolean heartbeat=at-lastSaved>=POSITION_HEARTBEAT_MS;
        boolean start=!kind.isEmpty()&&(!kind.equals(candidate)||pos!=candidatePosition||at-lastSaved>90000);
        boolean confirm=!kind.isEmpty()&&!start&&at-candidateAt>=20000;
        boolean reset=kind.isEmpty()&&!candidate.isEmpty();
        if(!route&&!heartbeat&&!start&&!confirm&&!reset){
            if(!TrackingControlProvider.uiVisible&&at-lastNetworkCheck>=60000){lastNetworkCheck=at;TrackingSyncJob.schedule(this);}
            return;
        }
        JSONObject alertPlace=null;String alertMessage=null,alertTitle=null;
        try{
            SQLiteDatabase db=database.getWritableDatabase();
            db.beginTransaction();
            try{
            ContentValues values=new ContentValues();values.put("id",UUID.randomUUID().toString());values.put("owner",owner);values.put("trip",trip);
            values.put("captured",at);values.put("lat",fix.getLatitude());values.put("lng",fix.getLongitude());values.put("accuracy",acc);values.put("route",route?1:0);
            db.insertOrThrow("points",null,values);
            lastSaved=at;if(route)lastRoute=new Location(fix);
            if(start){candidate=kind;candidateAt=at;candidatePosition=pos;}
            else if(confirm){
                String captured=java.time.Instant.ofEpochMilli(candidateAt).toString();
                if("arrival".equals(kind)){
                    s.put("arrived_at",captured);
                    alertPlace=p;alertTitle="Llegaste al punto del viaje";alertMessage=p.optString("name","Punto del viaje");
                }
                if("return".equals(kind)){s.put("outside_at",JSONObject.NULL);s.put("exit_state",JSONObject.NULL);}
                if("departure".equals(kind)){
                    s.put("outside_at",captured);
                    boolean done=hasGuide(s)&&hasKm(s), closed=pos==0||(done&&s.optBoolean("exception_resolved",true));
                    if(closed)s.put("departed_at",captured);
                    s.put("exit_state",closed?(incident(s)?"incident":"delivered"):"pending");
                    if(!done){
                        String missing=(!hasGuide(s)&&!hasKm(s))?"guía y kilometraje":!hasGuide(s)?"guía":"kilometraje";
                        alertPlace=p;alertTitle="Completa el punto del viaje";
                        alertMessage=p.optString("name","Punto del viaje")+" · Falta "+missing;
                    }else{
                        alertPlace=p;alertTitle="Saliste del punto del viaje";
                        alertMessage=p.optString("name","Punto del viaje");
                    }
                }
                candidate="";
            }else if(reset)candidate="";
            boolean complete=firstPending()==null;
            if(complete)db.delete("tracking_session",null,null);else saveCheckpoint(db);
            db.setTransactionSuccessful();
            }finally{db.endTransaction();}
            if(!TrackingControlProvider.uiVisible||firstPending()==null){lastNetworkCheck=at;TrackingSyncJob.schedule(this);}
            if(alertPlace!=null){
                try{NativeAlerts.post(this,owner,alertTitle,alertMessage,(owner+":"+trip+":"+pos+":"+kind).hashCode(),trip,null,pos);}
                catch(RuntimeException e){android.util.Log.w("GuayacaGPS","No se pudo mostrar la alerta local; GPS continúa",e);}
            }
            if(firstPending()==null)stopSelf();
        }catch(RuntimeException|JSONException e){android.util.Log.e("GuayacaGPS","No se pudo guardar la ubicación",e);healthy=false;stopSelf();}
    }
    @Override public void onProviderDisabled(String provider){if(lastFix!=null&&provider.equals(lastFix.getProvider()))healthy=false;}
    @Override public void onProviderEnabled(String provider){}
    @Override public void onStatusChanged(String provider,int status,Bundle extras){}
    @Override public void onDestroy(){
        handler.removeCallbacks(updateStatus);
        android.util.Log.i("GuayacaGPS","Servicio de seguimiento detenido");
        if(manager!=null)manager.removeUpdates(this);
        if(database!=null)database.close();
        if(active==this)active=null;
        stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();
    }
}
