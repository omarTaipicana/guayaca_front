package com.guayacatransport.app;

/** Conservative trail filter; it never changes the raw fixes used by arrival detection. */
final class RouteMotionFilter {
    private static final long MAX_GAP=25000;
    private Point anchor,previous;
    private int supporting;
    static final class Point {
        final double lat,lng,accuracy,speed,speedAccuracy;
        final long time;
        Point(double lat,double lng,double accuracy,long time,double speed,double speedAccuracy){
            this.lat=lat;this.lng=lng;this.accuracy=accuracy;this.time=time;this.speed=speed;this.speedAccuracy=speedAccuracy;
        }
    }
    void reset(Point point){anchor=point;previous=null;supporting=0;}
    boolean accept(Point p){
        if(p.accuracy<=0||p.accuracy>35){previous=null;supporting=0;return false;}
        if(anchor==null){reset(p);return true;}
        if(p.time<=anchor.time||(previous!=null&&p.time<=previous.time))return false;
        boolean still=p.speed>=0&&p.speedAccuracy>=0&&p.speed+p.speedAccuracy<0.9;
        double radius=Math.max(22,Math.hypot(Math.min(35,anchor.accuracy),p.accuracy));
        double displacement=distance(anchor,p);
        if(still||displacement<radius){previous=null;supporting=0;return false;}
        boolean speedConfirmed=p.speedAccuracy>=0&&p.speed-p.speedAccuracy>=0.9;
        double priorDistance=previous==null?0:distance(anchor,previous);
        boolean coherent=previous!=null&&p.time-previous.time<=MAX_GAP
            && distance(previous,p)<=Math.min(55*(p.time-previous.time)/1000.0+p.accuracy+previous.accuracy,displacement+priorDistance*0.25)
            && (displacement>=priorDistance+4);
        supporting=coherent?supporting+1:1;
        previous=p;
        if(supporting<(speedConfirmed?2:3)||p.time-anchor.time<8000)return false;
        reset(p);
        return true;
    }
    private static double distance(Point a,Point b){
        double lat=Math.toRadians(b.lat-a.lat),lng=Math.toRadians(b.lng-a.lng);
        double x=Math.sin(lat/2)*Math.sin(lat/2)+Math.cos(Math.toRadians(a.lat))*Math.cos(Math.toRadians(b.lat))*Math.sin(lng/2)*Math.sin(lng/2);
        return 12742000*Math.asin(Math.sqrt(Math.max(0,Math.min(1,x))));
    }
}
