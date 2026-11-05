package com.guayacatransport.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

final class NativeAlerts {
    private NativeAlerts(){}
    static String channel(Context ctx,boolean sound,boolean vibration){
        String id="guayaca_s"+(sound?"1":"0")+"v"+(vibration?"1":"0")+"_v2";
        NotificationChannel channel=new NotificationChannel(id,"GUAYACA · "+(sound?"sonido":"sin sonido")+" · "+(vibration?"vibración":"sin vibración"),NotificationManager.IMPORTANCE_HIGH);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        if(vibration)channel.setVibrationPattern(new long[]{0,220,100,220});
        channel.enableVibration(vibration);
        channel.setSound(sound?Uri.parse("android.resource://"+ctx.getPackageName()+"/"+R.raw.guayaca_alert):null,
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
        ctx.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        return id;
    }
    static boolean post(Context ctx,String owner,String title,String body,int id){
        return post(ctx,owner,title,body,id,null,null,-1);
    }
    static boolean post(Context ctx,String owner,String title,String body,int id,String trip,String stop,int position){
        NotificationManager manager=ctx.getSystemService(NotificationManager.class);
        if(!manager.areNotificationsEnabled()||(Build.VERSION.SDK_INT>=33&&ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED))return false;
        android.content.SharedPreferences p=ctx.getSharedPreferences("guayaca_alerts_native",Context.MODE_PRIVATE);
        String channel=channel(ctx,p.getBoolean(owner+":sound",true),p.getBoolean(owner+":vibration",true));
        if(manager.getNotificationChannel(channel).getImportance()==NotificationManager.IMPORTANCE_NONE)return false;
        Notification.Builder notification=new Notification.Builder(ctx,channel).setSmallIcon(R.drawable.ic_guayaca_notification).setContentTitle(title).setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body)).setAutoCancel(true);
        Intent launch=ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if(launch!=null){
            if(trip!=null&&trip.matches("[0-9]+")&&(position>=0||stop!=null&&stop.matches("[0-9]+"))){
                launch.putExtra("guayaca_alert_owner",owner).putExtra("guayaca_alert_trip",trip)
                    .putExtra("guayaca_alert_stop",stop).putExtra("guayaca_alert_position",position);
            }
            notification.setContentIntent(PendingIntent.getActivity(ctx,id,launch,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT));
        }
        manager.notify(id,notification.build());return true;
    }
}
