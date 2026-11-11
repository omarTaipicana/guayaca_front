package com.guayacatransport.app;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    static volatile boolean visible;
    @Override public void onStart(){super.onStart();visible=true;TrackingControlProvider.setVisible(this,true);}
    @Override public void onStop(){visible=false;TrackingControlProvider.setVisible(this,false);super.onStop();}

    @Override protected void onNewIntent(android.content.Intent intent) {
        setIntent(intent);
        super.onNewIntent(intent);
    }
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GuayacaSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
