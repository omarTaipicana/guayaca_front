package com.guayacatransport.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import android.database.sqlite.*;
import org.json.*;
import java.util.UUID;

public final class TripTrackerService extends Service implements LocationListener {
    static final String STATUS_CHANNEL = "guayaca_tracking_status";
    static volatile TripTrackerService active;
    private LocationManager manager;
    private JSONArray stops;
    private String owner, trip;
    private long lastSaved, lastRouteAt, candidateAt;
    private int candidatePosition = -1;
    private String candidate = "";
    private Location lastRoute;
    private boolean healthy;
    private Database database;

    static final class Database extends SQLiteOpenHelper {
        Database(Context context) { super(context.getApplicationContext(), "guayaca_tracking.db", null, 1); }
        @Override public void onCreate(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE points (id TEXT PRIMARY KEY, owner TEXT NOT NULL, trip TEXT NOT NULL, captured INTEGER NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, accuracy REAL NOT NULL, route INTEGER NOT NULL)");
            db.execSQL("CREATE INDEX tracking_owner_time ON points(owner,captured)");
        }
        @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion) { throw new IllegalStateException("Versión SQLite no compatible"); }
    }

    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent,int flags,int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        NotificationManager nm=getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(STATUS_CHANNEL,"Seguimiento del viaje",NotificationManager.IMPORTANCE_LOW));
        Intent launch=getPackageManager().getLaunchIntentForPackage(getPackageName());
        Notification.Builder status=new Notification.Builder(this,STATUS_CHANNEL).setSmallIcon(R.drawable.ic_guayaca_notification)
            .setContentTitle("GUAYACA · Seguimiento activo").setContentText("Guardando el recorrido del viaje").setOngoing(true);
        if(launch!=null)status.setContentIntent(PendingIntent.getActivity(this,1,launch,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT));
        try {
            startForeground(6021,status.build());
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED) throw new SecurityException();
            String nextOwner=intent.getStringExtra("owner"), nextTrip=intent.getStringExtra("trip");
            if (active==this && nextOwner.equals(owner)&&nextTrip.equals(trip)) return START_NOT_STICKY;
            if(manager!=null)manager.removeUpdates(this);
            owner=nextOwner;trip=nextTrip;stops=new JSONArray(intent.getStringExtra("stops"));
            lastSaved=intent.getLongExtra("lastSaved",0);lastRouteAt=0;lastRoute=null;candidate="";candidatePosition=-1;healthy=false;
            String seed=intent.getStringExtra("route");
            if(seed!=null){
                JSONObject r=new JSONObject(seed);
                lastRoute=new Location(LocationManager.GPS_PROVIDER);lastRoute.setLatitude(r.getDouble("latitude"));lastRoute.setLongitude(r.getDouble("longitude"));lastRoute.setAccuracy((float)r.optDouble("accuracy",0));
                lastRouteAt=intent.getLongExtra("lastRouteAt",0);
            }
            if(database==null)database=new Database(this);
            manager=getSystemService(LocationManager.class);
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,5000L,0f,this,Looper.getMainLooper());
            active=this;
        } catch (RuntimeException|JSONException e) { android.util.Log.w("GuayacaGPS","No se pudo iniciar seguimiento",e);stopSelf(); }
        return START_NOT_STICKY;
    }
    private boolean has(JSONObject o,String k){return o.has(k)&&!o.isNull(k)&&!o.optString(k).isEmpty();}
    private boolean hasGuide(JSONObject s){return has(s,"arrival_file_id")||s.optBoolean("document_waived");}
    private boolean hasKm(JSONObject s){return has(s,"arrival_odometer");}
    private boolean incident(JSONObject s){String v=s.optString("outcome");return "partial".equals(v)||"rejected".equals(v)||"failed".equals(v);}
    private JSONObject nextStop(){for(int i=0;i<stops.length();i++){JSONObject s=stops.optJSONObject(i);if(s!=null&&!has(s,"departed_at"))return s;}return null;}
    boolean matches(String user,String id){return user.equals(owner)&&id.equals(trip);}
    boolean hasFix(){return healthy;}
    String tripId(){return trip;}

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
        if(nextStop()==null)stopSelf();
    }

    @Override public void onLocationChanged(Location fix) {
        if(stops==null||!fix.hasAccuracy())return;
        long at=fix.getTime(),now=System.currentTimeMillis();
        if(at<=lastSaved||now-at>120000||at-now>30000)return;
        JSONObject s=nextStop();
        if(s==null){stopSelf();return;}
        JSONObject p=s.optJSONObject("place");if(p==null)return;
        double radius=p.optDouble("radius_m",150);
        double acc=fix.getAccuracy();if(!Double.isFinite(acc)||acc<0||acc>Math.max(25,Math.min(100,radius/2)))return;
        healthy=true;
        float[] d=new float[1];Location.distanceBetween(fix.getLatitude(),fix.getLongitude(),p.optDouble("latitude"),p.optDouble("longitude"),d);
        boolean inside=d[0]<=radius,outside=d[0]>=radius+Math.max(50,acc);
        String kind=!has(s,"arrived_at")?(inside?"arrival":""):has(s,"outside_at")?(inside?"return":""):(outside?"departure":"");
        int pos=s.optInt("position");
        if(lastRoute==null){lastRoute=new Location(fix);lastRouteAt=at;}
        boolean route=(at-lastRouteAt>=8000&&fix.distanceTo(lastRoute)>=Math.max(30,acc+lastRoute.getAccuracy()));
        boolean start=!kind.isEmpty()&&(!kind.equals(candidate)||pos!=candidatePosition||at-lastSaved>90000);
        boolean confirm=!kind.isEmpty()&&!start&&at-candidateAt>=20000;
        boolean reset=kind.isEmpty()&&!candidate.isEmpty()&&pos==candidatePosition;
        if(!route&&!start&&!confirm&&!reset)return;
        try{
            ContentValues values=new ContentValues();values.put("id",UUID.randomUUID().toString());values.put("owner",owner);values.put("trip",trip);
            values.put("captured",at);values.put("lat",fix.getLatitude());values.put("lng",fix.getLongitude());values.put("accuracy",acc);values.put("route",route?1:0);
            database.getWritableDatabase().insertOrThrow("points",null,values);
            lastSaved=at;if(route){lastRoute=new Location(fix);lastRouteAt=at;}
            if(start){candidate=kind;candidateAt=at;candidatePosition=pos;}
            else if(confirm){
                String captured=java.time.Instant.ofEpochMilli(candidateAt).toString();
                if("arrival".equals(kind))s.put("arrived_at",captured);
                if("return".equals(kind)){s.put("outside_at",JSONObject.NULL);s.put("exit_state",JSONObject.NULL);}
                if("departure".equals(kind)){
                    s.put("outside_at",captured);
                    boolean done=hasGuide(s)&&hasKm(s), closed=pos==0||(done&&s.optBoolean("exception_resolved",true));
                    if(closed)s.put("departed_at",captured);
                    s.put("exit_state",closed?(incident(s)?"incident":"delivered"):"pending");
                    if(!done){
                        String missing=(!hasGuide(s)&&!hasKm(s))?"guía y kilometraje":!hasGuide(s)?"guía":"kilometraje";
                        NativeAlerts.post(this,owner,"Completa el punto del viaje",p.optString("name","Punto del viaje")+" · Falta "+missing,(owner+":"+trip+":"+pos).hashCode(),trip,null,pos);
                    }
                }
                candidate="";
            }else if(reset)candidate="";
            if(nextStop()==null)stopSelf();
        }catch(RuntimeException|JSONException e){android.util.Log.e("GuayacaGPS","No se pudo guardar la ubicación",e);healthy=false;stopSelf();}
    }
    @Override public void onProviderDisabled(String provider){healthy=false;}
    @Override public void onProviderEnabled(String provider){}
    @Override public void onStatusChanged(String provider,int status,Bundle extras){}
    @Override public void onDestroy(){
        if(manager!=null)manager.removeUpdates(this);
        if(database!=null)database.close();
        if(active==this)active=null;
        stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();
    }
}
